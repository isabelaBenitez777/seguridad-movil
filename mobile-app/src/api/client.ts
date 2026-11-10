import { API_URL } from '../config';
import { clearSession, getRefreshToken } from '../storage/session';

// access_token vive SOLO en memoria (se pierde al cerrar el proceso)
let accessToken: string | null = null;
// Cola de renovación: todas las peticiones 401 comparten esta misma promesa
let renewal: Promise<boolean> | null = null;
let onExpired: (() => void) | null = null;

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const setSessionExpiredHandler = (fn: () => void) => {
  onExpired = fn;
};

async function rawRequest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

/** Silent Refresh: una sola petición POST /auth/refresh para todas las llamadas en vuelo. */
export function refreshAccessToken(): Promise<boolean> {
  if (!renewal) {
    renewal = (async () => {
      try {
        const rt = await getRefreshToken();
        if (!rt) throw new Error('sin refresh_token');
        const data = await rawRequest('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: rt }),
        });
        accessToken = data.access_token;
        return true;
      } catch {
        await clearSession();
        accessToken = null;
        onExpired?.();
        return false;
      } finally {
        renewal = null;
      }
    })();
  }
  return renewal;
}

/** Wrapper de fetch con interceptor 401 → renovar → reintentar. */
export async function api(path: string, init: RequestInit = {}) {
  try {
    return await rawRequest(path, init);
  } catch (e) {
    const isAuthRoute = path.startsWith('/auth/');
    if (e instanceof ApiError && e.status === 401 && !isAuthRoute) {
      const ok = await refreshAccessToken();
      if (!ok) throw e;
      return rawRequest(path, init);
    }
    throw e;
  }
}
