import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_URL, REDIRECT_URI } from '../config';
import { codeChallengeFromVerifier, generateCodeVerifier, randomState } from '../crypto/pkce';
import { setAccessToken } from '../api/client';
import { saveRefreshToken } from '../storage/session';

WebBrowser.maybeCompleteAuthSession();

export async function loginWithOAuth(): Promise<void> {
  // 1) PKCE y state (anti-CSRF) generados por solicitud
  const verifier = await generateCodeVerifier(64);
  const challenge = await codeChallengeFromVerifier(verifier);
  const state = await randomState();

  const params = new URLSearchParams({
    client_id: 'unisabana-mobile',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  // 2) Navegador seguro del sistema (nunca WebView)
  const result = await WebBrowser.openAuthSessionAsync(
    `${API_URL}/oauth/authorize?${params.toString()}`,
    REDIRECT_URI
  );
  if (result.type !== 'success') throw new Error('Inicio de sesión cancelado');

  // 3) Validar state antes de cualquier intercambio
  const { queryParams } = Linking.parse(result.url);
  if (queryParams?.state !== state) {
    throw new Error('El parámetro state no coincide: se aborta (posible CSRF)');
  }
  const code = queryParams?.code;
  if (typeof code !== 'string') throw new Error('No llegó authorization code');

  // 4) Intercambio: authorization_code + code_verifier
  const res = await fetch(`${API_URL}/auth/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: REDIRECT_URI }),
  });
  if (!res.ok) throw new Error('El intercambio de token falló');
  const data = await res.json();

  await saveRefreshToken(data.refresh_token); // duradero, cifrado por hardware
  setAccessToken(data.access_token);          // volátil, en memoria
}
