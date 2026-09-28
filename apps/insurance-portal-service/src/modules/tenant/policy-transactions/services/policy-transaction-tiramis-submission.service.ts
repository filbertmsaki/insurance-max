import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  PolicyTransactionType,
  ServicePolicyTransactionContext,
} from '@insurance-max/contracts';

import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { TiramisBusinessSubmitService } from '../../../tiramis/services/tiramis-business-submit.service';
import { TiramisRequestType } from '../../../tiramis/enums/tiramis-request-type.enum';
import { Policy } from '../../policies/entities/policy.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { PolicyCancellation } from '../entities/policy-cancellation.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionLifecycleService } from './policy-transaction-lifecycle.service';
import { PolicyTransactionTiramisPayloadService } from './policy-transaction-tiramis-payload.service';
import {
  PolicyTransactionTiramisServiceContext,
  PolicyTransactionTiramisServiceContextService,
} from './policy-transaction-tiramis-service-context.service';

const FLOW_TO_REQUEST_TYPE: Record<
  QuotationFlow,
  | TiramisRequestType.NON_MOTOR
  | TiramisRequestType.MOTOR
  | TiramisRequestType.MOTOR_FLEET
> = {
  [QuotationFlow.NON_MOTOR]: TiramisRequestType.NON_MOTOR,
  [QuotationFlow.MOTOR_SINGLE]: TiramisRequestType.MOTOR,
  [QuotationFlow.MOTOR_FLEET]: TiramisRequestType.MOTOR_FLEET,
};

/**
 * Submits an endorsement/cancellation resubmission to TIRAMIS by reusing the
 * generic `TiramisIntegrationService.submitToTiramis` pipeline already used
 * for quotations/cover-notes — same tracking entity, same idempotency-by-
 * business-reference behaviour, same async ack/final-response/callback
 * loop. Resolution back into `PolicyTransactionLifecycleService.markSubmissionAccepted`
 * / `PolicyTransactionApplyService` happens from
 * `TiramisIntegrationService`'s notification handler once the callback
 * arrives (mirrors how renewal/issuance outcomes are applied there today).
 */
@Injectable()
export class PolicyTransactionTiramisSubmissionService {
  constructor(
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    @InjectRepository(PolicyEndorsement)
    private readonly endorsementRepository: Repository<PolicyEndorsement>,
    @InjectRepository(PolicyCancellation)
    private readonly cancellationRepository: Repository<PolicyCancellation>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    private readonly payloadService: PolicyTransactionTiramisPayloadService,
    private readonly serviceContextService: PolicyTransactionTiramisServiceContextService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly dataAccessScopeService: DataAccessScopeService,
    private readonly tiramisBusinessSubmitService: TiramisBusinessSubmitService,
  ) {}

  async submitEndorsement(user: AuthenticatedUser, transactionId: string) {
    const transaction = await this.requireTransaction(
      user,
      transactionId,
      PolicyTransactionType.ENDORSEMENT,
    );
    const endorsement = await this.endorsementRepository.findOne({
      where: { policy_transaction_id: transaction.id },
    });
    const policy = await this.policyRepository.findOne({
      where: { id: transaction.source_policy_id },
    });

    if (!endorsement || !policy) {
      throw new BadRequestException(
        'Endorsement or source policy could not be resolved.',
      );
    }

    const payload = await this.payloadService.buildEndorsementPayload(
      transaction,
      endorsement,
      policy,
    );

    return this.submit(user, transaction, policy, payload);
  }

  async submitCancellation(user: AuthenticatedUser, transactionId: string) {
    const transaction = await this.requireTransaction(
      user,
      transactionId,
      PolicyTransactionType.CANCELLATION,
    );
    const cancellation = await this.cancellationRepository.findOne({
      where: { policy_transaction_id: transaction.id },
    });
    const policy = await this.policyRepository.findOne({
      where: { id: transaction.source_policy_id },
    });

    if (!cancellation || !policy) {
      throw new BadRequestException(
        'Cancellation or source policy could not be resolved.',
      );
    }

    const payload = await this.payloadService.buildCancellationPayload(
      transaction,
      cancellation,
      policy,
    );

    return this.submit(user, transaction, policy, payload);
  }

