"""
Backend de laboratorio: OAuth 2.0 + PKCE, refresh tokens, Step-Up TOTP y anti-replay.
Almacenamiento en memoria (se pierde al reiniciar).
Ejecutar: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
import base64
import hashlib
import hmac
import html
import secrets
import struct
import time
import urllib.parse

from fastapi import FastAPI, Form, Header, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel

app = FastAPI(title="UniSabana Auth Lab")

USER = "estudiante@unisabana.edu.co"
TOTP_SECRET = "JBSWY3DPEHPK3PXP"          # semilla Base32 de prueba
ACCESS_TTL = 5 * 60                        # 5 min
REFRESH_TTL = 30 * 24 * 3600               # 30 días
STEP_UP_TTL = 5 * 60
ELEVATED_TTL = 10 * 60                     # 10 min
REPLAY_TTL = 90                            # caché anti-replay
AUTH_CODE_TTL = 60

auth_codes: dict[str, dict] = {}
tokens: dict[str, dict] = {}
replay_cache: dict[tuple[str, str], float] = {}

VAULT = {
    "secretos": [
        {"nombre": "Credenciales bancarias (demo)", "valor": "****-1234"},
        {"nombre": "Llave maestra", "valor": "lab-ultra-secreta-42"},
    ]
}


def now() -> float:
    return time.time()


def issue(kind: str, sub: str, ttl: int, mfa: bool = False) -> str:
    token = secrets.token_urlsafe(32)
    tokens[token] = {"sub": sub, "kind": kind, "mfa": mfa, "exp": now() + ttl}
    return token


def check(token: str, kind: str):
    data = tokens.get(token)
    if not data or data["kind"] != kind or data["exp"] < now():
        return None
    return data


def bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Falta el access_token")
    return authorization[7:]


def s256(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def totp_at(counter: int) -> str:
    """RFC 6238: HMAC-SHA1 + truncamiento dinámico."""
    key = base64.b32decode(TOTP_SECRET + "=" * (-len(TOTP_SECRET) % 8))
    h = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    off = h[19] & 0x0F
    code = ((h[off] & 0x7F) << 24) | ((h[off + 1] & 0xFF) << 16) | ((h[off + 2] & 0xFF) << 8) | (h[off + 3] & 0xFF)
    return f"{code % 1000000:06d}"


def purge_replay_cache() -> None:
    for key in [k for k, exp in replay_cache.items() if exp < now()]:
        del replay_cache[key]


# ---------- Fase 1: OAuth 2.0 + PKCE ----------

@app.get("/oauth/authorize", response_class=HTMLResponse)
def authorize(client_id: str, redirect_uri: str, state: str, code_challenge: str,
              code_challenge_method: str = "S256", response_type: str = "code"):
    if response_type != "code" or code_challenge_method != "S256":
        raise HTTPException(400, "Solo response_type=code y code_challenge_method=S256")
    return f"""<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Iniciar sesión</title></head>
<body style="font-family:sans-serif;max-width:360px;margin:60px auto;text-align:center">
<h2>UniSabana · Proveedor de identidad (lab)</h2>
<p>Cuenta de prueba: <b>{html.escape(USER)}</b></p>
<form method="post" action="/oauth/authorize/approve">
<input type="hidden" name="redirect_uri" value="{html.escape(redirect_uri)}">
<input type="hidden" name="state" value="{html.escape(state)}">
<input type="hidden" name="code_challenge" value="{html.escape(code_challenge)}">
<button style="padding:12px 24px;font-size:16px">Autorizar a la app</button>
</form></body></html>"""


@app.post("/oauth/authorize/approve")
def approve(redirect_uri: str = Form(...), state: str = Form(...), code_challenge: str = Form(...)):
    code = secrets.token_urlsafe(24)
    auth_codes[code] = {"challenge": code_challenge, "redirect_uri": redirect_uri, "exp": now() + AUTH_CODE_TTL}
    query = urllib.parse.urlencode({"code": code, "state": state})
    return RedirectResponse(f"{redirect_uri}?{query}", status_code=302)


class TokenRequest(BaseModel):
    code: str
    code_verifier: str
    redirect_uri: str


@app.post("/auth/oauth/token")
def token(req: TokenRequest):
    entry = auth_codes.pop(req.code, None)           # un solo uso
    if not entry or entry["exp"] < now() or entry["redirect_uri"] != req.redirect_uri:
        raise HTTPException(400, "invalid_grant")
    if not 43 <= len(req.code_verifier) <= 128:
        raise HTTPException(400, "code_verifier inválido")
    if not hmac.compare_digest(s256(req.code_verifier), entry["challenge"]):
        raise HTTPException(400, "PKCE: SHA256(code_verifier) != code_challenge")
    return {
        "access_token": issue("access", USER, ACCESS_TTL),
        "refresh_token": issue("refresh", USER, REFRESH_TTL),
        "token_type": "bearer",
        "expires_in": ACCESS_TTL,
    }


class RefreshRequest(BaseModel):
    refresh_token: str


@app.post("/auth/refresh")
def refresh(req: RefreshRequest):
    data = check(req.refresh_token, "refresh")
    if not data:
        raise HTTPException(401, "refresh_token inválido o vencido")
    return {"access_token": issue("access", data["sub"], ACCESS_TTL), "token_type": "bearer", "expires_in": ACCESS_TTL}


# ---------- Fase 2: Step-Up ----------

@app.get("/api/boveda-critica")
def boveda(authorization: str | None = Header(default=None)):
    data = check(bearer(authorization), "access")
    if not data:
        raise HTTPException(401, "access_token inválido o vencido")
    if not data["mfa"]:
        step_up = issue("step_up", data["sub"], STEP_UP_TTL)
        return JSONResponse(status_code=403, content={"error": "mfa_required", "step_up_token": step_up})
    return VAULT


class MfaRequest(BaseModel):
    step_up_token: str
    code: str


# ---------- Fase 3: verificación TOTP con ventanas C-1, C, C+1 y anti-replay ----------

@app.post("/auth/mfa/verify")
def mfa_verify(req: MfaRequest):
    step = check(req.step_up_token, "step_up")
    if not step:
        raise HTTPException(401, "step_up_token inválido o vencido")

    purge_replay_cache()
    key = (step["sub"], req.code)
    if key in replay_cache:
        raise HTTPException(409, "Replay Attack Detected")

    counter = int(now() // 30)
    if not any(hmac.compare_digest(totp_at(counter + d), req.code) for d in (-1, 0, 1)):
        raise HTTPException(401, "Código TOTP inválido")

    replay_cache[key] = now() + REPLAY_TTL
    tokens.pop(req.step_up_token, None)
    elevated = issue("access", step["sub"], ELEVATED_TTL, mfa=True)
    return {"elevated_token": elevated, "expires_in": ELEVATED_TTL}


@app.get("/health")
def health():
    return {"ok": True}


print("Semilla TOTP:", TOTP_SECRET)
print(f"otpauth://totp/UniSabana:{USER}?secret={TOTP_SECRET}&issuer=UniSabana")
