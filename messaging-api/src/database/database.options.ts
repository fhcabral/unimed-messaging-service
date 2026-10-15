import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Patient } from '../contexts/patients/entities/patient.entity';
import { MessageTemplate } from '../contexts/templates/entities/message-template.entity';
import { Message } from '../contexts/messages/entities/message.entity';
import { InitialSchema1792022400000 } from './migrations/1792022400000-initial-schema';
import { Multichannel1792022401000 } from './migrations/1792022401000-multichannel';

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
    migrations: [InitialSchema1792022400000, Multichannel1792022401000],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}
