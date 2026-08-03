import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { PremiumLedgerEntry } from '../entities/premium-ledger-entry.entity';
import { PremiumLedgerEntryStatus } from '../enums/regulatory.enums';

@Injectable()
export class PremiumLedgerService {
  constructor(
    @InjectRepository(PremiumLedgerEntry)
    private readonly ledgerRepository: Repository<PremiumLedgerEntry>,
  ) {}

  createEntry(entry: Partial<PremiumLedgerEntry>) {
    return this.ledgerRepository.save(this.ledgerRepository.create(entry));
  }

  async summarizeGrossPremium(
    companyId: string,
    periodStart: string,
    periodEnd: string,
    currency?: string,
  ) {
    const query = this.ledgerRepository
      .createQueryBuilder('entry')
      .select('COALESCE(SUM(entry.gross_written_premium), 0)', 'gross_premium')
      .where('entry.company_id = :companyId', { companyId })
      .andWhere('entry.status = :status', {
        status: PremiumLedgerEntryStatus.POSTED,
      })
      .andWhere('entry.transaction_date >= :periodStart', { periodStart })
      .andWhere('entry.transaction_date <= :periodEnd', { periodEnd });

    if (currency) {
      query.andWhere('entry.currency = :currency', { currency });
    }

    const summary = await query.getRawOne<{ gross_premium: string }>();

    return {
      gross_premium: DecimalUtil.money(summary?.gross_premium ?? 0),
    };
  }
}
