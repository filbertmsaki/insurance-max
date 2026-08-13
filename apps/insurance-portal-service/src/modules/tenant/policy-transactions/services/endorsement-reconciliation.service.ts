import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceSourceType,
  PolicyTransactionPremiumEffect,
  PolicyTransactionStage,
  WorkflowSubmissionStatus,
} from '@insurance-max/contracts';

import { DocumentLink } from '../../insurance-documents/entities/document-link.entity';
import { FinanceRefund } from '../../billing-commission/entities/finance-refund.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionApplyService } from './policy-transaction-apply.service';
import { PolicyTransactionReturnPremiumService } from './policy-transaction-return-premium.service';
import { DataSource } from 'typeorm';

interface ReconciliationIssue {
  code: string;
  message: string;
  repairable: boolean;
}

@Injectable()
export class EndorsementReconciliationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly applyService: PolicyTransactionApplyService,
    private readonly returnPremiumService: PolicyTransactionReturnPremiumService,
  ) {}

  async inspect(companyId: string, transactionId: string) {
    const transaction = await this.dataSource
      .getRepository(PolicyTransaction)
      .findOne({
        where: {
          id: transactionId,
          company_id: companyId,
        },
      });

    if (!transaction) {
      throw new NotFoundException('Endorsement transaction was not found.');
    }

    const [endorsement, policy, targetVersion, refunds, documents] =
      await Promise.all([
        this.dataSource.getRepository(PolicyEndorsement).findOne({
          where: {
            company_id: companyId,
            policy_transaction_id: transaction.id,
          },
        }),
        this.dataSource.getRepository(Policy).findOne({
          where: {
            id: transaction.source_policy_id,
            company_id: companyId,
          },
        }),
        transaction.target_policy_version_id
          ? this.dataSource.getRepository(PolicyVersion).findOne({
              where: {
                id: transaction.target_policy_version_id,
                company_id: companyId,
              },
            })
          : Promise.resolve(null),
        this.dataSource.getRepository(FinanceRefund).find({
          where: {
            company_id: companyId,
            source_type: InvoiceSourceType.ENDORSEMENT,
            source_record_id: transaction.id,
          },
          order: { created_at: 'ASC' },
        }),
        this.dataSource.getRepository(DocumentLink).find({
          where: {
            company_id: companyId,
            linked_record_type: 'POLICY_ENDORSEMENT',
            linked_record_id: transaction.id,
          },
          relations: { document: true },
        }),
      ]);

    const issues: ReconciliationIssue[] = [];

    if (
      transaction.stage === PolicyTransactionStage.APPLIED &&
      !targetVersion
    ) {
      issues.push({
        code: 'TARGET_POLICY_VERSION_MISSING',
        message:
          'The transaction is APPLIED but the target policy version is missing.',
        repairable: false,
      });
    }

    if (
      transaction.stage === PolicyTransactionStage.APPLIED &&
      policy &&
      targetVersion &&
      policy.active_version_id !== targetVersion.id
    ) {
      issues.push({
        code: 'ACTIVE_VERSION_MISMATCH',
        message:
          'Policy active_version_id does not point to the endorsement version.',
        repairable: false,
      });
    }

    if (
      endorsement?.requires_new_cover_note &&
      !endorsement.replacement_cover_note_reference
    ) {
      issues.push({
        code: 'REPLACEMENT_COVER_NOTE_MISSING',
        message:
          'The endorsement requires a replacement cover note but none is recorded.',
        repairable: false,
      });
    }

    if (
      transaction.stage === PolicyTransactionStage.APPLIED &&
      transaction.premium_effect === PolicyTransactionPremiumEffect.CREDIT &&
      !refunds.length
    ) {
      issues.push({
        code: 'RETURN_PREMIUM_NOT_REQUESTED',
        message:
          'Policy V2 was applied with a return premium but no refund request exists.',
        repairable: Boolean(policy && endorsement),
      });
    }

    if (
      transaction.stage === PolicyTransactionStage.APPLIED &&
      !documents.length
    ) {
      issues.push({
        code: 'ENDORSEMENT_DOCUMENT_MISSING',
        message: 'The endorsement schedule has not been generated.',
        repairable: false,
      });
    }

    return {
      healthy: issues.length === 0,
      transaction,
      endorsement,
      policy,
      target_version: targetVersion,
      refunds,
      documents,
      issues,
    };
  }

  async reconcile(companyId: string, transactionId: string) {
    let status = await this.inspect(companyId, transactionId);

    if (
      status.transaction.submission_status ===
        WorkflowSubmissionStatus.ACCEPTED &&
      status.transaction.stage !== PolicyTransactionStage.APPLIED
    ) {
      await this.applyService.applyEndorsement(companyId, transactionId);
    }

    status = await this.inspect(companyId, transactionId);

    if (
      status.transaction.stage === PolicyTransactionStage.APPLIED &&
      status.transaction.premium_effect ===
        PolicyTransactionPremiumEffect.CREDIT &&
      status.policy &&
      status.endorsement &&
      !status.refunds.length
    ) {
      await this.dataSource.transaction((manager) =>
        this.returnPremiumService.createRequests(
          manager,
          status.transaction,
          status.policy!,
          status.endorsement!.id,
          InvoiceSourceType.ENDORSEMENT,
        ),
      );
    }

    return this.inspect(companyId, transactionId);
  }
}
