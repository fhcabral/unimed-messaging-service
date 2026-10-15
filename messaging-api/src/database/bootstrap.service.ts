import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { SeedService } from './seeds/seed.service';
import { ExamNotificationService } from '../contexts/exams/exam-notification.service';

@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly seed: SeedService,
    private readonly notifications: ExamNotificationService,
  ) {}

  async onApplicationBootstrap() {
    // Migrations are an explicit setup step, never executed by the application.
    await this.seed.run();
    await this.notifications.processPending();
  }
}
