import { DataSource, EntityManager, In } from 'typeorm';
import { Patient } from '../../../contexts/patients/entities/patient.entity';
import {
  Exam,
  NotificationStatus,
} from '../../../contexts/exams/entities/exam.entity';
import {
  Message,
  MessageChannel,
  MessageStatus,
} from '../../../contexts/messages/entities/message.entity';
import {
  DEMO_SCENARIOS,
  DemoCommand,
  SCENARIO_RECORDS,
  ScenarioRecord,
  notificationKey,
} from './demo-data';

export class DemoScenarioError extends Error {}

function assertOwnedPatient(patient: Patient, record: ScenarioRecord) {
  if (patient.email !== record.patient.email) {
    throw new DemoScenarioError(
      'Um identificador reservado ao cenário pertence a outro cadastro. Nenhum dado foi alterado.',
    );
  }
}

async function prepare(
  manager: EntityManager,
  command: Exclude<DemoCommand, 'reset'>,
) {
  const scenario = DEMO_SCENARIOS[command];
  const result = {
    scenario: scenario.label,
    patientsCreated: 0,
    examsCreated: 0,
    existingRecords: 0,
  };
  for (const record of scenario.records) {
    let patient = await manager.getRepository(Patient).findOne({
      where: { id: record.patient.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!patient) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(Patient)
        .values(record.patient)
        .updateEntity(false)
        .orIgnore()
        .execute();
      patient = await manager.getRepository(Patient).findOne({
        where: { id: record.patient.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!patient)
        throw new DemoScenarioError(
          'Um contato fictício do cenário já pertence a outro cadastro. Nenhum dado foi alterado.',
        );
      result.patientsCreated++;
    } else {
      result.existingRecords++;
    }
    assertOwnedPatient(patient, record);
    const exam = await manager.getRepository(Exam).findOne({
      where: { id: record.exam.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (exam) {
      if (exam.patientId !== patient.id)
        throw new DemoScenarioError(
          'Um identificador de exame do cenário já está em uso por outro paciente. Nenhum dado foi alterado.',
        );
      result.existingRecords++;
    } else {
      // No notification/history mutation: a repeated command must preserve SENT and FAILED.
      await manager.insert(Exam, { ...record.exam });
      result.examsCreated++;
    }
  }
  return result;
}

async function reset(manager: EntityManager) {
  const patientIds = SCENARIO_RECORDS.map((record) => record.patient.id);
  const examIds = SCENARIO_RECORDS.map((record) => record.exam.id);
  const patients = await manager.getRepository(Patient).find({
    where: { id: In(patientIds) },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_write' },
  });
  for (const patient of patients) {
    assertOwnedPatient(
      patient,
      SCENARIO_RECORDS.find((record) => record.patient.id === patient.id)!,
    );
  }
  const exams = await manager.getRepository(Exam).find({
    where: { id: In(examIds) },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_write' },
  });
  for (const exam of exams) {
    const record = SCENARIO_RECORDS.find(
      (record) => record.exam.id === exam.id,
    )!;
    if (exam.patientId !== record.patient.id)
      throw new DemoScenarioError(
        'Exame reservado vinculado a outro paciente. Reset cancelado sem alterações.',
      );
    if (exam.notificationStatus === NotificationStatus.PROCESSING)
      throw new DemoScenarioError(
        'Há notificações dos cenários em processamento ou com resultado incerto. Confira o histórico antes do reset. Nenhum dado foi removido.',
      );
  }
  const messages = await manager.getRepository(Message).find({
    where: { notificationKey: In(examIds.map(notificationKey)) },
    lock: { mode: 'pessimistic_write' },
  });
  for (const message of messages) {
    const record = SCENARIO_RECORDS.find(
      (record) => notificationKey(record.exam.id) === message.notificationKey,
    )!;
    if (
      message.patientId !== record.patient.id ||
      message.channel !== MessageChannel.SMS ||
      message.templateId !== null
    ) {
      throw new DemoScenarioError(
        'Uma chave reservada ao cenário está associada a outro histórico. Reset cancelado sem alterações.',
      );
    }
    if (message.status === MessageStatus.PENDING)
      throw new DemoScenarioError(
        'Há mensagens pendentes dos cenários. Confira o resultado antes do reset. Nenhum dado foi removido.',
      );
  }
  if (exams.length)
    await manager.delete(Exam, { id: In(exams.map((exam) => exam.id)) });
  if (messages.length)
    await manager.delete(Message, {
      id: In(messages.map((message) => message.id)),
    });
  let patientsRemoved = 0;
  for (const patient of patients) {
    // Preserve manual sends and external exams even when attached to a scenario patient.
    const hasExams = await manager
      .getRepository(Exam)
      .existsBy({ patientId: patient.id });
    const hasMessages = await manager
      .getRepository(Message)
      .existsBy({ patientId: patient.id });
    if (!hasExams && !hasMessages) {
      await manager.delete(Patient, patient.id);
      patientsRemoved++;
    }
  }
  return {
    scenario: 'Reset dos cenários',
    patientsRemoved,
    patientsPreserved: patients.length - patientsRemoved,
    examsRemoved: exams.length,
    messagesRemoved: messages.length,
  };
}

export function runDemoScenario(database: DataSource, command: DemoCommand) {
  return database.transaction(async (manager) => {
    // Shared by all commands, independently of an already-running NestJS process.
    await manager.query('SELECT pg_advisory_xact_lock(179202, 2403)');
    return command === 'reset' ? reset(manager) : prepare(manager, command);
  });
}
