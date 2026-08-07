import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DateTime } from 'luxon';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { CompanySubscription } from '../entities/company-subscription.entity';
import { PlatformUsageSnapshot } from '../entities/platform-usage-snapshot.entity';
import { SaasBillingCycle } from '../entities/saas-billing-cycle.entity';
import { SaasInvoiceItem } from '../entities/saas-invoice-item.entity';
import { SaasInvoice } from '../entities/saas-invoice.entity';
import { SaasPayment } from '../entities/saas-payment.entity';
import {
  SaasBillingCycleStatus,
  SaasInvoiceStatus,
  SaasPaymentStatus,
} from '../enums/saas-billing.enums';

@Injectable()
export class SaasCycleBillingService {
  constructor(
    @InjectRepository(CompanySubscription)
    private readonly subscriptionRepository: Repository<CompanySubscription>,
    @InjectRepository(PlatformUsageSnapshot)
    private readonly snapshotRepository: Repository<PlatformUsageSnapshot>,
    @InjectRepository(SaasBillingCycle)
    private readonly cycleRepository: Repository<SaasBillingCycle>,
    @InjectRepository(SaasInvoice)
    private readonly invoiceRepository: Repository<SaasInvoice>,
    @InjectRepository(SaasInvoiceItem)
    private readonly invoiceItemRepository: Repository<SaasInvoiceItem>,
    @InjectRepository(SaasPayment)
    private readonly paymentRepository: Repository<SaasPayment>,
    private readonly configService: ConfigService,
  ) {}

  listInvoices() {
    return this.invoiceRepository.find({
      order: {
        created_at: 'DESC',
      },
      take: 200,
    });
  }

  listUsage() {
    return this.snapshotRepository.find({
      order: {
        calculated_at: 'DESC',
      },
      take: 200,
    });
  }

  async issueInvoice(user: AuthenticatedUser, cycleId: string) {
    const cycle = await this.cycleRepository.findOneBy({ id: cycleId });
    if (!cycle) {
      throw new NotFoundException('Billing cycle was not found');
    }

    if (
      cycle.status === SaasBillingCycleStatus.INVOICED ||
      cycle.status === SaasBillingCycleStatus.CLOSED
    ) {
      throw new BadRequestException('Invoiced cycles cannot be recalculated');
    }

    const existingInvoice = await this.invoiceRepository.findOne({
      where: { cycle_id: cycle.id },
    });
    if (existingInvoice) {
      return existingInvoice;
    }

    const invoice = await this.invoiceRepository.save(
      this.invoiceRepository.create({
        cycle_id: cycle.id,
        subscription_id: cycle.subscription_id,
        company_id: cycle.company_id,
        invoice_no: `SINV-${DateTime.utc().toFormat('yyyyLLddHHmmss')}-${cycle.company_id.slice(0, 6).toUpperCase()}`,
        currency: cycle.currency,
        subtotal_amount: DecimalUtil.add(cycle.base_amount, cycle.usage_amount),
        tax_amount: DecimalUtil.money(cycle.tax_amount),
        total_amount: DecimalUtil.money(cycle.total_amount),
        paid_amount: '0.00',
        balance_amount: DecimalUtil.money(cycle.total_amount),
        status: SaasInvoiceStatus.ISSUED,
        due_at: DateTime.utc()
          .plus({
            day: Number(
              this.configService.get<string>('SAAS_INVOICE_DUE_DAYS') ?? '14',
            ),
          })
          .toJSDate(),
        issued_at: new Date(),
        created_by: user.id,
        updated_by: user.id,
      }),
    );

    await this.invoiceItemRepository.save([
      this.invoiceItemRepository.create({
        invoice_id: invoice.id,
        item_type: 'BASE',
        description: 'Subscription base charge',
        quantity: '1.000000',
        unit_price: DecimalUtil.quantity(cycle.base_amount),
        amount: DecimalUtil.money(cycle.base_amount),
      }),
      this.invoiceItemRepository.create({
        invoice_id: invoice.id,
        item_type: 'USAGE',
        description: 'Metered usage charge',
        quantity: '1.000000',
        unit_price: DecimalUtil.quantity(cycle.usage_amount),
        amount: DecimalUtil.money(cycle.usage_amount),
      }),
    ]);

    cycle.status = SaasBillingCycleStatus.INVOICED;
    cycle.calculated_at = cycle.calculated_at ?? new Date();
    await this.cycleRepository.save(cycle);

    return this.invoiceRepository.findOneByOrFail({ id: invoice.id });
  }

