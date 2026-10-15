import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { CreateTemplateDto } from './dto/create-template.dto';
import { MessageTemplate } from './entities/message-template.entity';
import { TemplatesService } from './templates.service';

describe('Templates', () => {
  it('validates and persists a template with repeated supported placeholders', async () => {
    const dto = plainToInstance(CreateTemplateDto, {
      name: ' Avaliação fictícia ',
      content: 'Olá, {{name}}! Obrigado, {{name}}.',
    });
    expect(await validate(dto)).toHaveLength(0);
    const save = jest.fn().mockResolvedValue({ id: 'template', ...dto });
    const service = new TemplatesService({
      create: (value: CreateTemplateDto) => value,
      save,
    } as unknown as Repository<MessageTemplate>);
    await expect(service.create(dto)).resolves.toMatchObject({
      name: 'Avaliação fictícia',
    });
    expect(save).toHaveBeenCalledWith(dto);
  });

  it.each([
    'Olá {{phone}}',
    '{{ name }}',
    '{{name}',
    '{{{name}}}',
    'texto {solto}',
    '{{name}}{{unknown}}',
    '   ',
  ])(
    'rejects unsupported or malformed placeholders and blank content: %s',
    async (content) => {
      const dto = plainToInstance(CreateTemplateDto, {
        name: 'Fictício',
        content,
      });
      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});
