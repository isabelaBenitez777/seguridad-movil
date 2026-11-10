import * as Crypto from 'expo-crypto';

// Caracteres permitidos por RFC 7636: [A-Z] [a-z] [0-9] - . _ ~
const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

const toBase64Url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function generateCodeVerifier(length = 64): Promise<string> {
  if (length < 43 || length > 128) throw new Error('code_verifier fuera de rango (43-128)');
  const bytes = await Crypto.getRandomBytesAsync(length);
  return Array.from(bytes, (b) => UNRESERVED[b % UNRESERVED.length]).join('');
}

export async function codeChallengeFromVerifier(verifier: string): Promise<string> {
  const b64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return toBase64Url(b64);
}

export async function randomState(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
