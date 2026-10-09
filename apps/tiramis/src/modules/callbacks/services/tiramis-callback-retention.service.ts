import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { TiramisCallbackDeadLetterEntity } from '../entities/tiramis-callback-dead-letter.entity';
import { TiramisCallbackReceiptEntity } from '../entities/tiramis-callback-receipt.entity';

@Injectable()
export class TiramisCallbackRetentionService {
  private readonly logger = new Logger(TiramisCallbackRetentionService.name);
  private running = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(TiramisCallbackDeadLetterEntity)
    private readonly deadLetterRepository: Repository<TiramisCallbackDeadLetterEntity>,
    @InjectRepository(TiramisCallbackReceiptEntity)
    private readonly receiptRepository: Repository<TiramisCallbackReceiptEntity>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredDiagnostics(): Promise<{
    cutoff: Date;
    deadLettersDeleted: number;
    receiptsDeleted: number;
  } | null> {
    if (
      !this.configService.get<boolean>(
        'tiramisService.callbackDiagnosticsRetentionEnabled',
        true,
      )
    ) {
      return null;
    }

    if (this.running) {
      return null;
    }

    this.running = true;
    try {
      const retentionDays = this.configService.get<number>(
        'tiramisService.callbackDiagnosticsRetentionDays',
        180,
      );
      const cutoff = new Date(
        Date.now() - Math.max(retentionDays, 1) * 24 * 60 * 60 * 1000,
      );

      const deadLetters = await this.deadLetterRepository.delete({
        createdAt: LessThan(cutoff),
      });
      const receipts = await this.receiptRepository.delete({
        createdAt: LessThan(cutoff),
      });

      const result = {
        cutoff,
        deadLettersDeleted: deadLetters.affected ?? 0,
        receiptsDeleted: receipts.affected ?? 0,
      };

      if (result.deadLettersDeleted || result.receiptsDeleted) {
        this.logger.log(
          `Purged TIRAMIS callback diagnostics before ${cutoff.toISOString()}: deadLetters=${result.deadLettersDeleted}, receipts=${result.receiptsDeleted}`,
        );
      }

      return result;
    } finally {
      this.running = false;
    }
  }
}
