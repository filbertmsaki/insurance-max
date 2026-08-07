import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { RegulatoryObligationStatus } from '@insurance-max/contracts';
import { LessThan, Repository } from 'typeorm';

import { RegulatoryObligationInstance } from '../entities/regulatory-obligation-instance.entity';

@Injectable()
export class RegulatoryMonitorJob {
  private readonly logger = new Logger(RegulatoryMonitorJob.name);

  constructor(
    @InjectRepository(RegulatoryObligationInstance)
    private readonly obligationRepository: Repository<RegulatoryObligationInstance>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshOverdueStatuses() {
    const overdue = await this.obligationRepository.find({
      where: {
        status: RegulatoryObligationStatus.UPCOMING,
        due_at: LessThan(new Date()),
      },
      take: 200,
    });

    for (const obligation of overdue) {
      obligation.status = RegulatoryObligationStatus.OVERDUE;
      await this.obligationRepository.save(obligation);
    }

    const dueToday = await this.obligationRepository
      .createQueryBuilder('obligation')
      .where('obligation.status = :status', {
        status: RegulatoryObligationStatus.UPCOMING,
      })
      .andWhere('DATE(obligation.due_at) = CURRENT_DATE')
      .take(200)
      .getMany();

    for (const obligation of dueToday) {
      obligation.status = RegulatoryObligationStatus.DUE;
      await this.obligationRepository.save(obligation);
    }

    if (overdue.length > 0) {
      this.logger.log(
        `Marked ${overdue.length} regulatory obligations overdue`,
      );
    }

    if (dueToday.length > 0) {
      this.logger.log(
        `Marked ${dueToday.length} regulatory obligations due today`,
      );
    }
  }
}
