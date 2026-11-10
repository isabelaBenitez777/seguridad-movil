# Laboratorio: Seguridad Móvil (OAuth 2.0 + PKCE, SecureStore, TOTP propio, Step-Up)

Estructura:
- `backend-auth/` → API ligera en FastAPI (OAuth/PKCE, refresh, Step-Up, anti-replay).
- `mobile-app/`   → App Expo + TypeScript (login con navegador del sistema, TOTP offline, bóveda).

## 1. Backend

```bash
cd backend-auth
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Al iniciar imprime la semilla y la URI `otpauth://` para agregarla en Google Authenticator.

Semilla de prueba: `JBSWY3DPEHPK3PXP`

## 2. App móvil

```bash
cd mobile-app
npm install
npx expo install expo-crypto expo-secure-store expo-linking expo-web-browser   # alinea versiones con tu SDK
```

Configura la URL del backend (opcional; por defecto `http://10.0.2.2:8000`, la IP del emulador Android):
```bash
# .env en mobile-app/
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```
- Emulador iOS: `http://localhost:8000`
- Teléfono físico: `http://IP_DE_TU_PC:8000` (ambos en la misma red)

Para que el deep link `unisabana-auth://callback` funcione de verdad, usa un development build
(Expo Go no reconoce tu esquema propio):
```bash
npx expo run:android   # o npx expo run:ios
```

## 3. Pruebas de aceptación

| # | Prueba | Cómo verificarla |
|---|--------|------------------|
| 1 | OAuth + PKCE | Iniciar sesión abre el navegador del sistema; al volver, la app guarda el refresh_token en SecureStore. |
| 2 | Paridad TOTP | Agrega la semilla en Google Authenticator y compara los 6 dígitos. |
| 3 | Offline | Activa modo avión; el código cambia cada 30 s sin red. |
| 4 | Step-Up | Abrir "Bóveda Crítica" → 403 → modal → código → acceso. |
| 5 | Anti-replay | Reenviar el mismo código dentro de los 30 s → 409 "Replay Attack Detected". |

## 4. Verificación del algoritmo TOTP

Vector de prueba RFC 6238 (SHA-1): semilla Base32 `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ` (la cadena "12345678901234567890"), tiempo T=59 s → código de 8 dígitos `94287082`, es decir, **6 dígitos: `287082`**.
