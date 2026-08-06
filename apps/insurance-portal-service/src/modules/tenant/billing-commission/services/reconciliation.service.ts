import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  ReconciliationBatchStatus,
  ReconciliationItemStatus,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { DataSource, ILike, In } from 'typeorm';

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
  ) {}

  async listBatches(companyId: string) {
    return this.dataSource.getRepository(FinanceReconciliationBatch).find({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
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

      await this.recalculateBatchTotals(manager, batch);
      return manager.getRepository(FinanceReconciliationBatch).save(batch);
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

      const threshold = this.configService.get<number>(
        'FINANCE_RECONCILIATION_AUTO_MATCH_SCORE',
        90,
      );

      for (const item of items) {
        const suggestions = await this.findCandidates(manager, batch, item);
        const best = suggestions[0];

        if (
          best &&
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
        } else if (best) {
          item.status = ReconciliationItemStatus.SUGGESTED;
          item.match_score = String(best.score);
          item.match_reason = best.reason;
        }
      }

      await manager.getRepository(FinanceReconciliationItem).save(items);
      await this.recalculateBatchTotals(manager, batch);

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

      if (!dto.payment_transaction_id && !dto.receipt_id) {
        throw new BadRequestException(
          'A payment transaction or receipt must be selected.',
        );
      }

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

        item.matched_payment_transaction_id = payment.id;
        item.matched_receipt_id = dto.receipt_id ?? payment.receipt_id;
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

        item.matched_receipt_id = receipt.id;
      }

      item.status = ReconciliationItemStatus.MATCHED;
      item.match_score = '100';
      item.match_reason = dto.reason?.trim() ?? 'Manual reconciliation match';
      item.matched_by = user.id;
      item.matched_at = new Date();

      const saved = await manager
        .getRepository(FinanceReconciliationItem)
        .save(item);
      const batch = await manager
        .getRepository(FinanceReconciliationBatch)
        .findOneByOrFail({ id: item.batch_id });
      await this.recalculateBatchTotals(manager, batch);

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

      item.status = ReconciliationItemStatus.EXCLUDED;
      item.match_reason = dto.reason?.trim() ?? 'Excluded from reconciliation';
      item.match_score = null;
      item.matched_payment_transaction_id = null;
      item.matched_receipt_id = null;
      item.matched_by = user.id;
      item.matched_at = new Date();

      const saved = await manager
        .getRepository(FinanceReconciliationItem)
        .save(item);
      const batch = await manager
        .getRepository(FinanceReconciliationBatch)
        .findOneByOrFail({ id: item.batch_id });
      await this.recalculateBatchTotals(manager, batch);

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

      batch.status = ReconciliationBatchStatus.APPROVED;
      batch.approved_by = user.id;
      batch.approved_at = new Date();

      return manager.getRepository(FinanceReconciliationBatch).save(batch);
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

      for (const item of matchedItems) {
        if (item.matched_payment_transaction_id) {
          await manager
            .getRepository(PaymentTransaction)
            .update(item.matched_payment_transaction_id, {
              reconciliation_status: ReconciliationItemStatus.MATCHED,
              reconciled_by: user.id,
              reconciled_at: new Date(),
            });
        }
      }

      batch.status = ReconciliationBatchStatus.POSTED;
      return manager.getRepository(FinanceReconciliationBatch).save(batch);
    });
  }

  private normalizeDescription(description?: string) {
    return description?.trim().replace(/\s+/g, ' ') ?? null;
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
          },
          {
            company_id: batch.company_id,
            payment_reference: reference,
            currency: item.currency_code,
            amount,
          },
          {
            company_id: batch.company_id,
            provider_reference: reference,
            currency: item.currency_code,
            amount,
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

    const statementTotal = items.reduce(
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