  async recordPayment(
    user: AuthenticatedUser,
    invoiceId: string,
    dto: {
      amount: string | number;
      payment_reference: string;
      payment_date?: string;
      notes?: string;
    },
  ) {
    const invoice = await this.invoiceRepository.findOneBy({ id: invoiceId });
    if (!invoice) {
      throw new NotFoundException('SaaS invoice was not found');
    }

    if (invoice.status === SaasInvoiceStatus.VOID) {
      throw new BadRequestException('Voided invoices cannot receive payments');
    }

    const amount = DecimalUtil.value(dto.amount);
    const balance = DecimalUtil.value(invoice.balance_amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Payment amount must be positive');
    }

    if (amount.gt(balance)) {
      throw new BadRequestException('Payment cannot exceed invoice balance');
    }

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        invoice_id: invoice.id,
        company_id: invoice.company_id,
        payment_reference: dto.payment_reference.trim(),
        currency: invoice.currency,
        amount: DecimalUtil.money(amount),
        status: SaasPaymentStatus.CONFIRMED,
        payment_date: dto.payment_date ?? DateTime.utc().toFormat('yyyy-LL-dd'),
        recorded_by: user.id,
        notes: dto.notes ?? null,
      }),
    );

    const nextPaid = DecimalUtil.value(invoice.paid_amount).plus(amount);
    invoice.paid_amount = DecimalUtil.money(nextPaid);
    invoice.balance_amount = DecimalUtil.money(balance.minus(amount));

    if (DecimalUtil.value(invoice.balance_amount).eq(0)) {
      invoice.status = SaasInvoiceStatus.PAID;
    } else {
      invoice.status = SaasInvoiceStatus.PARTIALLY_PAID;
    }

    await this.invoiceRepository.save(invoice);
    return payment;
  }

  async ensureOpenCycleForSubscription(subscriptionId: string) {
    const subscription = await this.subscriptionRepository.findOneBy({
      id: subscriptionId,
    });
    if (!subscription) {
      throw new NotFoundException('Subscription was not found');
    }

    const existing = await this.cycleRepository.findOne({
      where: {
        subscription_id: subscription.id,
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
      },
    });

    if (existing) {
      return existing;
    }

    const usageSnapshots = await this.snapshotRepository.find({
      where: {
        subscription_id: subscription.id,
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
      },
      order: {
        metric_code: 'ASC',
        dimension_key: 'ASC',
      },
    });

    const billingSnapshot = this.buildBillingSnapshot(
      subscription,
      usageSnapshots,
    );
    const usageAmount = billingSnapshot.usage_amount;
    return this.cycleRepository.save(
      this.cycleRepository.create({
        subscription_id: subscription.id,
        company_id: subscription.company_id,
        plan_version_id: subscription.plan_version_id,
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
        currency: subscription.currency,
        base_amount: DecimalUtil.money(subscription.base_price),
        usage_amount: usageAmount,
        discount_amount: '0.00',
        tax_amount: '0.00',
        total_amount: DecimalUtil.add(subscription.base_price, usageAmount),
        billing_snapshot: billingSnapshot.snapshot,
        billing_snapshot_hash: billingSnapshot.hash,
        state_version: 1,
        status: SaasBillingCycleStatus.CALCULATED,
        calculated_at: new Date(),
      }),
    );
  }

  private buildBillingSnapshot(
    subscription: CompanySubscription,
    usageSnapshots: PlatformUsageSnapshot[],
  ) {
    type MeterRateSnapshot = {
      metric_code: string;
      included_quantity?: string | number;
      billing_unit?: string | number;
      unit_price?: string | number;
      currency?: string;
      is_active?: boolean;
    };

    const planSnapshot =
      (subscription.plan_snapshot as
        | {
            meter_rates?: MeterRateSnapshot[];
          }
        | null) ?? null;
    const meterRates = Array.isArray(planSnapshot?.meter_rates)
      ? planSnapshot.meter_rates
      : [];

    const usageByMetric = new Map<string, PlatformUsageSnapshot[]>();
    for (const snapshot of usageSnapshots) {
      const current = usageByMetric.get(snapshot.metric_code) ?? [];
      current.push(snapshot);
      usageByMetric.set(snapshot.metric_code, current);
    }

    const meterCharges = meterRates
      .filter((rate) => rate.is_active !== false)
      .map((rate) => {
        const metricSnapshots = usageByMetric.get(rate.metric_code) ?? [];
        const quantity = metricSnapshots.reduce(
          (total, snapshot) => total.plus(DecimalUtil.value(snapshot.quantity)),
          DecimalUtil.value(0),
        );
        const included = DecimalUtil.value(rate.included_quantity ?? 0);
        const billingUnit = DecimalUtil.value(rate.billing_unit ?? 1);
        const overageQuantity = quantity.greaterThan(included)
          ? quantity.minus(included)
          : DecimalUtil.value(0);
        const billableUnits = billingUnit.eq(0)
          ? overageQuantity
          : overageQuantity.div(billingUnit);
        const chargeAmount = billableUnits.mul(
          DecimalUtil.value(rate.unit_price ?? 0),
        );

        return {
          metric_code: rate.metric_code,
          quantity: DecimalUtil.quantity(quantity),
          included_quantity: DecimalUtil.quantity(included),
          overage_quantity: DecimalUtil.quantity(overageQuantity),
          billing_unit: DecimalUtil.quantity(billingUnit),
          billable_units: DecimalUtil.quantity(billableUnits),
          unit_price: DecimalUtil.quantity(rate.unit_price ?? 0),
          currency: rate.currency ?? subscription.currency,
          amount: DecimalUtil.money(chargeAmount),
        };
      });

    const usageAmount = meterCharges.reduce(
      (total, charge) => total.plus(DecimalUtil.value(charge.amount)),
      DecimalUtil.value(0),
    );

    const snapshot = {
      plan_version_id: subscription.plan_version_id,
      currency: subscription.currency,
      period: {
        start: subscription.current_period_start.toISOString(),
        end: subscription.current_period_end.toISOString(),
      },
      base_amount: DecimalUtil.money(subscription.base_price),
      meter_definitions: meterRates,
      usage_snapshot: usageSnapshots.map((row) => ({
        metric_code: row.metric_code,
        dimension_key: row.dimension_key,
        quantity: row.quantity,
        dimensions: row.dimensions ?? {},
      })),
      usage_charges: meterCharges,
      discount_amount: '0.00',
      tax_amount: '0.00',
      usage_amount: DecimalUtil.money(usageAmount),
      total_amount: DecimalUtil.add(subscription.base_price, usageAmount),
    };

    return {
      snapshot,
      usage_amount: DecimalUtil.money(usageAmount),
      hash: createHash('sha256')
        .update(JSON.stringify(snapshot))
        .digest('hex'),
    };
  }
}
