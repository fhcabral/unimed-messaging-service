import { MigrationInterface, QueryRunner } from 'typeorm';

export class Multichannel1792022401000 implements MigrationInterface {
  name = 'Multichannel1792022401000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "patients" ALTER COLUMN "phone" DROP NOT NULL',
    );
    await queryRunner.query('ALTER TABLE "patients" ADD "email" varchar(254)');
    await queryRunner.query(
      'ALTER TABLE "patients" ADD CONSTRAINT "UQ_patients_email" UNIQUE ("email")',
    );
    await queryRunner.query(
      'ALTER TABLE "patients" ADD CONSTRAINT "CHK_patients_contact" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL)',
    );
    await queryRunner.query(
      'ALTER TABLE "message_templates" ADD "subject" varchar(255)',
    );
    await queryRunner.query(
      `CREATE TYPE "message_channel_enum" AS ENUM ('SMS', 'EMAIL')`,
    );
    // Existing history belongs to the unchanged SMS mock flow.
    await queryRunner.query(
      `ALTER TABLE "messages" ADD "channel" "message_channel_enum" NOT NULL DEFAULT 'SMS'`,
    );
    await queryRunner.query(
      'ALTER TABLE "messages" ADD "subject" varchar(255)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows: unknown = await queryRunner.query(
      'SELECT EXISTS (SELECT 1 FROM "patients" WHERE "phone" IS NULL) AS "emailOnly"',
    );
    if ((rows as { emailOnly: boolean }[])[0]?.emailOnly) {
      throw new Error(
        'Não é possível reverter: existem pacientes sem telefone. Complete os contatos antes de remover o suporte a e-mail.',
      );
    }
    await queryRunner.query(
      'ALTER TABLE "messages" DROP COLUMN "subject", DROP COLUMN "channel"',
    );
    await queryRunner.query('DROP TYPE "message_channel_enum"');
    await queryRunner.query(
      'ALTER TABLE "message_templates" DROP COLUMN "subject"',
    );
    await queryRunner.query(
      'ALTER TABLE "patients" DROP CONSTRAINT "CHK_patients_contact", DROP CONSTRAINT "UQ_patients_email", DROP COLUMN "email"',
    );
    await queryRunner.query(
      'ALTER TABLE "patients" ALTER COLUMN "phone" SET NOT NULL',
    );
  }
}
