import { api } from './api';
import type { Exam, ExamQuery, ExamProcessResult, PaginatedResponse } from '../types';

export async function listExams(query: ExamQuery, signal?: AbortSignal) {
  const { data } = await api.get<PaginatedResponse<Exam>>('/exams', { params: query, signal });
  return data;
}

export async function processPendingExams() {
  const { data } = await api.post<ExamProcessResult>('/exams/process-pending', undefined, { timeout: 0 });
  return data;
}

export async function retryFailedExam(id: string) {
  const { data } = await api.post<ExamProcessResult>(`/exams/${encodeURIComponent(id)}/retry`, undefined, { timeout: 0 });
  return data;
}
