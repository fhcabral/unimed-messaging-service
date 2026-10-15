import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Patient } from '../patients/entities/patient.entity';
import { MessageTemplate } from '../templates/entities/message-template.entity';
import { Message } from '../messages/entities/message.entity';
import { InitialSchema1792022400000 } from './migrations/1792022400000-initial-schema';

export function databaseOptions(
  env: Record<string, unknown>,
): PostgresConnectionOptions {
  return {
    type: 'postgres',
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    host: String(env.DB_HOST),
    port: Number(env.DB_PORT),
    username: String(env.DB_USERNAME),
    password: String(env.DB_PASSWORD),
    database: String(env.DB_DATABASE),
    entities: [Patient, MessageTemplate, Message],
    migrations: [InitialSchema1792022400000],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}
