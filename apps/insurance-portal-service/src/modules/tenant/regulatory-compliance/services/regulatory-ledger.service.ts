import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { RegulatoryLedgerEntry } from '../entities/regulatory-ledger-entry.entity';
import { RegulatoryLevyAssessment } from '../entities/regulatory-levy-assessment.entity';

type AppendLedgerEntryInput = {
  company_id: string;
  source_type: string;
  source_id: string;
  source_event_key: string;
  entry_type: string;
  authority_profile_id?: string | null;
  obligation_instance_id?: string | null;
  regulatory_return_id?: string | null;
  levy_assessment_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  currency_code?: string | null;
  debit_amount?: string | number;
  credit_amount?: string | number;
  entry_snapshot: Record<string, unknown>;
  reversal_of_entry_id?: string | null;
  created_by?: string | null;
};

@Injectable()
export class RegulatoryLedgerService {
  constructor(
    @InjectRepository(RegulatoryLedgerEntry)
    private readonly ledgerRepository: Repository<RegulatoryLedgerEntry>,
  ) {}

  async listEntries(companyId: string) {
    return this.ledgerRepository.find({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
      take: 500,
    });
  }

  async appendEntry(input: AppendLedgerEntryInput) {
    const existing = await this.ledgerRepository.findOne({
      where: {
        company_id: input.company_id,
        source_event_key: input.source_event_key,
      },
    });

    if (existing) {
      return existing;
    }

    const previous = await this.ledgerRepository.findOne({
      where: { company_id: input.company_id },
      order: { created_at: 'DESC' },
    });

    const runningBalance = DecimalUtil.subtract(
      DecimalUtil.add(previous?.running_balance ?? 0, input.debit_amount ?? 0),
      input.credit_amount ?? 0,
    );

    return this.ledgerRepository.save(
      this.ledgerRepository.create({
        company_id: input.company_id,
        source_type: input.source_type,
        source_id: input.source_id,
        source_event_key: input.source_event_key,
        entry_type: input.entry_type,
        authority_profile_id: input.authority_profile_id ?? null,
        obligation_instance_id: input.obligation_instance_id ?? null,
        regulatory_return_id: input.regulatory_return_id ?? null,
        levy_assessment_id: input.levy_assessment_id ?? null,
        period_start: input.period_start ?? null,
        period_end: input.period_end ?? null,
        currency_code: input.currency_code ?? null,
        debit_amount: DecimalUtil.money(input.debit_amount ?? 0),
        credit_amount: DecimalUtil.money(input.credit_amount ?? 0),
        running_balance: runningBalance,
        entry_snapshot: input.entry_snapshot,
        entry_snapshot_hash: this.hashPayload(input.entry_snapshot),
        reversal_of_entry_id: input.reversal_of_entry_id ?? null,
        created_by: input.created_by ?? null,
      }),
    );
  }

  async recordLevyAssessmentApproval(input: {
    assessment: RegulatoryLevyAssessment;
    authorityProfileId?: string | null;
    regulatoryReturnId?: string | null;
    createdBy?: string | null;
  }) {
    const { assessment } = input;

    if (!assessment.assessed_amount) {
      throw new BadRequestException(
        'Levy assessment amount is required before approval',
      );
    }

    const baseSnapshot = {
      assessment_no: assessment.assessment_no,
      assessed_amount: assessment.assessed_amount,
      currency_code: assessment.currency_code,
      approved_at: assessment.approved_at?.toISOString() ?? null,
    };

    const debitEntry = await this.appendEntry({
      company_id: assessment.company_id,
      source_type: 'REGULATORY_LEVY_ASSESSMENT',
      source_id: assessment.id,
      source_event_key: `${assessment.id}:APPROVED:DEBIT`,
      entry_type: 'LEVY_EXPENSE_DEBIT',
      authority_profile_id: input.authorityProfileId ?? null,
      obligation_instance_id: assessment.obligation_instance_id,
      regulatory_return_id: input.regulatoryReturnId ?? null,
      levy_assessment_id: assessment.id,
      period_start: assessment.period_start,
      period_end: assessment.period_end,
      currency_code: assessment.currency_code,
      debit_amount: assessment.assessed_amount,
      credit_amount: 0,
      entry_snapshot: {
        ...baseSnapshot,
        account_side: 'DEBIT',
        narrative: 'Regulatory levy expense recognized',
      },
      created_by: input.createdBy ?? null,
    });

    const creditEntry = await this.appendEntry({
      company_id: assessment.company_id,
      source_type: 'REGULATORY_LEVY_ASSESSMENT',
      source_id: assessment.id,
      source_event_key: `${assessment.id}:APPROVED:CREDIT`,
      entry_type: 'LEVY_PAYABLE_CREDIT',
      authority_profile_id: input.authorityProfileId ?? null,
      obligation_instance_id: assessment.obligation_instance_id,
      regulatory_return_id: input.regulatoryReturnId ?? null,
      levy_assessment_id: assessment.id,
      period_start: assessment.period_start,
      period_end: assessment.period_end,
      currency_code: assessment.currency_code,
      debit_amount: 0,
      credit_amount: assessment.assessed_amount,
      entry_snapshot: {
        ...baseSnapshot,
        account_side: 'CREDIT',
        narrative: 'Regulatory levy payable recognized',
      },
      created_by: input.createdBy ?? null,
    });

    return [debitEntry, creditEntry];
  }

  private hashPayload(payload: unknown) {
    return createHash('sha256')
      .update(this.stableStringify(payload))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }
}
