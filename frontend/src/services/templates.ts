import { api } from './api';
import type { CreateTemplateInput, MessageTemplate } from '../types';

export async function listTemplates(signal?: AbortSignal) {
  const { data } = await api.get<MessageTemplate[]>('/templates', { signal });
  return data;
}

export async function createTemplate(input: CreateTemplateInput) {
  const { data } = await api.post<MessageTemplate>('/templates', input);
  return data;
}
