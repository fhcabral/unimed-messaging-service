import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parse } from 'csv-parse/sync';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { ListPatientsDto } from './dto/list-patients.dto';

export const MAX_CSV_BYTES = 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
  ) {}

  async importCsv(buffer: Buffer) {
    if (buffer.length > MAX_CSV_BYTES)
      throw new BadRequestException('CSV limitado a 1 MiB.');
    let rows: string[][];
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (text.includes('\0')) throw new Error('Binary content');
      rows = parse(text, {
        bom: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
      });
    } catch {
      throw new BadRequestException(
        'CSV malformado. Utilize UTF-8 e separador vírgula.',
      );
    }
    const headers = rows.shift();
    if (
      !headers ||
      headers.filter((h) => h === 'name').length !== 1 ||
      headers.filter((h) => h === 'phone').length !== 1
    ) {
      throw new BadRequestException(
        'CSV deve conter as colunas name e phone, sem duplicatas.',
      );
    }
    rows = rows.filter((row) => row.some((cell) => cell.trim() !== ''));
    if (rows.length > MAX_IMPORT_ROWS)
      throw new BadRequestException(
        `CSV limitado a ${MAX_IMPORT_ROWS} registros.`,
      );
    const values: Pick<Patient, 'name' | 'phone'>[] = [];
    let invalid = 0;
    for (const row of rows) {
      const name = row[headers.indexOf('name')]?.trim();
      const rawPhone = row[headers.indexOf('phone')]?.trim() ?? '';
  
      const phone = /^[+\d\s().-]+$/.test(rawPhone)
        ? parsePhoneNumberFromString(rawPhone, 'BR')
        : undefined;
      if (
        row.length !== headers.length ||
        !name ||
        name.length > 160 ||
        [...name].some(
          (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
        ) ||
        !phone ||
        phone.country !== 'BR' ||
        !phone.isValid()
      ) {
        invalid++;
        continue;
      }
      values.push({ name, phone: phone.number });
    }
    let imported = 0;
    if (values.length) {
      
      const result = await this.patients
        .createQueryBuilder()
        .insert()
        .into(Patient)
        .values(values)
        .orIgnore()
        .returning('id')
        .execute();
      const inserted: unknown = result.raw;
      imported = Array.isArray(inserted) ? inserted.length : 0;
    }
    return { imported, ignored: values.length - imported, invalid };
  }

  async findAll({ page, limit, search }: ListPatientsDto) {
    const query = this.patients.createQueryBuilder('patient');
    if (search) {
      const escaped = search.replace(/[\\%_]/g, '\\$&');
      query.where(
        '(patient.name ILIKE :search OR patient.phone ILIKE :search)',
        { search: `%${escaped}%` },
      );
    }
    const [data, total] = await query
      .orderBy('patient.createdAt', 'DESC')
      .addOrderBy('patient.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit };
  }
}
