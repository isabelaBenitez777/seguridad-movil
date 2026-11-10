/**
 * TOTP (RFC 6238) implementado desde cero.
 * Solo se usa expo-crypto como utilidad de hashing (SHA-1 y aleatoriedad).
 * No requiere red: funciona en modo avión.
 */
import * as Crypto from 'expo-crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32ToBytes(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  if (clean.length === 0) throw new Error('La semilla está vacía');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error(`Carácter inválido en la semilla: ${ch}`);
    buffer = ((buffer << 5) | idx) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >>> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

const concat = (a: Uint8Array, b: Uint8Array) => {
  const r = new Uint8Array(a.length + b.length);
  r.set(a, 0);
  r.set(b, a.length);
  return r;
};

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA1, data);
  return new Uint8Array(digest);
}

// HMAC(K, m) = H((K ⊕ opad) || H((K ⊕ ipad) || m))  — RFC 2104
async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const BLOCK = 64;
  const k = key.length > BLOCK ? await sha1(key) : key;
  const padded = new Uint8Array(BLOCK);
  padded.set(k, 0);
  const ipad = padded.map((b) => b ^ 0x36);
  const opad = padded.map((b) => b ^ 0x5c);
  const inner = await sha1(concat(ipad, message));
  return sha1(concat(opad, inner));
}

export async function generateTotp(secretBase32: string, timeMs: number = Date.now()): Promise<string> {
  const key = base32ToBytes(secretBase32);
  const counter = Math.floor(timeMs / 1000 / 30);           // T = floor(UnixTime / 30)

  const msg = new Uint8Array(8);                             // entero de 64 bits big-endian
  const view = new DataView(msg.buffer);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter % 0x100000000);

  const h = await hmacSha1(key, msg);                        // H = HMAC-SHA1(K, T)

  const offset = h[19] & 0x0f;                               // truncamiento dinámico
  const binCode =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);

  return String(binCode % 1000000).padStart(6, '0');
}

export const secondsRemaining = (timeMs: number = Date.now()) => 30 - (Math.floor(timeMs / 1000) % 30);
