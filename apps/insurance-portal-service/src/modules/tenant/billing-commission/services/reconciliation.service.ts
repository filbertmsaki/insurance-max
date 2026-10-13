import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  PaymentTransactionStatus,
  ReconciliationBatchStatus,
  ReconciliationItemStatus,
  ReceiptStatus,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { DataSource, ILike, In, IsNull } from 'typeorm';
import { AuditService } from '../../../shared/audit/audit.service';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import {
  ApproveReconciliationBatchDto,
  CreateReconciliationBatchDto,
  ExcludeReconciliationItemDto,
  ImportReconciliationBatchDto,
  MatchReconciliationItemDto,
  PostReconciliationBatchDto,
} from '../dto/finance-operations.dto';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';
import type { FinanceListQuery } from '../dto/find-finance-records-query.dto';
import { FinanceReconciliationBatch } from '../entities/finance-reconciliation-batch.entity';
import { FinanceReconciliationItem } from '../entities/finance-reconciliation-item.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { Receipt } from '../entities/receipt.entity';

interface MatchCandidate {
  paymentTransactionId: string;
  receiptId: string | null;
  score: number;
  reason: string;
}

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly identifierService: IdentifierGeneratorService,
    private readonly hashService: ProductDefinitionHashService,
    private readonly auditService: AuditService,
  ) {}

  async listBatches(companyId: string) {
    return this.dataSource.getRepository(FinanceReconciliationBatch).find({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
    });
  }

  async findBatchPage(companyId: string, query: FinanceListQuery) {
    const qb = this.dataSource
      .getRepository(FinanceReconciliationBatch)
      .createQueryBuilder('batch')
      .where('batch.company_id = :companyId', { companyId });
    if (query.status) {
      qb.andWhere('UPPER(batch.status) = :status', {
        status: query.status.toUpperCase(),
      });
    }
    return paginateQueryBuilder(qb, query, {
      sortable: {
        batch_no: 'batch.batch_no',
        provider_code: 'batch.provider_code',
        statement_date: 'batch.statement_date',
        statement_total: 'batch.statement_total',
        status: 'batch.status',
        created_at: 'batch.created_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'batch.batch_no',
        'batch.provider_code',
        'batch.statement_reference',
        'batch.account_reference',
        'batch.status',
      ],
      tieBreaker: 'batch.id',
    });
  }

  async findBatch(companyId: string, batchId: string) {
    const batch = await this.dataSource
      .getRepository(FinanceReconciliationBatch)
      .findOne({
        where: { id: batchId, company_id: companyId },
        relations: {
          items: true,
        },
      });

    if (!batch) {
      throw new NotFoundException('Reconciliation batch was not found.');
    }

    return batch;
  }

  async createBatch(
    user: AuthenticatedUser,
    dto: CreateReconciliationBatchDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const batchNo = await this.identifierService.generateRequestId(
        user.companyId!,
        manager,
      );

      return manager.getRepository(FinanceReconciliationBatch).save(
        manager.getRepository(FinanceReconciliationBatch).create({
          company_id: user.companyId!,
          batch_no: batchNo,
          provider_code: dto.provider_code.trim().toUpperCase(),
          account_reference: dto.account_reference?.trim() ?? null,
          statement_reference: dto.statement_reference?.trim() ?? null,
          statement_date: dto.statement_date,
          currency_code: dto.currency_code.trim().toUpperCase(),
          opening_balance:
            dto.opening_balance === undefined
              ? null
              : DecimalUtil.value(dto.opening_balance).toFixed(4),
          closing_balance:
            dto.closing_balance === undefined
              ? null
              : DecimalUtil.value(dto.closing_balance).toFixed(4),
          statement_total: '0.0000',
          matched_total: '0.0000',
          unmatched_total: '0.0000',
          status: ReconciliationBatchStatus.DRAFT,
        }),
      );
    });
  }

  async importBatch(
    user: AuthenticatedUser,
    batchId: string,
    dto: ImportReconciliationBatchDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager
        .getRepository(FinanceReconciliationBatch)
        .createQueryBuilder('batch')
        .setLock('pessimistic_write')
        .where('batch.id = :batchId', { batchId })
        .andWhere('batch.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!batch) {
        throw new NotFoundException('Reconciliation batch was not found.');
      }

      if (
        batch.status !== ReconciliationBatchStatus.DRAFT &&
        batch.status !== ReconciliationBatchStatus.IMPORTED
      ) {
        throw new ConflictException(
          'The reconciliation batch cannot be imported in its current status.',
        );
      }

      if (dto.items.some((item) => Number(item.amount) === 0)) {
        throw new BadRequestException('Statement line amount cannot be zero.');
      }

      const normalizedPayload = dto.items.map((item, index) => ({
        lineNumber: item.line_number ?? index + 1,
        transactionDate: item.transaction_date,
        valueDate: item.value_date ?? null,
        description: this.normalizeDescription(item.description),
        externalReference: item.external_reference?.trim() ?? null,
        payerReference: item.payer_reference?.trim() ?? null,
        amount: DecimalUtil.value(item.amount).toFixed(4),
        currencyCode: item.currency_code.trim().toUpperCase(),
      }));

      const lineNumbers = normalizedPayload.map((item) => item.lineNumber);
      if (new Set(lineNumbers).size !== lineNumbers.length) {
        throw new BadRequestException(
          'Statement line numbers must be unique within a batch.',
        );
      }

      if (
        normalizedPayload.some(
          (item) => item.currencyCode !== batch.currency_code,
        )
      ) {
        throw new BadRequestException(
          'Every statement line must use the batch currency.',
        );
      }

      const fileHash =
        dto.file_hash?.trim() ||
        this.hashService.hashDefinition(
          normalizedPayload as unknown as Record<string, unknown>,
        );

      const duplicateBatch = await manager
        .getRepository(FinanceReconciliationBatch)
        .findOne({
          where: {
            company_id: user.companyId!,
            file_hash: fileHash,
          },
        });

      if (duplicateBatch && duplicateBatch.id !== batch.id) {
        throw new ConflictException({
          code: 'RECONCILIATION_BATCH_DUPLICATE',
          message: 'The imported reconciliation file already exists.',
        });
      }

      await manager
        .getRepository(FinanceReconciliationItem)
        .delete({ batch_id: batch.id });

      const seen = new Set<string>();
      const items = normalizedPayload.map((item) => {
        const duplicateKey = this.hashService.hashDefinition({
          providerCode: batch.provider_code,
          accountReference: batch.account_reference,
          transactionDate: item.transactionDate,
          amount: item.amount,
          currencyCode: item.currencyCode,
          externalReference: item.externalReference,
          normalizedDescription: item.description,
        });
        const duplicate = seen.has(duplicateKey);
        seen.add(duplicateKey);

        return manager.getRepository(FinanceReconciliationItem).create({
          company_id: user.companyId!,
          batch_id: batch.id,
          line_number: item.lineNumber,
          transaction_date: item.transactionDate,
          value_date: item.valueDate,
          description: item.description,
          external_reference: item.externalReference,
          payer_reference: item.payerReference,
          amount: item.amount,
          currency_code: item.currencyCode,
          status: duplicate
            ? ReconciliationItemStatus.DUPLICATE
            : ReconciliationItemStatus.UNMATCHED,
        });
      });

      await manager.getRepository(FinanceReconciliationItem).save(items);

      batch.file_hash = fileHash;
      batch.imported_by = user.id;
      batch.imported_at = new Date();
      batch.status = ReconciliationBatchStatus.IMPORTED;

      const statementTotal = this.calculateStatementTotal(items);
      if (
        batch.opening_balance !== null &&
        batch.closing_balance !== null &&
        !DecimalUtil.value(batch.opening_balance)
          .plus(statementTotal)
          .equals(DecimalUtil.value(batch.closing_balance))
      ) {
        throw new BadRequestException(
          'Closing balance must equal opening balance plus the imported statement total.',
        );
      }

      await this.recalculateBatchTotals(manager, batch);
      const saved = await manager
        .getRepository(FinanceReconciliationBatch)
        .save(batch);
      await this.auditService.logCritical(
        {
          userId: user.id,
          companyId: user.companyId,
          action: 'finance.reconciliation.imported',
          resource: 'finance_reconciliation_batch',
          resourceId: saved.id,
          reason: 'Statement rows imported for reconciliation',
          metadata: {
            itemCount: normalizedPayload.length,
            fileHash,
            statementTotal: batch.statement_total,
            duplicateCount: items.filter(
              (item) => item.status === ReconciliationItemStatus.DUPLICATE,
            ).length,
          },
        },
        manager,
      );
      return saved;
    });
  }

  async autoMatch(user: AuthenticatedUser, batchId: string) {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager
        .getRepository(FinanceReconciliationBatch)
        .createQueryBuilder('batch')
        .setLock('pessimistic_write')
        .where('batch.id = :batchId', { batchId })
        .andWhere('batch.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!batch) {
        throw new NotFoundException('Reconciliation batch was not found.');
      }

      if (
        batch.status !== ReconciliationBatchStatus.IMPORTED &&
        batch.status !== ReconciliationBatchStatus.PARTIALLY_MATCHED
      ) {
        throw new ConflictException(
          'The reconciliation batch cannot be matched.',
        );
      }

      batch.status = ReconciliationBatchStatus.MATCHING;
      await manager.getRepository(FinanceReconciliationBatch).save(batch);

      const items = await manager
        .getRepository(FinanceReconciliationItem)
        .find({
          where: {
            batch_id: batch.id,
            status: In([
              ReconciliationItemStatus.UNMATCHED,
              ReconciliationItemStatus.SUGGESTED,
            ]),
          },
        });

      const existingMatchedItems = await manager
        .getRepository(FinanceReconciliationItem)
        .find({
          where: {
            company_id: user.companyId!,
            status: ReconciliationItemStatus.MATCHED,
          },
          select: ['batch_id', 'matched_payment_transaction_id'],
        });
      const matchedPaymentIds = new Set(
        existingMatchedItems
          .filter((matched) => matched.batch_id !== batch.id)
          .map((matched) => matched.matched_payment_transaction_id)
          .filter((id): id is string => !!id),
      );

      const threshold = this.configService.get<number>(
        'FINANCE_RECONCILIATION_AUTO_MATCH_SCORE',
        90,
      );

      for (const item of items) {
        const suggestions = await this.findCandidates(manager, batch, item);
        const best = suggestions[0];

        if (
          best &&
          !matchedPaymentIds.has(best.paymentTransactionId) &&
          best.score >= threshold &&
          suggestions.filter((candidate) => candidate.score === best.score)
            .length === 1
        ) {
          item.status = ReconciliationItemStatus.MATCHED;
          item.matched_payment_transaction_id = best.paymentTransactionId;
          item.matched_receipt_id = best.receiptId;
          item.match_score = String(best.score);
          item.match_reason = best.reason;
          item.matched_by = user.id;
          item.matched_at = new Date();
          matchedPaymentIds.add(best.paymentTransactionId);
        } else if (best) {
          item.status = ReconciliationItemStatus.SUGGESTED;
          item.match_score = String(best.score);
          item.match_reason = best.reason;
        }
      }

      await this.saveMatchedItems(manager, items);
      await this.recalculateBatchTotals(manager, batch);
      await manager.getRepository(FinanceReconciliationBatch).save(batch);

      await this.auditService.logCritical(
        {
          userId: user.id,
          companyId: user.companyId,
          action: 'finance.reconciliation.auto_matched',
          resource: 'finance_reconciliation_batch',
          resourceId: batch.id,
          metadata: {
            matchedCount: items.filter(
              (item) => item.status === ReconciliationItemStatus.MATCHED,
            ).length,
            suggestedCount: items.filter(
              (item) => item.status === ReconciliationItemStatus.SUGGESTED,
            ).length,
          },
        },
        manager,
      );

      return manager
        .getRepository(FinanceReconciliationBatch)
        .findOneOrFail({ where: { id: batch.id } });
    });
  }

  async matchItem(
    user: AuthenticatedUser,
    itemId: string,
    dto: MatchReconciliationItemDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager
        .getRepository(FinanceReconciliationItem)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.id = :itemId', { itemId })
        .andWhere('item.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!item) {
        throw new NotFoundException('Reconciliation item was not found.');
      }

      const itemBatch = await manager
        .getRepository(FinanceReconciliationBatch)
        .findOne({ where: { id: item.batch_id, company_id: user.companyId! } });
      if (
        !itemBatch ||
        itemBatch.status === ReconciliationBatchStatus.POSTED ||
        itemBatch.status === ReconciliationBatchStatus.APPROVED
      ) {
        throw new ConflictException(
          'Items in an approved or posted reconciliation batch cannot be changed.',
        );
      }

      if (!dto.payment_transaction_id && !dto.receipt_id) {
        throw new BadRequestException(
          'A payment transaction or receipt must be selected.',
        );
      }

      const previousPaymentId = item.matched_payment_transaction_id;

      if (dto.payment_transaction_id) {
        const payment = await manager
          .getRepository(PaymentTransaction)
          .findOne({
            where: {
              id: dto.payment_transaction_id,
              company_id: user.companyId!,
            },
          });

        if (!payment) {
          throw new NotFoundException('Payment transaction was not found.');
        }

        this.assertPaymentMatchesItem(payment, item);
        await this.assertPaymentNotMatched(manager, payment.id, item.id);

        item.matched_payment_transaction_id = payment.id;
        if (dto.receipt_id) {
          const receipt = await manager.getRepository(Receipt).findOne({
            where: { id: dto.receipt_id, company_id: user.companyId! },
          });
          if (!receipt) {
            throw new NotFoundException('Receipt was not found.');
          }
          this.assertReceiptMatchesItem(receipt, item);
          await this.assertReceiptNotMatched(manager, receipt.id, item.id);
          if (payment.receipt_id && payment.receipt_id !== receipt.id) {
            throw new BadRequestException(
              'The selected receipt does not belong to the payment transaction.',
            );
          }
          item.matched_receipt_id = receipt.id;
        } else {
          item.matched_receipt_id = payment.receipt_id;
        }
      } else if (dto.receipt_id) {
        const receipt = await manager.getRepository(Receipt).findOne({
          where: {
            id: dto.receipt_id,
            company_id: user.companyId!,
          },
        });

        if (!receipt) {
          throw new NotFoundException('Receipt was not found.');
        }

        this.assertReceiptMatchesItem(receipt, item);
        await this.assertReceiptNotMatched(manager, receipt.id, item.id);

        item.matched_receipt_id = receipt.id;
      }

      item.status = ReconciliationItemStatus.MATCHED;
      item.match_score = '100';
      item.match_reason = dto.reason?.trim() ?? 'Manual reconciliation match';
      item.matched_by = user.id;
      item.matched_at = new Date();

      if (
        previousPaymentId &&
        previousPaymentId !== item.matched_payment_transaction_id
      ) {
        await manager
          .getRepository(PaymentTransaction)
          .update(
            { id: previousPaymentId, company_id: user.companyId! },
            { reconciliation_status: ReconciliationItemStatus.UNMATCHED },
          );
      }

      const saved = await this.saveMatchedItem(manager, item);
      const updatedBatch = await manager
        .getRepository(FinanceReconciliationBatch)
        .findOneByOrFail({ id: item.batch_id });
      await this.recalculateBatchTotals(manager, updatedBatch);
      await manager
        .getRepository(FinanceReconciliationBatch)
        .save(updatedBatch);

      await this.auditService.logCritical(
        {
          userId: user.id,
          companyId: user.companyId,
          action: 'finance.reconciliation.item_matched',
          resource: 'finance_reconciliation_item',
          resourceId: saved.id,
          reason: saved.match_reason ?? undefined,
          metadata: {
            batchId: item.batch_id,
            paymentTransactionId: saved.matched_payment_transaction_id,
            receiptId: saved.matched_receipt_id,
            amount: item.amount,
            currency: item.currency_code,
          },
        },
        manager,
      );

      return saved;
    });
  }

  async excludeItem(
    user: AuthenticatedUser,
    itemId: string,
    dto: ExcludeReconciliationItemDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager
        .getRepository(FinanceReconciliationItem)
        .findOne({
          where: {
            id: itemId,
            company_id: user.companyId!,
          },
        });

      if (!item) {
        throw new NotFoundException('Reconciliation item was not found.');
      }

      const itemBatch = await manager
        .getRepository(FinanceReconciliationBatch)
        .findOne({ where: { id: item.batch_id, company_id: user.companyId! } });
      if (
        !itemBatch ||
        itemBatch.status === ReconciliationBatchStatus.POSTED ||
        itemBatch.status === ReconciliationBatchStatus.APPROVED
      ) {
        throw new ConflictException(
          'Items in an approved or posted reconciliation batch cannot be changed.',
        );
      }

      item.status = ReconciliationItemStatus.EXCLUDED;
      item.match_reason = dto.reason?.trim() ?? 'Excluded from reconciliation';
      item.match_score = null;
      const matchedPaymentId = item.matched_payment_transaction_id;
      item.matched_payment_transaction_id = null;
      item.matched_receipt_id = null;
      item.matched_by = user.id;
      item.matched_at = new Date();

      if (matchedPaymentId) {
        await manager.getRepository(PaymentTransaction).update(
          {
            id: matchedPaymentId,
            company_id: user.companyId!,
          },
          { reconciliation_status: ReconciliationItemStatus.UNMATCHED },
        );
      }

      const saved = await manager
        .getRepository(FinanceReconciliationItem)
        .save(item);
      const updatedBatch = await manager
        .getRepository(FinanceReconciliationBatch)
        .findOneByOrFail({ id: item.batch_id });
      await this.recalculateBatchTotals(manager, updatedBatch);
      await manager
        .getRepository(FinanceReconciliationBatch)
        .save(updatedBatch);

      await this.auditService.logCritical(
        {
          userId: user.id,
          companyId: user.companyId,
          action: 'finance.reconciliation.item_excluded',
          resource: 'finance_reconciliation_item',
          resourceId: saved.id,
          reason: saved.match_reason ?? undefined,
          metadata: {
            batchId: item.batch_id,
            amount: item.amount,
            currency: item.currency_code,
          },
        },
        manager,
      );

      return saved;
    });
  }

  async approveBatch(
    user: AuthenticatedUser,
    batchId: string,
    _dto: ApproveReconciliationBatchDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager
        .getRepository(FinanceReconciliationBatch)
        .createQueryBuilder('batch')
        .setLock('pessimistic_write')
        .where('batch.id = :batchId', { batchId })
        .andWhere('batch.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!batch) {
        throw new NotFoundException('Reconciliation batch was not found.');
      }

      if (batch.imported_by === user.id) {
        throw new ConflictException(
          'The importer cannot approve the same reconciliation batch.',
        );
      }

      if (
        batch.status !== ReconciliationBatchStatus.MATCHED &&
        batch.status !== ReconciliationBatchStatus.PARTIALLY_MATCHED
      ) {
        throw new ConflictException(
          'Only matched reconciliation batches can be approved.',
        );
      }

      const matchedItems = await manager
        .getRepository(FinanceReconciliationItem)
        .find({
          where: {
            batch_id: batch.id,
            status: ReconciliationItemStatus.MATCHED,
          },
        });
      if (matchedItems.some((item) => item.matched_by === user.id)) {
        throw new ConflictException(
          'A user who matched a reconciliation line cannot approve the same batch.',
        );
      }
      const paymentIds = matchedItems
        .map((item) => item.matched_payment_transaction_id)
        .filter((id): id is string => !!id);
      const receiptIds = matchedItems
        .map((item) => item.matched_receipt_id)
        .filter((id): id is string => !!id);
      if (new Set(paymentIds).size !== paymentIds.length) {
        throw new ConflictException(
          'A payment transaction cannot be matched to multiple statement lines.',
        );
      }
      if (new Set(receiptIds).size !== receiptIds.length) {
        throw new ConflictException(
          'A receipt cannot be matched to multiple statement lines.',
        );
      }
      const existingMatches = await manager
        .getRepository(FinanceReconciliationItem)
        .find({
          where: {
            company_id: user.companyId!,
            status: ReconciliationItemStatus.MATCHED,
          },
          select: [
            'id',
            'batch_id',
            'matched_payment_transaction_id',
            'matched_receipt_id',
          ],
        });
      const otherBatchMatches = existingMatches.filter(
        (item) => item.batch_id !== batch.id,
      );
      if (
        paymentIds.some((id) =>
          otherBatchMatches.some(
            (matched) => matched.matched_payment_transaction_id === id,
          ),
        ) ||
        receiptIds.some((id) =>
          otherBatchMatches.some(
            (matched) => matched.matched_receipt_id === id,
          ),
        )
      ) {
        throw new ConflictException(
          'A payment or receipt is already reconciled against another statement line.',
        );
      }
      for (const item of matchedItems) {
        if (item.matched_payment_transaction_id) {
          const payment = await manager
            .getRepository(PaymentTransaction)
            .findOne({
              where: {
                id: item.matched_payment_transaction_id,
                company_id: user.companyId!,
              },
            });
          if (!payment) {
            throw new ConflictException(
              'A matched payment is no longer available to this company.',
            );
          }
          this.assertPaymentMatchesItem(payment, item);
          await manager.getRepository(PaymentTransaction).update(
            {
              id: payment.id,
              company_id: user.companyId!,
            },
            {
              reconciliation_status: ReconciliationItemStatus.MATCHED,
              reconciled_by: user.id,
              reconciled_at: new Date(),
            },
          );
        }
        if (item.matched_receipt_id) {
          const receipt = await manager.getRepository(Receipt).findOne({
            where: {
              id: item.matched_receipt_id,
              company_id: user.companyId!,
            },
          });
          if (!receipt) {
            throw new ConflictException(
              'A matched receipt is no longer available to this company.',
            );
          }
          this.assertReceiptMatchesItem(receipt, item);
        }
      }

      batch.status = ReconciliationBatchStatus.APPROVED;
      batch.approved_by = user.id;
      batch.approved_at = new Date();

      const saved = await manager
        .getRepository(FinanceReconciliationBatch)
        .save(batch);
      await this.auditService.logCritical(
        {
          userId: user.id,
          companyId: user.companyId,
          action: 'finance.reconciliation.approved',
          resource: 'finance_reconciliation_batch',
          resourceId: batch.id,
          metadata: { status: saved.status, matchedTotal: saved.matched_total },
        },
        manager,
      );
      return saved;
    });
  }

  async postBatch(
    user: AuthenticatedUser,
    batchId: string,
    _dto: PostReconciliationBatchDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager
        .getRepository(FinanceReconciliationBatch)
        .createQueryBuilder('batch')
        .setLock('pessimistic_write')
        .where('batch.id = :batchId', { batchId })
        .andWhere('batch.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .getOne();

      if (!batch) {
        throw new NotFoundException('Reconciliation batch was not found.');
      }

      if (batch.status === ReconciliationBatchStatus.POSTED) {
        return batch;
      }

      if (batch.status !== ReconciliationBatchStatus.APPROVED) {
        throw new ConflictException(
          'Only approved reconciliation batches may be posted.',
        );
      }

      const matchedItems = await manager
        .getRepository(FinanceReconciliationItem)
        .find({
          where: {
            batch_id: batch.id,
            status: ReconciliationItemStatus.MATCHED,
          },
        });

      const matchedPaymentIds = new Set<string>();
      const matchedReceiptIds = new Set<string>();
      const existingMatches = await manager
        .getRepository(FinanceReconciliationItem)
        .find({
          where: {
            company_id: user.companyId!,
            status: ReconciliationItemStatus.MATCHED,
          },
          select: [
            'id',
            'batch_id',
            'matched_payment_transaction_id',
            'matched_receipt_id',
          ],
        });
      const otherBatchMatches = existingMatches.filter(
        (matched) => matched.batch_id !== batch.id,
      );

      for (const item of matchedItems) {
        if (item.matched_payment_transaction_id) {
          if (
            matchedPaymentIds.has(item.matched_payment_transaction_id) ||
            otherBatchMatches.some(
              (matched) =>
                matched.matched_payment_transaction_id ===
                item.matched_payment_transaction_id,
            )
          ) {
            throw new ConflictException(
              'A payment transaction cannot be posted against multiple statement lines.',
            );
          }
          matchedPaymentIds.add(item.matched_payment_transaction_id);
        }
        if (item.matched_receipt_id) {
          if (
            matchedReceiptIds.has(item.matched_receipt_id) ||
            otherBatchMatches.some(
              (matched) =>
                matched.matched_receipt_id === item.matched_receipt_id,
            )
          ) {
            throw new ConflictException(
              'A receipt cannot be posted against multiple statement lines.',
            );
          }
          matchedReceiptIds.add(item.matched_receipt_id);
        }
        if (item.matched_payment_transaction_id) {
          await manager.getRepository(PaymentTransaction).update(
            {
              id: item.matched_payment_transaction_id,
              company_id: user.companyId!,
            },
            {
              reconciliation_status: ReconciliationItemStatus.MATCHED,
              reconciled_by: user.id,
              reconciled_at: new Date(),
            },
          );
        }
      }

      batch.status = ReconciliationBatchStatus.POSTED;
      const saved = await manager
        .getRepository(FinanceReconciliationBatch)
        .save(batch);
      await this.auditService.logCritical(
        {
          userId: user.id,
          companyId: user.companyId,
          action: 'finance.reconciliation.posted',
          resource: 'finance_reconciliation_batch',
          resourceId: batch.id,
          metadata: {
            matchedItemCount: matchedItems.length,
            matchedTotal: batch.matched_total,
            statementTotal: batch.statement_total,
          },
        },
        manager,
      );
      return saved;
    });
  }

  private normalizeDescription(description?: string) {
    return description?.trim().replace(/\s+/g, ' ') ?? null;
  }

  private calculateStatementTotal(items: FinanceReconciliationItem[]) {
    return items.reduce(
      (total, item) =>
        item.status === ReconciliationItemStatus.DUPLICATE
          ? total
          : total.plus(DecimalUtil.value(item.amount)),
      DecimalUtil.value(0),
    );
  }

  private async saveMatchedItems(
    manager: DataSource['manager'],
    items: FinanceReconciliationItem[],
  ) {
    try {
      return await manager.getRepository(FinanceReconciliationItem).save(items);
    } catch (error) {
      this.throwMatchConflict(error);
      throw error;
    }
  }

  private async saveMatchedItem(
    manager: DataSource['manager'],
    item: FinanceReconciliationItem,
  ) {
    try {
      return await manager.getRepository(FinanceReconciliationItem).save(item);
    } catch (error) {
      this.throwMatchConflict(error);
      throw error;
    }
  }

  private throwMatchConflict(error: unknown): void {
    const driverError = (error as { driverError?: Record<string, unknown> })
      ?.driverError;
    const constraint = driverError?.constraint;
    if (
      driverError?.code === '23505' &&
      (constraint === 'UQ_reconciliation_matched_payment_active' ||
        constraint === 'UQ_reconciliation_matched_receipt_active')
    ) {
      throw new ConflictException(
        'The selected payment or receipt has already been matched to another statement line.',
      );
    }
  }

  private assertPaymentMatchesItem(
    payment: PaymentTransaction,
    item: FinanceReconciliationItem,
  ) {
    if (
      payment.status !== PaymentTransactionStatus.SUCCESSFUL ||
      payment.reversed_at !== null ||
      payment.deleted_at !== null ||
      payment.reconciliation_status === ReconciliationItemStatus.MATCHED ||
      DecimalUtil.value(payment.amount).toFixed(4) !==
        DecimalUtil.value(item.amount).toFixed(4) ||
      payment.currency.trim().toUpperCase() !== item.currency_code
    ) {
      throw new BadRequestException(
        'The payment must be successful and match the statement amount and currency.',
      );
    }
  }

  private assertReceiptMatchesItem(
    receipt: Receipt,
    item: FinanceReconciliationItem,
  ) {
    if (
      !(
        receipt.status === ReceiptStatus.POSTED ||
        receipt.status === ReceiptStatus.PARTIALLY_ALLOCATED ||
        receipt.status === ReceiptStatus.FULLY_ALLOCATED
      ) ||
      receipt.deleted_at !== null ||
      DecimalUtil.value(receipt.amount).toFixed(4) !==
        DecimalUtil.value(item.amount).toFixed(4) ||
      receipt.currency.trim().toUpperCase() !== item.currency_code
    ) {
      throw new BadRequestException(
        'The receipt must be posted and match the statement amount and currency.',
      );
    }
  }

  private async assertPaymentNotMatched(
    manager: DataSource['manager'],
    paymentId: string,
    currentItemId: string,
  ) {
    const existing = await manager
      .getRepository(FinanceReconciliationItem)
      .findOne({
        where: {
          matched_payment_transaction_id: paymentId,
          status: ReconciliationItemStatus.MATCHED,
        },
      });
    if (existing && existing.id !== currentItemId) {
      throw new ConflictException(
        'This payment transaction is already matched to another statement line.',
      );
    }
  }

  private async assertReceiptNotMatched(
    manager: DataSource['manager'],
    receiptId: string,
    currentItemId: string,
  ) {
    const existing = await manager
      .getRepository(FinanceReconciliationItem)
      .findOne({
        where: {
          matched_receipt_id: receiptId,
          status: ReconciliationItemStatus.MATCHED,
        },
      });
    if (existing && existing.id !== currentItemId) {
      throw new ConflictException(
        'This receipt is already matched to another statement line.',
      );
    }
  }

  private async findCandidates(
    manager: DataSource['manager'],
    batch: FinanceReconciliationBatch,
    item: FinanceReconciliationItem,
  ): Promise<MatchCandidate[]> {
    const candidates = new Map<string, MatchCandidate>();
    const amount = DecimalUtil.value(item.amount).toFixed(4);
    const references = [
      item.external_reference?.trim(),
      item.payer_reference?.trim(),
    ].filter((value): value is string => !!value);

    for (const reference of references) {
      const byProviderId = await manager
        .getRepository(PaymentTransaction)
        .find({
          where: {
            company_id: batch.company_id,
            provider_transaction_id: reference,
            currency: item.currency_code,
            amount,
            status: PaymentTransactionStatus.SUCCESSFUL,
            reconciliation_status: ReconciliationItemStatus.UNMATCHED,
            reversed_at: IsNull(),
            deleted_at: IsNull(),
          },
        });

      for (const payment of byProviderId) {
        this.upsertCandidate(candidates, {
          paymentTransactionId: payment.id,
          receiptId: payment.receipt_id,
          score: 100,
          reason: 'Exact provider transaction ID',
        });
      }

      const byReference = await manager.getRepository(PaymentTransaction).find({
        where: [
          {
            company_id: batch.company_id,
            bank_reference: reference,
            currency: item.currency_code,
            amount,
            status: PaymentTransactionStatus.SUCCESSFUL,
            reconciliation_status: ReconciliationItemStatus.UNMATCHED,
            reversed_at: IsNull(),
            deleted_at: IsNull(),
          },
          {
            company_id: batch.company_id,
            payment_reference: reference,
            currency: item.currency_code,
            amount,
            status: PaymentTransactionStatus.SUCCESSFUL,
            reconciliation_status: ReconciliationItemStatus.UNMATCHED,
            reversed_at: IsNull(),
            deleted_at: IsNull(),
          },
          {
            company_id: batch.company_id,
            provider_reference: reference,
            currency: item.currency_code,
            amount,
            status: PaymentTransactionStatus.SUCCESSFUL,
            reconciliation_status: ReconciliationItemStatus.UNMATCHED,
            reversed_at: IsNull(),
            deleted_at: IsNull(),
          },
        ],
      });

      for (const payment of byReference) {
        const score =
          payment.bank_reference === reference
            ? 95
            : payment.payment_reference === reference
              ? 90
              : 95;
        const reason =
          payment.bank_reference === reference
            ? 'Exact bank reference and amount'
            : 'Exact payment reference and amount';

        this.upsertCandidate(candidates, {
          paymentTransactionId: payment.id,
          receiptId: payment.receipt_id,
          score,
          reason,
        });
      }
    }

    if (item.description?.trim()) {
      const fuzzy = await manager.getRepository(PaymentTransaction).find({
        where: {
          company_id: batch.company_id,
          payer_name: ILike(`%${item.description.trim().slice(0, 30)}%`),
          currency: item.currency_code,
          amount,
          status: PaymentTransactionStatus.SUCCESSFUL,
          reconciliation_status: ReconciliationItemStatus.UNMATCHED,
          reversed_at: IsNull(),
          deleted_at: IsNull(),
        },
        take: 5,
      });

      for (const payment of fuzzy) {
        this.upsertCandidate(candidates, {
          paymentTransactionId: payment.id,
          receiptId: payment.receipt_id,
          score: 50,
          reason: 'Fuzzy payer name and amount',
        });
      }
    }

    return [...candidates.values()].sort(
      (left, right) => right.score - left.score,
    );
  }

  private upsertCandidate(
    candidates: Map<string, MatchCandidate>,
    candidate: MatchCandidate,
  ) {
    const existing = candidates.get(candidate.paymentTransactionId);

    if (!existing || candidate.score > existing.score) {
      candidates.set(candidate.paymentTransactionId, candidate);
    }
  }

  private async recalculateBatchTotals(
    manager: DataSource['manager'],
    batch: FinanceReconciliationBatch,
  ) {
    const items = await manager.getRepository(FinanceReconciliationItem).find({
      where: { batch_id: batch.id },
    });

    const statementTotal = items
      .filter((item) => item.status !== ReconciliationItemStatus.DUPLICATE)
      .reduce(
        (total, item) => total.plus(DecimalUtil.value(item.amount)),
        DecimalUtil.value(0),
      );
    const matchedTotal = items
      .filter((item) => item.status === ReconciliationItemStatus.MATCHED)
      .reduce(
        (total, item) => total.plus(DecimalUtil.value(item.amount)),
        DecimalUtil.value(0),
      );
    const unmatchedTotal = statementTotal.minus(matchedTotal);

    batch.statement_total = statementTotal.toFixed(4);
    batch.matched_total = matchedTotal.toFixed(4);
    batch.unmatched_total = unmatchedTotal.toFixed(4);

    if (items.length === 0) {
      batch.status = ReconciliationBatchStatus.DRAFT;
    } else if (matchedTotal.equals(0)) {
      batch.status = ReconciliationBatchStatus.IMPORTED;
    } else if (unmatchedTotal.equals(0)) {
      batch.status = ReconciliationBatchStatus.MATCHED;
    } else {
      batch.status = ReconciliationBatchStatus.PARTIALLY_MATCHED;
    }
  }
}
