import { MigrationInterface, QueryRunner } from 'typeorm';

export class Exams1792022402000 implements MigrationInterface {
  name = 'Exams1792022402000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Automatic notifications use immutable content, independent of editable templates.
    await queryRunner.query(
      'ALTER TABLE "messages" ALTER COLUMN "templateId" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "messages" ADD "notificationKey" varchar(100)',
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_messages_active_notification" ON "messages" ("notificationKey") WHERE "status" IN ('PENDING', 'SENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "exam_status_enum" AS ENUM ('PENDING', 'RELEASED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "exam_notification_status_enum" AS ENUM ('NOT_ELIGIBLE', 'PENDING', 'PROCESSING', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(`CREATE TABLE "exams" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "patientId" uuid NOT NULL,
      "status" "exam_status_enum" NOT NULL DEFAULT 'PENDING',
      "releasedAt" timestamptz,
      "notificationStatus" "exam_notification_status_enum" NOT NULL DEFAULT 'NOT_ELIGIBLE',
      "notifiedAt" timestamptz,
      "notificationError" text,
      "processingStartedAt" timestamptz,
      "notificationMessageId" uuid UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_exams_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_exams_message" FOREIGN KEY ("notificationMessageId") REFERENCES "messages"("id") ON DELETE RESTRICT,
      CONSTRAINT "CHK_exams_eligibility" CHECK (
        ("status" = 'PENDING' AND "notificationStatus" = 'NOT_ELIGIBLE' AND "releasedAt" IS NULL) OR
        ("status" = 'RELEASED' AND "notificationStatus" <> 'NOT_ELIGIBLE' AND "releasedAt" IS NOT NULL)
      ),
      CONSTRAINT "CHK_exams_sent" CHECK (("notificationStatus" = 'SENT') = ("notifiedAt" IS NOT NULL))
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_exams_patientId" ON "exams" ("patientId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_exams_notification" ON "exams" ("status", "notificationStatus")',
    );
    // Release is performed by the source system/SQL in this MVP; no creation endpoint.
    await queryRunner.query(`CREATE FUNCTION exams_release_transition() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          IF OLD.status = 'RELEASED' AND NEW.status = 'PENDING' THEN
            RAISE EXCEPTION 'Released exams cannot return to PENDING';
          END IF;
          IF OLD.status = 'PENDING' AND NEW.status = 'RELEASED' THEN
            NEW."notificationStatus" := 'PENDING';
            NEW."releasedAt" := COALESCE(NEW."releasedAt", now());
          END IF;
        ELSIF NEW.status = 'RELEASED' THEN
          NEW."notificationStatus" := 'PENDING';
          NEW."releasedAt" := COALESCE(NEW."releasedAt", now());
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`);
    await queryRunner.query(
      'CREATE TRIGGER exams_release_transition BEFORE INSERT OR UPDATE ON "exams" FOR EACH ROW EXECUTE FUNCTION exams_release_transition()',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const automatic: unknown = await queryRunner.query(
      'SELECT EXISTS (SELECT 1 FROM "messages" WHERE "templateId" IS NULL)',
    );
    if ((automatic as { exists: boolean }[])[0]?.exists)
      throw new Error(
        'Não é possível reverter exames enquanto houver mensagens automáticas sem template. Preserve o histórico.',
      );
    await queryRunner.query('DROP TABLE "exams"');
    await queryRunner.query('DROP FUNCTION exams_release_transition()');
    await queryRunner.query('DROP TYPE "exam_notification_status_enum"');
    await queryRunner.query('DROP TYPE "exam_status_enum"');
    await queryRunner.query('DROP INDEX "UQ_messages_active_notification"');
    await queryRunner.query(
      'ALTER TABLE "messages" DROP COLUMN "notificationKey"',
    );
    await queryRunner.query(
      'ALTER TABLE "messages" ALTER COLUMN "templateId" SET NOT NULL',
    );
  }
}
