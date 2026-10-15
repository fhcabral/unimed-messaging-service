import { api } from './api';
import type { CreateTemplateInput, MessageTemplate } from '../types';

export const DEFAULT_EMAIL_SUBJECT = 'Mensagem de acompanhamento';

export async function listTemplates(signal?: AbortSignal) {
  const { data } = await api.get<MessageTemplate[]>('/templates', { signal });
  return data;
}

export async function createTemplate(input: CreateTemplateInput) {
  const { data } = await api.post<MessageTemplate>('/templates', input);
  return data;
}
