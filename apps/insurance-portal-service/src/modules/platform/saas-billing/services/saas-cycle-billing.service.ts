import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DateTime } from 'luxon';
import { createHash } from 'crypto';
import { In, LessThan, Not, Repository } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { CompanySubscription } from '../entities/company-subscription.entity';
import { PlatformUsageSnapshot } from '../entities/platform-usage-snapshot.entity';
import { SaasBillingCycle } from '../entities/saas-billing-cycle.entity';
import { SaasInvoiceAdjustment } from '../entities/saas-invoice-adjustment.entity';
import { SaasInvoiceItem } from '../entities/saas-invoice-item.entity';
import { SaasInvoice } from '../entities/saas-invoice.entity';
import { SaasPayment } from '../entities/saas-payment.entity';
import { SubscriptionChange } from '../entities/subscription-change.entity';
import {
  SaasBillingCycleStatus,
  SaasInvoiceAdjustmentStatus,
  SaasInvoiceAdjustmentType,
  SaasInvoiceStatus,
  SaasPaymentStatus,
  SubscriptionChangeType,
  SubscriptionStatus,
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
    @InjectRepository(SaasInvoiceAdjustment)
    private readonly invoiceAdjustmentRepository: Repository<SaasInvoiceAdjustment>,
    @InjectRepository(SaasInvoiceItem)
    private readonly invoiceItemRepository: Repository<SaasInvoiceItem>,
    @InjectRepository(SaasPayment)
    private readonly paymentRepository: Repository<SaasPayment>,
    @InjectRepository(SubscriptionChange)
    private readonly subscriptionChangeRepository: Repository<SubscriptionChange>,
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

  listInvoiceAdjustments(invoiceId: string) {
    return this.invoiceAdjustmentRepository.find({
      where: { invoice_id: invoiceId },
      order: { created_at: 'DESC' },
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
    await this.restoreSubscriptionAfterPayment(
      invoice.subscription_id,
      user.id,
    );
    return payment;
  }

  async createInvoiceAdjustment(
    user: AuthenticatedUser,
    invoiceId: string,
    dto: {
      adjustment_type: SaasInvoiceAdjustmentType;
      amount: string | number;
      reason: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const invoice = await this.invoiceRepository.findOneBy({ id: invoiceId });
    if (!invoice) {
      throw new NotFoundException('SaaS invoice was not found');
    }

    if (
      ![
        SaasInvoiceStatus.ISSUED,
        SaasInvoiceStatus.PARTIALLY_PAID,
        SaasInvoiceStatus.OVERDUE,
        SaasInvoiceStatus.PAID,
      ].includes(invoice.status)
    ) {
      throw new ConflictException(
        'Only issued invoices can be adjusted through an invoice adjustment.',
      );
    }

    const amount = DecimalUtil.value(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Adjustment amount must be positive');
    }

    return this.invoiceAdjustmentRepository.save(
      this.invoiceAdjustmentRepository.create({
        company_id: invoice.company_id,
        invoice_id: invoice.id,
        adjustment_no: `SADJ-${DateTime.utc().toFormat('yyyyLLddHHmmss')}-${invoice.company_id.slice(0, 6).toUpperCase()}`,
        adjustment_type: dto.adjustment_type,
        amount: amount.toFixed(4),
        currency: invoice.currency,
        reason: dto.reason.trim(),
        status: SaasInvoiceAdjustmentStatus.DRAFT,
        created_by: user.id,
        approved_by: null,
        approved_at: null,
        metadata: dto.metadata ?? null,
      }),
    );
  }

  async approveInvoiceAdjustment(
    user: AuthenticatedUser,
    adjustmentId: string,
  ) {
    const adjustment = await this.invoiceAdjustmentRepository.findOneBy({
      id: adjustmentId,
    });
    if (!adjustment) {
      throw new NotFoundException('Invoice adjustment was not found');
    }

    if (adjustment.status !== SaasInvoiceAdjustmentStatus.DRAFT) {
      throw new ConflictException('Only draft adjustments can be approved.');
    }

    const invoice = await this.invoiceRepository.findOneBy({
      id: adjustment.invoice_id,
    });
    if (!invoice) {
      throw new NotFoundException('SaaS invoice was not found');
    }

    const approvedAt = new Date();
    const adjustmentAmount = DecimalUtil.value(adjustment.amount);
    const currentTotal = DecimalUtil.value(invoice.total_amount);
    const currentPaid = DecimalUtil.value(invoice.paid_amount);
    const currentBalance = DecimalUtil.value(invoice.balance_amount);

    let nextTotal = currentTotal;
    let nextBalance = currentBalance;

    switch (adjustment.adjustment_type) {
      case SaasInvoiceAdjustmentType.DEBIT:
        nextTotal = currentTotal.plus(adjustmentAmount);
        nextBalance = currentBalance.plus(adjustmentAmount);
        break;
      case SaasInvoiceAdjustmentType.CREDIT:
      case SaasInvoiceAdjustmentType.REVERSAL:
        nextTotal = currentTotal.minus(adjustmentAmount);
        if (nextTotal.lt(currentPaid)) {
          throw new BadRequestException(
            'Adjustment would reduce invoice total below the amount already paid.',
          );
        }
        nextBalance = DecimalUtil.value(nextTotal).minus(currentPaid);
        break;
      case SaasInvoiceAdjustmentType.WRITE_OFF:
        nextBalance = DecimalUtil.value(currentBalance).minus(adjustmentAmount);
        break;
    }

    if (nextBalance.lt(0)) {
      nextBalance = DecimalUtil.value(0);
    }

    invoice.total_amount = DecimalUtil.money(nextTotal);
    invoice.balance_amount = DecimalUtil.money(nextBalance);
    invoice.updated_by = user.id;
    invoice.metadata = {
      ...(invoice.metadata ?? {}),
      last_adjustment_id: adjustment.id,
      adjusted_at: approvedAt.toISOString(),
    };
    invoice.status = nextBalance.eq(0)
      ? SaasInvoiceStatus.PAID
      : currentPaid.gt(0)
        ? SaasInvoiceStatus.PARTIALLY_PAID
        : SaasInvoiceStatus.ISSUED;

    adjustment.status = SaasInvoiceAdjustmentStatus.APPLIED;
    adjustment.approved_by = user.id;
    adjustment.approved_at = approvedAt;

    await this.invoiceRepository.save(invoice);
    await this.invoiceAdjustmentRepository.save(adjustment);
    await this.restoreSubscriptionAfterPayment(
      invoice.subscription_id,
      user.id,
    );

    return adjustment;
  }

  @Cron(process.env.SAAS_DUNNING_CRON ?? '0 15 1 * * *')
  async processDunning() {
    const graceDays = Number(
      this.configService.get<string>('SAAS_PAST_DUE_GRACE_DAYS') ?? '7',
    );
    const autoSuspend = this.configService.get<boolean>(
      'SAAS_AUTO_SUSPEND_ENABLED',
      true,
    );
    const now = new Date();

    const overdueInvoices = await this.invoiceRepository.find({
      where: {
        status: Not(SaasInvoiceStatus.VOID),
        due_at: LessThan(now),
      },
      order: { due_at: 'ASC' },
    });

    let processed = 0;

    for (const invoice of overdueInvoices) {
      if (DecimalUtil.value(invoice.balance_amount).lte(0)) {
        continue;
      }

      const subscription = await this.subscriptionRepository.findOneBy({
        id: invoice.subscription_id,
      });
      if (!subscription) {
        continue;
      }

      const dueAt = invoice.due_at ?? now;
      const graceEndsAt = DateTime.fromJSDate(dueAt)
        .plus({ day: graceDays })
        .toJSDate();
      const beyondGrace = now > graceEndsAt;

      invoice.status = SaasInvoiceStatus.OVERDUE;
      subscription.grace_period_ends_at = graceEndsAt;

      if (beyondGrace && autoSuspend) {
        if (subscription.status !== SubscriptionStatus.SUSPENDED) {
          subscription.status = SubscriptionStatus.SUSPENDED;
          subscription.suspended_at = now;
          subscription.suspension_reason = 'SUBSCRIPTION_PAYMENT_OVERDUE';
          subscription.state_version += 1;
          await this.subscriptionChangeRepository.save(
            this.subscriptionChangeRepository.create({
              subscription_id: subscription.id,
              company_id: subscription.company_id,
              change_type: SubscriptionChangeType.SUSPENDED,
              old_plan_version_id: subscription.plan_version_id,
              new_plan_version_id: subscription.plan_version_id,
              effective_at: now,
              change_summary: {
                source: 'DUNNING',
                invoice_id: invoice.id,
                grace_period_ends_at: graceEndsAt.toISOString(),
              },
              changed_by: null,
            }),
          );
        }
      } else if (
        [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(
          subscription.status,
        )
      ) {
        subscription.status = SubscriptionStatus.PAST_DUE;
        subscription.state_version += 1;
      }

      await this.invoiceRepository.save(invoice);
      await this.subscriptionRepository.save(subscription);
      processed += 1;
    }

    return { processed };
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
      (subscription.plan_snapshot as {
        meter_rates?: MeterRateSnapshot[];
      } | null) ?? null;
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
      hash: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
    };
  }

  private async restoreSubscriptionAfterPayment(
    subscriptionId: string,
    changedBy: string,
  ) {
    const autoRestore = this.configService.get<boolean>(
      'SAAS_AUTO_RESTORE_AFTER_PAYMENT',
      true,
    );
    if (!autoRestore) {
      return;
    }

    const subscription = await this.subscriptionRepository.findOneBy({
      id: subscriptionId,
    });
    if (
      !subscription ||
      ![SubscriptionStatus.PAST_DUE, SubscriptionStatus.SUSPENDED].includes(
        subscription.status,
      )
    ) {
      return;
    }

    const outstanding = await this.invoiceRepository.count({
      where: {
        subscription_id: subscriptionId,
        due_at: LessThan(new Date()),
        status: In([
          SaasInvoiceStatus.ISSUED,
          SaasInvoiceStatus.PARTIALLY_PAID,
          SaasInvoiceStatus.OVERDUE,
        ]),
      },
    });

    if (outstanding > 0) {
      return;
    }

    subscription.status =
      subscription.trial_ends_at &&
      DateTime.fromJSDate(subscription.trial_ends_at) > DateTime.utc()
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.ACTIVE;
    subscription.suspended_at = null;
    subscription.suspension_reason = null;
    subscription.grace_period_ends_at = null;
    subscription.updated_by = changedBy;
    subscription.state_version += 1;
    await this.subscriptionRepository.save(subscription);

    await this.subscriptionChangeRepository.save(
      this.subscriptionChangeRepository.create({
        subscription_id: subscription.id,
        company_id: subscription.company_id,
        change_type: SubscriptionChangeType.UNSUSPENSION,
        old_plan_version_id: subscription.plan_version_id,
        new_plan_version_id: subscription.plan_version_id,
        effective_at: new Date(),
        change_summary: {
          source: 'PAYMENT_RESTORED',
          restored_status: subscription.status,
        },
        changed_by: changedBy,
      }),
    );
  }
}
