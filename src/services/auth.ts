import { User } from '@/types';
import { wsService } from './websocket';

const TOKEN_KEY = 'chat.jwt';
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8443/ws/chat';

type AuthResponse = {
  token: string;
  user: User;
};

function buildUrlWithToken(token?: string) {
  if (!token) return WS_BASE;
  const separator = WS_BASE.includes('?') ? '&' : '?';
  return `${WS_BASE}${separator}token=${encodeURIComponent(token)}`;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export async function connectWithToken(token?: string) {
  await wsService.connect(buildUrlWithToken(token || getStoredToken() || undefined));
}

async function connectForAuth() {
  // Login/registro deben abrir sin token para evitar bucles si hay un JWT viejo/inválido guardado.
  await wsService.connect(WS_BASE);
}

export async function loginWithWs(usernameOrEmail: string, password: string): Promise<AuthResponse> {
  await connectForAuth();
  const responsePromise = wsService.once<AuthResponse>('auth:login', 12000);
  wsService.send('auth:login', { usernameOrEmail, password });
  const response = await responsePromise;
  localStorage.setItem(TOKEN_KEY, response.token);
  return response;
}

export async function registerWithWs(username: string, displayName: string, email: string, password: string): Promise<AuthResponse> {
  await connectForAuth();
  const responsePromise = wsService.once<AuthResponse>('auth:register', 12000);
  wsService.send('auth:register', { username, displayName, email, password });
  const response = await responsePromise;
  localStorage.setItem(TOKEN_KEY, response.token);
  return response;
}

export function logoutAuth() {
  localStorage.removeItem(TOKEN_KEY);
  wsService.disconnect();
}
