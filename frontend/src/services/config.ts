import { api } from './api';
import type { PublicConfig } from '../types';

export async function getPublicConfig(signal?: AbortSignal) {
  const { data } = await api.get<PublicConfig>('/config', { signal });
  if (data.emailProvider !== 'MOCK' && data.emailProvider !== 'SMTP') {
    throw new Error('Configuração pública de e-mail inválida.');
  }
  return data;
}
