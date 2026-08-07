import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PolicyTransactionType } from '@insurance-max/contracts';

import { Policy } from '../../policies/entities/policy.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { TiramisIntegrationService } from '../../tiramis-integration/tiramis-integration.service';
import { PolicyCancellation } from '../entities/policy-cancellation.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionLifecycleService } from './policy-transaction-lifecycle.service';
import { PolicyTransactionTiramisPayloadService } from './policy-transaction-tiramis-payload.service';

const FLOW_TO_REQUEST_TYPE: Record<QuotationFlow, 'NON_MOTOR' | 'MOTOR' | 'MOTOR_FLEET'> = {
  [QuotationFlow.NON_MOTOR]: 'NON_MOTOR',
  [QuotationFlow.MOTOR_SINGLE]: 'MOTOR',
  [QuotationFlow.MOTOR_FLEET]: 'MOTOR_FLEET',
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
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    @Inject(forwardRef(() => TiramisIntegrationService))
    private readonly tiramisIntegrationService: TiramisIntegrationService,
  ) {}

  async submitEndorsement(user: AuthenticatedUser, transactionId: string) {
    const transaction = await this.requireTransaction(
      user.companyId!,
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
      user.companyId!,
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

    await this.lifecycleService.startSubmission(user.companyId!, transaction.id, {
      changedBy: user.id,
    });

    const { submission } = await this.tiramisIntegrationService.submitToTiramis({
      companyId: user.companyId!,
      userId: user.id,
      dto: {
        requestType,
        policy_id: policy.id,
        branch_id: policy.branch_id ?? undefined,
        source_module: 'policy-transactions',
        source_record_id: transaction.id,
        business_reference: transaction.transaction_no,
        payload,
      },
    });

    transaction.tiramis_tracking_id = null;
    transaction.tiramis_transaction_id = submission.tiramis_transaction_id;
    transaction.tiramis_request_id = submission.tiramis_request_id;
    await this.transactionRepository.save(transaction);

    return submission;
  }

  private async resolveRequestType(
    policy: Policy,
  ): Promise<'NON_MOTOR' | 'MOTOR' | 'MOTOR_FLEET'> {
    if (policy.quotation_id) {
      const quotation = await this.quotationRepository.findOne({
        where: { id: policy.quotation_id },
        select: { id: true, quotation_flow: true },
      });

      if (quotation) {
        return FLOW_TO_REQUEST_TYPE[quotation.quotation_flow];
      }
    }

    return 'MOTOR';
  }

  private async requireTransaction(
    companyId: string,
    transactionId: string,
    type: PolicyTransactionType,
  ) {
    const transaction = await this.transactionRepository.findOne({
      where: {
        id: transactionId,
        company_id: companyId,
        transaction_type: type,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Policy transaction not found.');
    }

    return transaction;
  }
}
