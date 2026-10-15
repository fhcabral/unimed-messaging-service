import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageTemplate } from './entities/message-template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(MessageTemplate)
    private readonly templates: Repository<MessageTemplate>,
  ) {}

  create(dto: CreateTemplateDto) {
    return this.templates.save(this.templates.create(dto));
  }

  findAll() {
    return this.templates.find({ order: { createdAt: 'DESC', id: 'DESC' } });
  }
}
