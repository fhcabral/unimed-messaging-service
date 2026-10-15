import { ExamStatus } from '../../../contexts/exams/entities/exam.entity';
import { EXAM_NOTIFICATION_CONTENT } from '../../../contexts/exams/exam-notification.constants';

export const DEMO_TEMPLATE = {
  id: 'a1100000-0000-4000-8000-000000000001',
  name: 'Resultados de exames disponíveis',
  content: EXAM_NOTIFICATION_CONTENT,
  subject: null,
};

export const DEMO_PATIENTS = [
  {
    id: 'b2200000-0000-4000-8000-000000000001',
    name: 'João Silva (fictício)',
    phone: '+5549999990101',
    email: 'joao@example.test',
  },
  {
    id: 'b2200000-0000-4000-8000-000000000002',
    name: 'Maria Souza (fictícia)',
    phone: '+5549999990102',
    email: 'maria@example.test',
  },
  {
    id: 'b2200000-0000-4000-8000-000000000003',
    name: 'Ana Lima (fictícia)',
    phone: '+5549999990103',
    email: 'ana@example.test',
  },
];

export const DEMO_EXAMS = [
  {
    id: 'c3300000-0000-4000-8000-000000000001',
    patientId: DEMO_PATIENTS[0].id,
    status: ExamStatus.RELEASED,
  },
  {
    id: 'c3300000-0000-4000-8000-000000000002',
    patientId: DEMO_PATIENTS[1].id,
    status: ExamStatus.PENDING,
  },
  {
    id: 'c3300000-0000-4000-8000-000000000003',
    patientId: DEMO_PATIENTS[2].id,
    status: ExamStatus.RELEASED,
  },
  {
    id: 'c3300000-0000-4000-8000-000000000004',
    patientId: DEMO_PATIENTS[0].id,
    status: ExamStatus.PENDING,
  },
];
