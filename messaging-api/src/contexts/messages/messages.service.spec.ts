import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { MessageTemplate } from '../templates/entities/message-template.entity';
import { Message, MessageStatus } from './entities/message.entity';
import { MessagesService } from './messages.service';
import { MockSmsProvider } from './providers/mock-sms.provider';

describe('MessagesService', () => {
  const patients = [
    { id: 'patient-1', name: 'Paciente Fictício $&', phone: '+5511999990001' },
    {
      id: 'patient-2',
      name: 'Paciente Fictício Beta',
      phone: '+5521999990002',
    },
  ];
  const template = {
    id: 'template',
    content: 'Olá {{name}}, obrigado {{name}}!',
  };
  const save = jest.fn();
  const findBy = jest.fn();
  const findOneBy = jest.fn();
  const provider = new MockSmsProvider(
    new ConfigService({ SMS_MOCK_FAIL_ALL: 'false' }),
  );
  let send: jest.SpyInstance<Promise<void>, [string, string]>;
  const service = new MessagesService(
    {
      create: (value: Partial<Message>) => ({ id: 'message', ...value }),
      save,
    } as unknown as Repository<Message>,
    { findBy } as unknown as Repository<Patient>,
    { findOneBy } as unknown as Repository<MessageTemplate>,
    provider,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    send = jest.spyOn(provider, 'send');
    save.mockImplementation((value: Message) => Promise.resolve({ ...value }));
    findBy.mockResolvedValue(patients);
    findOneBy.mockResolvedValue(template);
  });

  it('interpolates every name literally, saves PENDING then SENT with the real mock', async () => {
    await expect(
      service.send({
        templateId: 'template',
        patientIds: ['patient-1', 'patient-2'],
      }),
    ).resolves.toEqual({ total: 2, sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledWith(
      patients[0].phone,
      'Olá Paciente Fictício $&, obrigado Paciente Fictício $&!',
    );
    expect(save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: MessageStatus.PENDING, sentAt: null }),
    );
    expect(save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: MessageStatus.SENT,
        sentAt: expect.any(Date) as Date,
      }),
    );
  });

  it('records a safe FAILED error and continues sending after an individual rejection', async () => {
    send.mockRejectedValueOnce(new Error('Sensitive provider response'));
    await expect(
      service.send({
        templateId: 'template',
        patientIds: ['patient-1', 'patient-2'],
      }),
    ).resolves.toEqual({ total: 2, sent: 1, failed: 1 });
    expect(save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: MessageStatus.FAILED,
        sentAt: null,
        error: 'O provider mock rejeitou o envio simulado.',
      }),
    );
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not send or persist anything when any requested patient is missing', async () => {
    findBy.mockResolvedValue([patients[0]]);
    await expect(
      service.send({
        templateId: 'template',
        patientIds: ['patient-1', 'missing'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(save).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects an unknown template before creating messages', async () => {
    findOneBy.mockResolvedValue(null);
    await expect(
      service.send({ templateId: 'missing', patientIds: ['patient-1'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(save).not.toHaveBeenCalled();
  });

  it('provides deterministic failure simulation without sending real SMS', async () => {
    const failing = new MockSmsProvider(
      new ConfigService({ SMS_MOCK_FAIL_ALL: 'true' }),
    );
    await expect(
      failing.send(patients[0].phone, 'Mensagem fictícia'),
    ).rejects.toThrow('Simulated provider rejection');
  });
});
