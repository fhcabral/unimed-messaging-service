import { ExamStatus } from '../../../contexts/exams/entities/exam.entity';

export type DemoScenario = 'pending' | 'released' | 'failed';
export type DemoCommand = DemoScenario | 'reset';

export interface ScenarioRecord {
  patient: { id: string; name: string; phone: string; email: string };
  exam: { id: string; patientId: string; status: ExamStatus };
}

function records(
  scenario: DemoScenario,
  start: number,
  status: ExamStatus,
): ScenarioRecord[] {
  return ['Alice', 'Bruno', 'Carla'].map((name, index) => {
    const suffix = String(start + index);
    const patientId = `d4400000-0000-4000-8000-000000000${suffix}`;
    return {
      patient: {
        id: patientId,
        name: `[Demo ${scenario}] ${name} (fictício)`,
        phone: `+5549999990${suffix}`,
        email: `scenario.${scenario}.${index + 1}@example.test`,
      },
      exam: {
        id: `e5500000-0000-4000-8000-000000000${suffix}`,
        patientId,
        status,
      },
    };
  });
}

export const DEMO_SCENARIOS: Record<
  DemoScenario,
  { label: string; records: ScenarioRecord[] }
> = {
  pending: {
    label: 'Exames pendentes',
    records: records('pending', 201, ExamStatus.PENDING),
  },
  released: {
    label: 'Exames liberados',
    records: records('released', 301, ExamStatus.RELEASED),
  },
  failed: {
    label: 'Falha de notificação',
    records: records('failed', 401, ExamStatus.RELEASED),
  },
};

export const SCENARIO_RECORDS = Object.values(DEMO_SCENARIOS).flatMap(
  (scenario) => scenario.records,
);

// Only this exam/patient/contact combination opts into the deterministic failure.
export const DEMO_FAILURE_RECIPIENT = DEMO_SCENARIOS.failed.records[0];

export function notificationKey(examId: string) {
  return `exam:${examId}:RESULT_SMS`;
}
