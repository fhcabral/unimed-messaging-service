export interface Patient {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PatientQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface ImportResult {
  imported: number;
  ignored: number;
  invalid: number;
}

export interface CreateTemplateInput {
  name: string;
  content: string;
}

export interface SendMessagesInput {
  templateId: string;
  patientIds: string[];
}

export interface SendResult {
  total: number;
  sent: number;
  failed: number;
}
