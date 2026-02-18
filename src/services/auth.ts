import { User } from '@/types';
import { wsService } from './websocket';

const TOKEN_KEY = 'chat.jwt';
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8443/ws/chat';

type AuthResponse = {
  token: string;
  user: User;
};

type WsErrorPayload = {
  message?: string;
  event?: string;
};

export class AuthWsError extends Error {
  event?: string;

  constructor(message: string, event?: string) {
    super(message);
    this.name = 'AuthWsError';
    this.event = event;
  }
}

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

async function waitAuthEvent<T>(successEvent: 'auth:login' | 'auth:register'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutMs = 12000;
    const timer = setTimeout(() => {
      offSuccess();
      offError();
      reject(new AuthWsError('Tiempo de espera agotado. Intenta nuevamente.', successEvent));
    }, timeoutMs);

    const offSuccess = wsService.on(successEvent, (data) => {
      clearTimeout(timer);
      offSuccess();
      offError();
      resolve(data as T);
    });

    const offError = wsService.on('error', (data: WsErrorPayload) => {
      if (data?.event && data.event !== successEvent) return;
      clearTimeout(timer);
      offSuccess();
      offError();
      reject(new AuthWsError(data?.message || 'No se pudo completar la autenticación.', data?.event));
    });
  });
}

export async function loginWithWs(usernameOrEmail: string, password: string): Promise<AuthResponse> {
  await connectForAuth();
  const responsePromise = waitAuthEvent<AuthResponse>('auth:login');
  wsService.send('auth:login', { usernameOrEmail, password });
  const response = await responsePromise;
  localStorage.setItem(TOKEN_KEY, response.token);
  return response;
}

export async function registerWithWs(username: string, displayName: string, email: string, password: string): Promise<AuthResponse> {
  await connectForAuth();
  const responsePromise = waitAuthEvent<AuthResponse>('auth:register');
  wsService.send('auth:register', { username, displayName, email, password });
  const response = await responsePromise;
  localStorage.setItem(TOKEN_KEY, response.token);
  return response;
}

export function logoutAuth() {
  localStorage.removeItem(TOKEN_KEY);
  wsService.disconnect();
}
