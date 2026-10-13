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
import { DataSource, In, IsNull, LessThan, Not, Repository } from 'typeorm';

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
  BillingInterval,
  SaasBillingCycleStatus,
  SaasInvoiceAdjustmentStatus,
  SaasInvoiceAdjustmentType,
  SaasInvoiceStatus,
  SaasPaymentStatus,
  SubscriptionChangeType,
  SubscriptionStatus,
} from '../enums/saas-billing.enums';
import { UsageMeteringService } from './usage-metering.service';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';
import {
  FindSaasCyclesQueryDto,
  FindSaasInvoicesQueryDto,
} from '../dto/saas-billing-table-query.dto';

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
    private readonly dataSource: DataSource,
    private readonly usageMeteringService: UsageMeteringService,
  ) {}

  listInvoices() {
    return this.invoiceRepository.find({
      order: {
        created_at: 'DESC',
      },
      take: 200,
    });
  }

  /** Server-side invoices table (platform OWNER only — enforced by controller). */
  findInvoicesPage(query: FindSaasInvoicesQueryDto) {
    const qb = this.invoiceRepository.createQueryBuilder('invoice');
    if (query.status) {
      qb.andWhere('invoice.status = :status', { status: query.status });
    }
    if (query.company_id) {
      qb.andWhere('invoice.company_id = :companyId', {
        companyId: query.company_id,
      });
    }
    return paginateQueryBuilder(qb, query, {
      sortable: {
        invoice_no: 'invoice.invoice_no',
        status: 'invoice.status',
        due_at: 'invoice.due_at',
        total_amount: 'invoice.total_amount',
        paid_amount: 'invoice.paid_amount',
        balance_amount: 'invoice.balance_amount',
        created_at: 'invoice.created_at',
      },
      defaultSort: 'created_at',
      defaultOrder: 'DESC',
      searchable: ['invoice.invoice_no', 'invoice.status'],
      tieBreaker: 'invoice.id',
    });
  }

  /** Server-side billing cycles table. */
  findCyclesPage(query: FindSaasCyclesQueryDto) {
    const qb = this.cycleRepository.createQueryBuilder('cycle');
    if (query.status) {
      qb.andWhere('cycle.status = :status', { status: query.status });
    }
    if (query.company_id) {
      qb.andWhere('cycle.company_id = :companyId', {
        companyId: query.company_id,
      });
    }
    return paginateQueryBuilder(qb, query, {
      sortable: {
        period_end: 'cycle.period_end',
        period_start: 'cycle.period_start',
        status: 'cycle.status',
        base_amount: 'cycle.base_amount',
        usage_amount: 'cycle.usage_amount',
        tax_amount: 'cycle.tax_amount',
        total_amount: 'cycle.total_amount',
        created_at: 'cycle.created_at',
      },
      defaultSort: 'period_end',
      defaultOrder: 'DESC',
      searchable: ['cycle.status'],
      tieBreaker: 'cycle.id',
    });
  }

  /** Billing dashboard metrics, aggregated in SQL over all rows. */
  async getSummary() {
    const [subscriptions, cycles, invoices, latest] = await Promise.all([
      this.subscriptionRepository
        .createQueryBuilder('subscription')
        .where('subscription.deleted_at IS NULL')
        .andWhere('subscription.status IN (:...statuses)', {
          statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        })
        .getCount(),
      this.cycleRepository
        .createQueryBuilder('cycle')
        .where('cycle.status = :status', {
          status: SaasBillingCycleStatus.OPEN,
        })
        .getCount(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.balance_amount), 0)', 'balance')
        .addSelect(
          'COUNT(*) FILTER (WHERE invoice.status = :overdue)',
          'overdue',
        )
        .setParameter('overdue', SaasInvoiceStatus.OVERDUE)
        .getRawOne<{ balance: string; overdue: string }>(),
      this.invoiceRepository.findOne({
        where: {},
        order: { created_at: 'DESC' },
        select: { id: true, currency: true },
      }),
    ]);
    return {
      activeSubscriptions: subscriptions,
      openCycles: cycles,
      invoiceBalance: invoices?.balance ?? '0',
      overdueInvoices: Number(invoices?.overdue ?? 0),
      currency: latest?.currency ?? null,
    };
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

  listCycles() {
    return this.cycleRepository.find({
      order: {
        period_end: 'DESC',
        created_at: 'DESC',
      },
      take: 200,
    });
  }

  async issueInvoice(user: AuthenticatedUser, cycleId: string) {
    return this.dataSource.transaction(async (manager) => {
      const cycle = await manager.getRepository(SaasBillingCycle).findOne({
        where: { id: cycleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cycle) {
        throw new NotFoundException('Billing cycle was not found');
      }

      if (
        cycle.status === SaasBillingCycleStatus.INVOICED ||
        cycle.status === SaasBillingCycleStatus.CLOSED
      ) {
        throw new BadRequestException('Invoiced cycles cannot be recalculated');
      }

      const invoiceRepository = manager.getRepository(SaasInvoice);
      const existingInvoice = await invoiceRepository.findOne({
        where: { cycle_id: cycle.id },
        order: { created_at: 'DESC' },
      });
      if (
        existingInvoice &&
        existingInvoice.status !== SaasInvoiceStatus.VOID
      ) {
        return existingInvoice;
      }

      const invoice = await invoiceRepository.save(
        invoiceRepository.create({
          cycle_id: cycle.id,
          subscription_id: cycle.subscription_id,
          company_id: cycle.company_id,
          invoice_no: `SINV-${DateTime.utc().toFormat('yyyyLLddHHmmss')}-${cycle.company_id.slice(0, 6).toUpperCase()}`,
          currency: cycle.currency,
          subtotal_amount: DecimalUtil.add(
            cycle.base_amount,
            cycle.usage_amount,
          ),
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

      const itemRepository = manager.getRepository(SaasInvoiceItem);
      await itemRepository.save([
        itemRepository.create({
          invoice_id: invoice.id,
          item_type: 'BASE',
          description: 'Subscription base charge',
          quantity: '1.000000',
          unit_price: DecimalUtil.quantity(cycle.base_amount),
          amount: DecimalUtil.money(cycle.base_amount),
        }),
        itemRepository.create({
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
      await manager.getRepository(SaasBillingCycle).save(cycle);

      return invoiceRepository.findOneByOrFail({ id: invoice.id });
    });
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
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.getRepository(SaasInvoice).findOne({
        where: { id: invoiceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('SaaS invoice was not found');
      }

      if (invoice.status === SaasInvoiceStatus.VOID) {
        throw new BadRequestException(
          'Voided invoices cannot receive payments',
        );
      }

      const amount = DecimalUtil.value(dto.amount);
      const balance = DecimalUtil.value(invoice.balance_amount);
      if (amount.lte(0)) {
        throw new BadRequestException('Payment amount must be positive');
      }

      if (amount.gt(balance)) {
        throw new BadRequestException('Payment cannot exceed invoice balance');
      }

      const paymentRepository = manager.getRepository(SaasPayment);
      const payment = await paymentRepository.save(
        paymentRepository.create({
          invoice_id: invoice.id,
          company_id: invoice.company_id,
          payment_reference: dto.payment_reference.trim(),
          currency: invoice.currency,
          amount: DecimalUtil.money(amount),
          status: SaasPaymentStatus.CONFIRMED,
          payment_date:
            dto.payment_date ?? DateTime.utc().toFormat('yyyy-LL-dd'),
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

      await manager.getRepository(SaasInvoice).save(invoice);
      await this.restoreSubscriptionAfterPayment(
        invoice.subscription_id,
        user.id,
        manager,
      );
      return payment;
    });
  }

  async reversePayment(
    user: AuthenticatedUser,
    paymentId: string,
    reason?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.getRepository(SaasPayment).findOne({
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException('SaaS payment was not found');
      }
      if (payment.status === SaasPaymentStatus.REVERSED) {
        return payment;
      }

      const invoice = await manager.getRepository(SaasInvoice).findOne({
        where: { id: payment.invoice_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('SaaS invoice was not found');
      }
      if (invoice.status === SaasInvoiceStatus.VOID) {
        throw new BadRequestException(
          'Payments on voided invoices cannot be reversed',
        );
      }

      const amount = DecimalUtil.value(payment.amount);
      const nextPaid = DecimalUtil.value(invoice.paid_amount).minus(amount);
      if (nextPaid.lt(0)) {
        throw new ConflictException(
          'Payment reversal would make paid amount negative.',
        );
      }

      invoice.paid_amount = DecimalUtil.money(nextPaid);
      invoice.balance_amount = DecimalUtil.money(
        DecimalUtil.value(invoice.total_amount).minus(nextPaid),
      );
      invoice.status = nextPaid.eq(0)
        ? SaasInvoiceStatus.ISSUED
        : SaasInvoiceStatus.PARTIALLY_PAID;
      invoice.updated_by = user.id;

      payment.status = SaasPaymentStatus.REVERSED;
      payment.notes = [
        payment.notes,
        reason ? `Reversed: ${reason}` : 'Reversed',
      ]
        .filter(Boolean)
        .join('\n');
      payment.metadata = {
        ...(payment.metadata ?? {}),
        reversed_by: user.id,
        reversed_at: new Date().toISOString(),
        reversal_reason: reason ?? null,
      };

      await manager.getRepository(SaasInvoice).save(invoice);
      return manager.getRepository(SaasPayment).save(payment);
    });
  }

  async voidInvoice(
    user: AuthenticatedUser,
    invoiceId: string,
    reason?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.getRepository(SaasInvoice).findOne({
        where: { id: invoiceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('SaaS invoice was not found');
      }
      if (invoice.status === SaasInvoiceStatus.VOID) {
        return invoice;
      }
      if (DecimalUtil.value(invoice.paid_amount).gt(0)) {
        throw new BadRequestException(
          'Paid invoices cannot be voided. Reverse payments first.',
        );
      }

      invoice.status = SaasInvoiceStatus.VOID;
      invoice.voided_at = new Date();
      invoice.balance_amount = '0.00';
      invoice.updated_by = user.id;
      invoice.metadata = {
        ...(invoice.metadata ?? {}),
        void_reason: reason ?? null,
      };

      const cycle = await manager.getRepository(SaasBillingCycle).findOne({
        where: { id: invoice.cycle_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (cycle && cycle.status === SaasBillingCycleStatus.INVOICED) {
        cycle.status = SaasBillingCycleStatus.CALCULATED;
        await manager.getRepository(SaasBillingCycle).save(cycle);
      }

      return manager.getRepository(SaasInvoice).save(invoice);
    });
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
    return this.dataSource.transaction(async (manager) => {
      const adjustment = await manager
        .getRepository(SaasInvoiceAdjustment)
        .findOne({
          where: {
            id: adjustmentId,
          },
          lock: { mode: 'pessimistic_write' },
        });
      if (!adjustment) {
        throw new NotFoundException('Invoice adjustment was not found');
      }

      if (adjustment.status !== SaasInvoiceAdjustmentStatus.DRAFT) {
        throw new ConflictException('Only draft adjustments can be approved.');
      }

      const invoice = await manager.getRepository(SaasInvoice).findOne({
        where: {
          id: adjustment.invoice_id,
        },
        lock: { mode: 'pessimistic_write' },
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
          nextBalance =
            DecimalUtil.value(currentBalance).minus(adjustmentAmount);
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

      await manager.getRepository(SaasInvoice).save(invoice);
      await manager.getRepository(SaasInvoiceAdjustment).save(adjustment);
      await this.restoreSubscriptionAfterPayment(
        invoice.subscription_id,
        user.id,
        manager,
      );

      return adjustment;
    });
  }

  @Cron(process.env.SAAS_BILLING_CRON ?? '0 30 2 * * *')
  async processDailyBilling() {
    const now = new Date();
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        deleted_at: IsNull(),
        status: In([
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
        ]),
      },
      order: { current_period_end: 'ASC' },
    });

    let trialsExpired = 0;
    let cyclesProcessed = 0;
    let invoicesIssued = 0;

    for (const subscription of subscriptions) {
      if (
        subscription.status === SubscriptionStatus.TRIALING &&
        subscription.trial_ends_at &&
        subscription.trial_ends_at <= now
      ) {
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.state_version += 1;
        await this.subscriptionRepository.save(subscription);
        await this.subscriptionChangeRepository.save(
          this.subscriptionChangeRepository.create({
            subscription_id: subscription.id,
            company_id: subscription.company_id,
            change_type: SubscriptionChangeType.REACTIVATION,
            old_plan_version_id: subscription.plan_version_id,
            new_plan_version_id: subscription.plan_version_id,
            effective_at: now,
            change_summary: { source: 'TRIAL_EXPIRED' },
            changed_by: null,
          }),
        );
        trialsExpired += 1;
      }

      if (subscription.current_period_end > now) {
        continue;
      }

      await this.usageMeteringService.aggregateUsage(
        subscription.company_id,
        subscription.current_period_start,
        subscription.current_period_end,
        subscription.id,
      );
      const cycle = await this.ensureOpenCycleForSubscription(subscription.id);
      const invoice = await this.issueInvoice(
        { id: 'system' } as AuthenticatedUser,
        cycle.id,
      );
      if (invoice) {
        invoicesIssued += 1;
      }
      await this.rollSubscriptionPeriod(subscription.id, now);
      cyclesProcessed += 1;
    }

    return { trialsExpired, cyclesProcessed, invoicesIssued };
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

    for (const candidate of overdueInvoices) {
      const didProcess = await this.dataSource.transaction(async (manager) => {
        const invoice = await manager.getRepository(SaasInvoice).findOne({
          where: { id: candidate.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!invoice) {
          return false;
        }

        if (DecimalUtil.value(invoice.balance_amount).lte(0)) {
          return false;
        }

        const subscription = await manager
          .getRepository(CompanySubscription)
          .findOne({
            where: { id: invoice.subscription_id },
            lock: { mode: 'pessimistic_write' },
          });
        if (!subscription) {
          return false;
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
            await manager.getRepository(SubscriptionChange).save(
              manager.getRepository(SubscriptionChange).create({
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

        await manager.getRepository(SaasInvoice).save(invoice);
        await manager.getRepository(CompanySubscription).save(subscription);
        return true;
      });
      if (didProcess) {
        processed += 1;
      }
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

  private async rollSubscriptionPeriod(subscriptionId: string, billedAt: Date) {
    return this.dataSource.transaction(async (manager) => {
      const subscription = await manager
        .getRepository(CompanySubscription)
        .findOne({
          where: { id: subscriptionId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!subscription) {
        throw new NotFoundException('Subscription was not found');
      }

      const previousPeriodEnd = subscription.current_period_end;
      const nextStart = DateTime.fromJSDate(previousPeriodEnd).plus({
        millisecond: 1,
      });
      const nextEnd = this.addBillingInterval(
        nextStart,
        subscription.billing_interval,
      ).minus({ day: 1 });

      subscription.last_billed_at = billedAt;
      subscription.current_period_start = nextStart.toJSDate();
      subscription.current_period_end = nextEnd.toJSDate();
      subscription.next_billing_at = nextEnd.toJSDate();
      subscription.state_version += 1;

      const saved = await manager
        .getRepository(CompanySubscription)
        .save(subscription);
      await manager.getRepository(SubscriptionChange).save(
        manager.getRepository(SubscriptionChange).create({
          subscription_id: saved.id,
          company_id: saved.company_id,
          change_type: SubscriptionChangeType.RENEWAL,
          old_plan_version_id: saved.plan_version_id,
          new_plan_version_id: saved.plan_version_id,
          effective_at: saved.current_period_start,
          change_summary: {
            source: 'DAILY_BILLING',
            previous_period_end: previousPeriodEnd.toISOString(),
            current_period_end: saved.current_period_end.toISOString(),
          },
          changed_by: null,
        }),
      );
      return saved;
    });
  }

  private addBillingInterval(
    value: DateTime<true> | DateTime<false>,
    interval: BillingInterval,
  ) {
    switch (interval) {
      case BillingInterval.QUARTERLY:
        return value.plus({ month: 3 });
      case BillingInterval.YEARLY:
        return value.plus({ year: 1 });
      case BillingInterval.MONTHLY:
      default:
        return value.plus({ month: 1 });
    }
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
    manager = this.dataSource.manager,
  ) {
    const autoRestore = this.configService.get<boolean>(
      'SAAS_AUTO_RESTORE_AFTER_PAYMENT',
      true,
    );
    if (!autoRestore) {
      return;
    }

    const subscription = await manager
      .getRepository(CompanySubscription)
      .findOne({
        where: { id: subscriptionId },
        lock: { mode: 'pessimistic_write' },
      });
    if (
      !subscription ||
      ![SubscriptionStatus.PAST_DUE, SubscriptionStatus.SUSPENDED].includes(
        subscription.status,
      )
    ) {
      return;
    }

    const outstanding = await manager.getRepository(SaasInvoice).count({
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
    await manager.getRepository(CompanySubscription).save(subscription);

    await manager.getRepository(SubscriptionChange).save(
      manager.getRepository(SubscriptionChange).create({
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
