import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1792022400000 implements MigrationInterface {
  name = 'InitialSchema1792022400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "patients" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" varchar(160) NOT NULL,
      "phone" varchar(16) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_patients" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_patients_phone" UNIQUE ("phone")
    )`);
    await queryRunner.query(`CREATE TABLE "message_templates" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" varchar(120) NOT NULL,
      "content" text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_message_templates" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE TYPE "message_status_enum" AS ENUM ('PENDING', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(`CREATE TABLE "messages" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "patientId" uuid NOT NULL,
      "templateId" uuid NOT NULL,
      "content" text NOT NULL,
      "status" "message_status_enum" NOT NULL DEFAULT 'PENDING',
      "error" text,
      "sentAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
      CONSTRAINT "FK_messages_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_messages_template" FOREIGN KEY ("templateId") REFERENCES "message_templates"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_createdAt" ON "messages" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_patientId" ON "messages" ("patientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_templateId" ON "messages" ("templateId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "messages"');
    await queryRunner.query('DROP TYPE "message_status_enum"');
    await queryRunner.query('DROP TABLE "message_templates"');
    await queryRunner.query('DROP TABLE "patients"');
  }
}
