import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { RegulatoryObligation } from '../entities/regulatory-obligation.entity';
import { RegulatoryObligationStatus } from '../enums/regulatory.enums';

@Injectable()
export class RegulatoryMonitorJob {
  private readonly logger = new Logger(RegulatoryMonitorJob.name);

  constructor(
    @InjectRepository(RegulatoryObligation)
    private readonly obligationRepository: Repository<RegulatoryObligation>,
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

    if (overdue.length > 0) {
      this.logger.log(
        `Marked ${overdue.length} regulatory obligations overdue`,
      );
    }
  }
}
