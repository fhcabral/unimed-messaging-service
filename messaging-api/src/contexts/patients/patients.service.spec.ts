import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { MAX_IMPORT_ROWS, PatientsService } from './patients.service';

describe('PatientsService CSV', () => {
  const execute = jest.fn();
  const values = jest.fn();
  const builder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values,
    orIgnore: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute,
  };
  const service = new PatientsService({
    createQueryBuilder: () => builder,
  } as unknown as Repository<Patient>);

  beforeEach(() => {
    jest.clearAllMocks();
    values.mockReturnValue(builder);
    execute.mockResolvedValue({ raw: [{ id: 'new-patient' }] });
  });

  it('imports UTF-8 CSV with BOM, quoted fields and a normalized Brazilian phone', async () => {
    const result = await service.importCsv(
      Buffer.from('\uFEFFname,phone\n"Paciente, Fictício",(11) 99999-0001\n\n'),
    );
    expect(result).toEqual({ imported: 1, ignored: 0, invalid: 0 });
    expect(values).toHaveBeenCalledWith([
      { name: 'Paciente, Fictício', phone: '+5511999990001', email: null },
    ]);
  });

  it('counts invalid records without discarding valid records', async () => {
    const csv =
      'name,phone\nPaciente Fictício,11999990001\n,11999990002\nOutro Fictício,abc\nExtra,11999990003,extra\nInternacional,+12025550123\nDDD inválido,00999990001\n';
    await expect(service.importCsv(Buffer.from(csv))).resolves.toEqual({
      imported: 1,
      ignored: 0,
      invalid: 5,
    });
  });

  it('counts duplicate phones as ignored using the database conflict result', async () => {
    await expect(
      service.importCsv(
        Buffer.from(
          'name,phone\nFictício A,11999990001\nFictício B,+5511999990001',
        ),
      ),
    ).resolves.toEqual({ imported: 1, ignored: 1, invalid: 0 });
    expect(builder.orIgnore).toHaveBeenCalled();
  });

  it.each([
    'name,address\nPaciente Fictício,a@invalid.test',
    'name,phone,phone\nA,1,2',
    'name,phone\n"unterminated,11999990001',
  ])('rejects missing/duplicate headers or malformed CSV', async (csv) => {
    await expect(service.importCsv(Buffer.from(csv))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects oversized imports before any database write', async () => {
    const csv =
      'name,phone\n' +
      'Paciente Fictício,11999990001\n'.repeat(MAX_IMPORT_ROWS + 1);
    await expect(service.importCsv(Buffer.from(csv))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.importCsv(Buffer.alloc(1024 * 1024 + 1)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
  });

  it('ignores empty rows and accepts header-only files', async () => {
    await expect(
      service.importCsv(Buffer.from('name,phone\n,\n\n')),
    ).resolves.toEqual({ imported: 0, ignored: 0, invalid: 0 });
    expect(execute).not.toHaveBeenCalled();
  });
});
