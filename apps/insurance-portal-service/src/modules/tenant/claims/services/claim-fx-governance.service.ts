import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DataSource, EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { ClaimFxRateDto } from '../dto/claim-fx.dto';

type Rate = {
  id: string;
  company_id: string;
  transaction_currency: string;
  functional_currency: string;
  rate: string;
  effective_date: string;
  source_reference: string;
  status: string;
  created_by: string;
  submitted_by: string | null;
};

@Injectable()
export class ClaimFxGovernanceService {
  constructor(private readonly dataSource: DataSource) {}

  private company(user: AuthenticatedUser): string {
    if (!user.companyId || user.scope !== 'company')
      throw new ForbiddenException('Company scope is required');
    return user.companyId;
  }

  async functionalCurrency(
    manager: EntityManager,
    companyId: string,
  ): Promise<string> {
    const rows: Array<{
      slug: string;
      settings: { functional_currency?: unknown } | null;
    }> = await manager.query(
      'SELECT slug, settings FROM companies WHERE id = $1 AND deleted_at IS NULL',
      [companyId],
    );
    if (!rows.length) throw new NotFoundException('Company not found');
    const company = rows[0];
    const value = [
      'alliance-insurance-corporation',
      'alliance-insurance-company-limited',
    ].includes(company.slug)
      ? 'TZS'
      : company.settings?.functional_currency;
    if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
      throw new BadRequestException(
        'Company functional currency must be explicitly configured',
      );
    }
    return value;
  }

  private validate(dto: ClaimFxRateDto): void {
    const rate = DecimalUtil.value(dto.rate);
    if (!rate.isFinite() || !rate.greaterThan(0))
      throw new BadRequestException('Rate must be positive and finite');
    if (dto.transaction_currency === dto.functional_currency)
      throw new BadRequestException('Same-currency conversions use parity');
    if (!dto.source_reference.trim() || !dto.justification.trim())
      throw new BadRequestException(
        'Rate provenance and justification are required',
      );
  }

  async create(user: AuthenticatedUser, dto: ClaimFxRateDto): Promise<Rate> {
    this.validate(dto);
    const company = this.company(user);
    return this.dataSource.transaction(async (m) => {
      if (
        (await this.functionalCurrency(m, company)) !== dto.functional_currency
      )
        throw new BadRequestException(
          'Rate functional currency does not match company configuration',
        );
      const [rate]: Rate[] = await m.query(
        `INSERT INTO claim_fx_rates
        (company_id, transaction_currency, functional_currency, rate, direction, effective_date, source_type, source_reference, justification, status, created_by)
        VALUES ($1,$2,$3,$4,'TRANSACTION_TO_FUNCTIONAL_MULTIPLY',$5,'MANUAL',$6,$7,'DRAFT',$8) RETURNING *`,
        [
          company,
          dto.transaction_currency,
          dto.functional_currency,
          dto.rate,
          dto.effective_date,
          dto.source_reference.trim(),
          dto.justification.trim(),
          user.id,
        ],
      );
      await this.audit(m, rate, 'CREATED', user.id);
      return rate;
    });
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: ClaimFxRateDto,
  ): Promise<Rate> {
    this.validate(dto);
    const company = this.company(user);
    return this.dataSource.transaction(async (m) => {
      const rate = await this.lock(m, company, id);
      if (rate.status !== 'DRAFT' || rate.created_by !== user.id)
        throw new ConflictException('Only the maker can edit a draft');
      if (
        (await this.functionalCurrency(m, company)) !== dto.functional_currency
      )
        throw new BadRequestException(
          'Rate functional currency does not match company configuration',
        );
      const [updated]: Rate[] = await m.query(
        `WITH updated AS (UPDATE claim_fx_rates SET transaction_currency=$1, functional_currency=$2, rate=$3, effective_date=$4, source_reference=$5, justification=$6, updated_at=now() WHERE id=$7 RETURNING *) SELECT * FROM updated`,
        [
          dto.transaction_currency,
          dto.functional_currency,
          dto.rate,
          dto.effective_date,
          dto.source_reference.trim(),
          dto.justification.trim(),
          id,
        ],
      );
      await this.audit(m, updated, 'UPDATED', user.id);
      return updated;
    });
  }

  async transition(
    user: AuthenticatedUser,
    id: string,
    action: 'SUBMIT' | 'APPROVE' | 'REJECT',
    reason?: string,
  ): Promise<Rate> {
    const company = this.company(user);
    return this.dataSource.transaction(async (m) => {
      const rate = await this.lock(m, company, id);
      if (action === 'SUBMIT') {
        if (rate.status !== 'DRAFT' || rate.created_by !== user.id)
          throw new ConflictException('Only the maker can submit a draft');
      } else {
        if (rate.status !== 'SUBMITTED')
          throw new ConflictException('Rate is not awaiting approval');
        if (user.id === rate.created_by || user.id === rate.submitted_by)
          throw new ForbiddenException(
            'A separate checker must decide the rate',
          );
        if (action === 'REJECT' && !reason?.trim())
          throw new BadRequestException('A rejection reason is required');
      }
      const [updated]: Rate[] =
        action === 'SUBMIT'
          ? await m.query(
              `WITH updated AS (UPDATE claim_fx_rates SET status='SUBMITTED', submitted_by=$1, submitted_at=now(), updated_at=now() WHERE id=$2 RETURNING *) SELECT * FROM updated`,
              [user.id, id],
            )
          : await m.query(
              `WITH updated AS (UPDATE claim_fx_rates SET status=$1, decided_by=$2, decided_at=now(), rejection_reason=$3, updated_at=now() WHERE id=$4 RETURNING *) SELECT * FROM updated`,
              [
                action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                user.id,
                action === 'REJECT' ? reason?.trim() : null,
                id,
              ],
            );
      await this.audit(m, updated, action, user.id);
      return updated;
    });
  }

  async list(user: AuthenticatedUser, status?: string): Promise<Rate[]> {
    const company = this.company(user);
    if (
      status &&
      !['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED'].includes(
        status,
      )
    )
      throw new BadRequestException('Invalid rate status');
    return this.dataSource.query(
      'SELECT * FROM claim_fx_rates WHERE company_id=$1 AND ($2::text IS NULL OR status=$2) ORDER BY created_at DESC, id',
      [company, status ?? null],
    );
  }

  async details(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ rate: Rate; audit: unknown[] }> {
    const company = this.company(user);
    const [rate]: Rate[] = await this.dataSource.query(
      'SELECT * FROM claim_fx_rates WHERE company_id=$1 AND id=$2',
      [company, id],
    );
    if (!rate) throw new NotFoundException('Rate not found');
    return {
      rate,
      audit: await this.dataSource.query(
        'SELECT * FROM claim_fx_rate_audit WHERE company_id=$1 AND rate_id=$2 ORDER BY created_at, id',
        [company, id],
      ),
    };
  }

  async resolve(
    manager: EntityManager,
    company: string,
    currency: string,
    eventDate: string,
  ): Promise<{
    rate: string;
    rateId: string | null;
    functionalCurrency: string;
    source: string;
    reference: string | null;
    effectiveDate: string;
  }> {
    if (!/^[A-Z]{3}$/.test(currency) || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate))
      throw new BadRequestException('Invalid currency or event date');
    const functionalCurrency = await this.functionalCurrency(manager, company);
    if (currency === functionalCurrency)
      return {
        rate: '1',
        rateId: null,
        functionalCurrency,
        source: 'PARITY',
        reference: null,
        effectiveDate: eventDate,
      };
    const [rate]: Rate[] = await manager.query(
      `SELECT * FROM claim_fx_rates WHERE company_id=$1 AND transaction_currency=$2 AND functional_currency=$3 AND status='APPROVED' AND effective_date <= $4 ORDER BY effective_date DESC, decided_at DESC, id DESC LIMIT 1`,
      [company, currency, functionalCurrency, eventDate],
    );
    if (!rate)
      throw new BadRequestException(
        'No approved exchange rate is available for this currency pair and event date',
      );
    return {
      rate: rate.rate,
      rateId: rate.id,
      functionalCurrency,
      source: 'MANUAL',
      reference: rate.source_reference,
      effectiveDate: rate.effective_date,
    };
  }

  /** Called inside the financial event's transaction; existing evidence is never updated. */
  async snapshot(
    manager: EntityManager,
    input: {
      companyId: string;
      claimId: string;
      eventType: string;
      eventId: string;
      currency: string;
      eventDate: string;
      amount: string;
      correction?: boolean;
    },
  ): Promise<unknown> {
    const amount = DecimalUtil.value(input.amount);
    if (!amount.isFinite() || !amount.equals(amount.toDecimalPlaces(2)))
      throw new BadRequestException('Invalid monetary amount');
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [
        `${input.companyId}:${input.claimId}:${input.eventType}:${input.eventId}`,
      ],
    );
    const prior: Array<{ id: string; version: number }> = await manager.query(
      `SELECT id, version FROM claim_fx_snapshots WHERE company_id=$1 AND claim_id=$2 AND event_type=$3 AND event_id=$4 ORDER BY version DESC LIMIT 1`,
      [input.companyId, input.claimId, input.eventType, input.eventId],
    );
    if (prior.length && !input.correction)
      throw new ConflictException('A snapshot already exists for this event');
    if (!prior.length && input.correction)
      throw new ConflictException('A correction requires an existing snapshot');
    const rate = await this.resolve(
      manager,
      input.companyId,
      input.currency,
      input.eventDate,
    );
    const converted = amount.mul(DecimalUtil.value(rate.rate)).toFixed(2);
    const [saved]: unknown[] = await manager.query(
      `INSERT INTO claim_fx_snapshots
      (company_id, claim_id, event_type, event_id, transaction_currency, functional_currency, approved_rate_id, rate, direction, source_type, source_reference, effective_date, original_amount, converted_amount, rounding_basis, version, supersedes_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'TRANSACTION_TO_FUNCTIONAL_MULTIPLY',$9,$10,$11,$12,$13,'ROUND_HALF_UP_2DP',$14,$15) RETURNING *`,
      [
        input.companyId,
        input.claimId,
        input.eventType,
        input.eventId,
        input.currency,
        rate.functionalCurrency,
        rate.rateId,
        rate.rate,
        rate.source,
        rate.reference,
        rate.effectiveDate,
        amount.toFixed(2),
        converted,
        (prior[0]?.version ?? 0) + 1,
        prior[0]?.id ?? null,
      ],
    );
    return saved;
  }

  /** Record the current valuation of a mutable draft without rewriting prior evidence. */
  async snapshotDraft(
    manager: EntityManager,
    input: {
      companyId: string;
      claimId: string;
      eventType: string;
      eventId: string;
      currency: string;
      eventDate: string;
      amount: string;
    },
  ): Promise<string> {
    // The caller locks the draft record for edits; the snapshot method also
    // serializes versions for this event within the transaction.
    const existing: Array<{ id: string }> = await manager.query(
      `SELECT id FROM claim_fx_snapshots WHERE company_id=$1 AND claim_id=$2 AND event_type=$3 AND event_id=$4 LIMIT 1`,
      [input.companyId, input.claimId, input.eventType, input.eventId],
    );
    const result = (await this.snapshot(manager, {
      ...input,
      correction: existing.length > 0,
    })) as { rate: string };
    const rate = DecimalUtil.value(result.rate);
    if (
      !rate.isFinite() ||
      !rate.greaterThan(0) ||
      !rate.equals(rate.toDecimalPlaces(6)) ||
      rate.greaterThanOrEqualTo('1000000000000')
    ) {
      throw new ConflictException(
        'Approved exchange rate cannot be represented exactly in the existing claim rate field',
      );
    }
    return rate.toFixed(6);
  }

  private async lock(
    manager: EntityManager,
    company: string,
    id: string,
  ): Promise<Rate> {
    const [rate]: Rate[] = await manager.query(
      'SELECT * FROM claim_fx_rates WHERE company_id=$1 AND id=$2 FOR UPDATE',
      [company, id],
    );
    if (!rate) throw new NotFoundException('Rate not found');
    return rate;
  }

  private async audit(
    manager: EntityManager,
    rate: Rate,
    action: string,
    actor: string,
  ): Promise<void> {
    await manager.query(
      'INSERT INTO claim_fx_rate_audit (company_id, rate_id, action, actor_id, details) VALUES ($1,$2,$3,$4,$5)',
      [rate.company_id, rate.id, action, actor, JSON.stringify(rate)],
    );
  }
}
