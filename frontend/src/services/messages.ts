import { api } from './api';
import type { SendMessagesInput, SendResult } from '../types';

export const MAX_SEND_PATIENTS = 100;

export async function sendMessages(input: SendMessagesInput) {
  // The API sends synchronously. Do not time out or automatically retry a batch.
  const { data } = await api.post<SendResult>('/messages/send', input, { timeout: 0 });
  return data;
}
