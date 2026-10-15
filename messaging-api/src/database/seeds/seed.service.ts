import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Patient } from '../../contexts/patients/entities/patient.entity';
import { MessageTemplate } from '../../contexts/templates/entities/message-template.entity';
import { Exam } from '../../contexts/exams/entities/exam.entity';
import { DEMO_EXAMS, DEMO_PATIENTS, DEMO_TEMPLATE } from './data/demo-data';

@Injectable()
export class SeedService {
  constructor(
    private readonly database: DataSource,
    private readonly config: ConfigService,
  ) {}

  async run() {
    if (
      this.config.get<string>('NODE_ENV') === 'production' ||
      this.config.get<string>('DEMO_SEED_ENABLED', 'false') !== 'true'
    )
      return;
    await this.database.transaction(async (manager) => {
      // Serialize demo preparation across backend instances, without modifying existing records.
      await manager.query('SELECT pg_advisory_xact_lock(179202, 2402)');
      await manager
        .createQueryBuilder()
        .insert()
        .into(Patient)
        .values(DEMO_PATIENTS)
        .updateEntity(false)
        .orIgnore()
        .execute();
      await manager
        .createQueryBuilder()
        .insert()
        .into(MessageTemplate)
        .values(DEMO_TEMPLATE)
        .updateEntity(false)
        .orIgnore()
        .execute();
      for (const exam of DEMO_EXAMS) {
        // A conflicting contact may belong to a user's record. Never reassign it by list order/contact.
        if (
          await manager.getRepository(Patient).existsBy({ id: exam.patientId })
        ) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(Exam)
            .values(exam)
            .updateEntity(false)
            .orIgnore()
            .execute();
        }
      }
    });
  }
}