  private async submit(
    user: AuthenticatedUser,
    transaction: PolicyTransaction,
    policy: Policy,
    payload: Record<string, unknown>,
  ) {
    if (!this.lifecycleService.canSubmit(transaction)) {
      throw new BadRequestException(
        'Transaction is not ready for TIRAMIS submission.',
      );
    }

    const requestType = await this.resolveRequestType(policy);
    const serviceContext = await this.buildServiceContext(
      user.companyId!,
      policy,
      payload,
    );
    const policyTransactionContext = this.buildPolicyTransactionContext(
      transaction,
      policy,
    );

    await this.lifecycleService.startSubmission(
      user.companyId!,
      transaction.id,
      {
        changedBy: user.id,
        isResubmission: Boolean(transaction.tiramis_request_id),
      },
    );

    let result: Record<string, any>;

    try {
      result = await this.tiramisBusinessSubmitService.submitAnyBusinessRecord({
        requestType,
        sourceModule: 'policy-transactions',
        sourceRecordId: transaction.id,
        policyId: policy.id,
        businessReference: transaction.transaction_no,
        payload,
        productContext: serviceContext.product,
        pricingContext: serviceContext.pricing,
        insuredDataContext: serviceContext.insuredData,
        quotationGateContext: serviceContext.quotationGate,
        financeContext: serviceContext.finance,
        policyTransactionContext,
        forceResubmit: Boolean(transaction.tiramis_request_id),
        authContext: {
          ...user,
          userId: user.id,
          companyId: user.companyId!,
          branchId:
            policy.branch_id ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).branchId ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).activeBranchId ??
            null,
          activeBranchId:
            policy.branch_id ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).branchId ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).activeBranchId ??
            null,
        },
      });
    } catch (error) {
      await this.lifecycleService.markSubmissionFailed(
        user.companyId!,
        transaction.id,
        {
          changedBy: user.id,
          reason:
            error instanceof Error
              ? error.message
              : 'TIRAMIS submission failed',
        },
      );
      throw error;
    }

    const tracking = result.tracking as
      | {
          id?: string | null;
          tiramisTransactionId?: string | null;
          tiramisRequestId?: string | null;
        }
      | undefined;
    const tiramis =
      (result.tiramis as Record<string, any> | undefined) ?? result;
    const tiramisTransactionId =
      tracking?.tiramisTransactionId ??
      tiramis?.transaction?.id ??
      tiramis?.coverNote?.transactionId ??
      tiramis?.attempt?.transactionId ??
      tiramis?.tiramisTransactionId ??
      null;
    const tiramisRequestId =
      tracking?.tiramisRequestId ??
      tiramis?.coverNote?.requestId ??
      tiramis?.attempt?.requestId ??
      tiramis?.request?.requestId ??
      tiramis?.requestId ??
      null;

    // startSubmission advances the lifecycle row. Saving the stale entity
    // loaded before that call would overwrite QUEUED with the previous status.
    await this.transactionRepository.update(
      { id: transaction.id, company_id: user.companyId! },
      {
        tiramis_tracking_id: result.localTrackingId ?? tracking?.id ?? null,
        tiramis_transaction_id: tiramisTransactionId,
        tiramis_request_id: tiramisRequestId,
      },
    );

    return result;
  }

  /**
   * apps/tiramis's submission guards require a signed X-Service-Context
   * (product/pricing/insuredData/quotationGate/finance) on every request —
   * see PolicyTransactionTiramisServiceContextService for why this is
   * derived from the policy's originating quotation rather than the
   * transaction itself.
   */
  private async buildServiceContext(
    companyId: string,
    policy: Policy,
    payload: Record<string, unknown>,
  ): Promise<PolicyTransactionTiramisServiceContext> {
    if (!policy.quotation_id) {
      throw new BadRequestException(
        'The source policy has no originating quotation on record, so a signed TIRAMIS submission context cannot be built.',
      );
    }

    const quotation = await this.quotationRepository.findOne({
      where: { id: policy.quotation_id, company_id: companyId },
      relations: {
        customer: true,
        cover_note: {
          entries: { risks: true, motor_detail: true, subject_matters: true },
        },
      },
    });

    if (!quotation) {
      throw new BadRequestException(
        'The originating quotation for this policy could not be resolved.',
      );
    }

    const context = await this.serviceContextService.build(
      companyId,
      quotation,
      payload,
    );

    return context;
  }

  private async resolveRequestType(
    policy: Policy,
  ): Promise<
    | TiramisRequestType.NON_MOTOR
    | TiramisRequestType.MOTOR
    | TiramisRequestType.MOTOR_FLEET
  > {
    if (policy.quotation_id) {
      const quotation = await this.quotationRepository.findOne({
        where: { id: policy.quotation_id },
        select: { id: true, quotation_flow: true },
      });

      if (quotation) {
        return FLOW_TO_REQUEST_TYPE[quotation.quotation_flow];
      }
    }

    return TiramisRequestType.MOTOR;
  }

  private buildPolicyTransactionContext(
    transaction: PolicyTransaction,
    policy: Policy,
  ): ServicePolicyTransactionContext {
    return {
      transactionId: transaction.id,
      transactionNumber: transaction.transaction_no,
      transactionType: transaction.transaction_type,
      stage: transaction.stage,
      sourcePolicyId: transaction.source_policy_id,
      sourcePolicyNumber: policy.policy_no,
      sourcePolicyVersion: transaction.source_policy_version_no,
      effectiveDate: transaction.effective_date,
      sourceSnapshotHash: transaction.source_policy_snapshot_hash,
      proposedSnapshotHash: transaction.proposed_policy_snapshot_hash ?? null,
      pricingSnapshotHash: transaction.pricing_snapshot_hash ?? null,
      premiumEffect: transaction.premium_effect,
      additionalPremium: transaction.additional_premium,
      returnPremium: transaction.return_premium,
      approvalStatus: transaction.approval_status,
      paymentStatus: transaction.payment_status,
      submissionStatus: transaction.submission_status,
    };
  }

  private async requireTransaction(
    user: AuthenticatedUser,
    transactionId: string,
    type: PolicyTransactionType,
  ) {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .where('transaction.id = :transactionId', { transactionId })
      .andWhere('transaction.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere('transaction.transaction_type = :type', { type });

    this.dataAccessScopeService.applyPolicyReadScope(
      query,
      'policy',
      this.dataAccessScopeService.resolve(user),
    );

    const transaction = await query.getOne();

    if (!transaction) {
      throw new BadRequestException('Policy transaction not found.');
    }

    return transaction;
  }
}
