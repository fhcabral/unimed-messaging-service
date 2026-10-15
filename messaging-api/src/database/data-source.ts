import 'dotenv/config';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment';
import { databaseOptions } from './database.options';

export default new DataSource(
  databaseOptions(validateEnvironment(process.env)),
);
