import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PRICING_ROUNDING_POLICY,
  roundExchangeRate,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository } from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import type { ExchangeRateSnapshot } from '../domain/pricing.types';

const DEFAULT_BASE_CURRENCY = 'TZS';
const MANUAL_EXCHANGE_RATE_PERMISSION = 'pricing.exchange-rate.manual';
const APPROVE_EXCHANGE_RATE_PERMISSION = 'pricing.exchange-rate.approve';

@Injectable()
export class ExchangeRateGovernanceService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async resolveSnapshot(
    companyId: string,
    input: {
      quotation_currency_code?: string | null;
      exchange_rate?: number | null;
      effective_date?: string | null;
    },
    user?: Pick<AuthenticatedUser, 'id' | 'permissions'> | null,
  ): Promise<ExchangeRateSnapshot> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const baseCurrencyCode = this.normalizeCurrencyCode(
      company.settings?.currency ?? DEFAULT_BASE_CURRENCY,
    );
    const quotationCurrencyCode = this.normalizeCurrencyCode(
      input.quotation_currency_code ?? baseCurrencyCode,
    );
    const exchangeRateDate = this.normalizeDateOnly(input.effective_date);

    if (quotationCurrencyCode === baseCurrencyCode) {
      if (
        input.exchange_rate !== undefined &&
        input.exchange_rate !== null &&
        roundExchangeRate(input.exchange_rate) !== 1
      ) {
        throw new BadRequestException(
          `exchange_rate must be 1 when quotation currency ${quotationCurrencyCode} matches the base company currency`,
        );
      }

      return {
        quotation_currency_code: quotationCurrencyCode,
        base_currency_code: baseCurrencyCode,
        exchange_rate: 1,
        exchange_rate_source: 'PARITY',
        exchange_rate_date: exchangeRateDate,
        exchange_rate_precision: PRICING_ROUNDING_POLICY.exchangeRateScale,
        approval_required: false,
        approval_granted: true,
        approved_by_user_id: null,
        approved_at: null,
        conversion_direction: 'QUOTE_TO_BASE_MULTIPLY',
        rounding_method: 'ROUND_HALF_UP',
      };
    }

    const manualRate = input.exchange_rate;
    if (manualRate === undefined || manualRate === null || manualRate <= 0) {
      throw new BadRequestException(
        `A manual exchange_rate is required when quotation currency ${quotationCurrencyCode} differs from base currency ${baseCurrencyCode}`,
      );
    }

    if (!this.userHasPermission(user, MANUAL_EXCHANGE_RATE_PERMISSION)) {
      throw new ForbiddenException(
        'You do not have permission to enter a manual exchange rate',
      );
    }

    if (!this.userHasPermission(user, APPROVE_EXCHANGE_RATE_PERMISSION)) {
      throw new ForbiddenException(
        'The provided manual exchange rate requires approval by a user with pricing.exchange-rate.approve',
      );
    }

    return {
      quotation_currency_code: quotationCurrencyCode,
      base_currency_code: baseCurrencyCode,
      exchange_rate: roundExchangeRate(manualRate),
      exchange_rate_source: 'MANUAL',
      exchange_rate_date: exchangeRateDate,
      exchange_rate_precision: PRICING_ROUNDING_POLICY.exchangeRateScale,
      approval_required: true,
      approval_granted: true,
      approved_by_user_id: user?.id ?? null,
      approved_at: new Date().toISOString(),
      conversion_direction: 'QUOTE_TO_BASE_MULTIPLY',
      rounding_method: 'ROUND_HALF_UP',
    };
  }

  private userHasPermission(
    user: Pick<AuthenticatedUser, 'permissions'> | null | undefined,
    permission: string,
  ) {
    return user?.permissions?.includes(permission) ?? false;
  }

  private normalizeCurrencyCode(value: string) {
    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new BadRequestException(
        `Invalid currency code ${value}. Expected a three-letter ISO code.`,
      );
    }

    return normalized;
  }

  private normalizeDateOnly(value?: string | null) {
    if (!value) {
      return new Date().toISOString().slice(0, 10);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('effective_date must be a valid date');
    }

    return parsed.toISOString().slice(0, 10);
  }
}
