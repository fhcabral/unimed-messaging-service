import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesModule } from '../messages/messages.module';
import { Exam } from './entities/exam.entity';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamNotificationService } from './exam-notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([Exam]), MessagesModule],
  controllers: [ExamsController],
  providers: [ExamsService, ExamNotificationService],
  exports: [ExamNotificationService],
})
export class ExamsModule {}
