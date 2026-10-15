import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam, NotificationStatus } from './entities/exam.entity';
import { ListExamsDto } from './dto/list-exams.dto';
import { RECONCILIATION_AFTER_MS } from './exam-notification.constants';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam) private readonly exams: Repository<Exam>,
  ) {}

  async findAll({ page, limit, status, notificationStatus }: ListExamsDto) {
    const [data, total] = await this.exams.findAndCount({
      where: { status, notificationStatus },
      relations: { patient: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: data.map((exam) => ({
        ...exam,
        reconciliationRequired:
          exam.notificationStatus === NotificationStatus.PROCESSING &&
          (!exam.processingStartedAt ||
            Date.now() - exam.processingStartedAt.getTime() >=
              RECONCILIATION_AFTER_MS),
      })),
      total,
      page,
      limit,
    };
  }
}
