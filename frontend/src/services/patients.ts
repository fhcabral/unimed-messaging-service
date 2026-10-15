import { api } from './api';
import type { ImportResult, PaginatedResponse, Patient, PatientQuery } from '../types';

export const MAX_CSV_BYTES = 1024 * 1024;

export async function listPatients(query: PatientQuery, signal?: AbortSignal) {
  const { data } = await api.get<PaginatedResponse<Patient>>('/patients', {
    params: query,
    signal,
  });
  return data;
}

export async function importPatients(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ImportResult>('/patients/import', form, { timeout: 30000 });
  return data;
}

export async function deletePatients(patientIds: string[]) {
  const { data } = await api.post<{ deleted: number }>('/patients/bulk-delete', { patientIds });
  return data;
}
