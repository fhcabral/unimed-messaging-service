import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

export function getApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
    if (!error.response) {
      return 'Não foi possível confirmar a resposta da API. Verifique a conexão e se o back-end está em execução.';
    }
    if (error.response.status >= 500) return fallback;
    const message = error.response.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}
