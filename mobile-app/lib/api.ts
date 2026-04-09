import { auth } from './firebase';

const explicitBase = process.env.EXPO_PUBLIC_API_URL;
const deployedBase = 'https://forever-yours-969e5cdd.onrender.com/api';

export const API_BASE_URL =
  explicitBase ||
  deployedBase;

export const SOCKET_URL = API_BASE_URL.replace(/\/api$/, '');

export function resolveAssetUrl(assetPath?: string | null) {
  if (!assetPath) return undefined;
  const trimmedPath = assetPath.trim();
  if (!trimmedPath) return undefined;

  // Preserve fully-qualified and device-local URIs so native viewers can open them directly.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedPath)) {
    return trimmedPath;
  }

  const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
  return `${SOCKET_URL}${normalizedPath}`;
}

async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload
        ? (payload.error || payload.message || `API Error: ${response.status}`)
        : `API Error: ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    }),
  put: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    }),
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, {
      method: 'DELETE',
    }),
};
