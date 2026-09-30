import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ClaimRegulatoryOperationType } from '@insurance-max/contracts';
import { DataSource, EntityManager, In, Not } from 'typeorm';

import { BusinessReferenceService } from '../../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../../billing-commission/utils/money.util';
import { DocumentGenerationService } from '../../insurance-documents/document-generation.service';
import { ClaimsService } from '../claims.service';
import {
  AdjustDischargeVoucherDto,
  CreateDischargeVoucherDto,
  UpdateDischargeVoucherDto,
  RespondToDischargeDto,
  TiramisSubmitOptionsDto,
} from '../dto/claim-workflow.dto';
import { ClaimAssessment } from '../entities/claim-assessment.entity';
import { ClaimClaimant } from '../entities/claim-claimant.entity';
import { ClaimDischargeVoucher } from '../entities/claim-discharge-voucher.entity';
import { ClaimDocument } from '../entities/claim-document.entity';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimRegulatoryOperation } from '../entities/claim-regulatory-operation.entity';
import {
  ClaimApprovalStatus,
  ClaimApprovalType,
  ClaimAssessmentStatus,
  ClaimDischargeStatus,
  ClaimRegulatoryStatus,
  ClaimSettlementStatus,
  ClaimStatus,
  DischargeResponse,
} from '../enums/claim.enums';
import { ClaimAccessService } from './claim-access.service';
import { ClaimApprovalService } from './claim-approval.service';
import { ClaimStateMachineService } from './claim-state-machine.service';
import { ClaimTiramisPayloadService } from './claim-tiramis-payload.service';
import { ClaimTiramisService } from './claim-tiramis.service';

const VOUCHER_SUBJECT = 'DISCHARGE_VOUCHER';
export const DISCHARGE_VOUCHER_TEMPLATE = 'CLAIM_DISCHARGE_VOUCHER';

/**
 * Discharge voucher (TIRAMIS §12). The voucher derives claim, assessment,
 * cover note and amount from the approved assessment; the user only sets
 * the offer. Superseded vouchers are kept as earlier versions.
 */
@Injectable()
export class ClaimDischargeService {
  private readonly logger = new Logger(ClaimDischargeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly access: ClaimAccessService,
    private readonly claims: ClaimsService,
    private readonly referenceService: BusinessReferenceService,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly approvals: ClaimApprovalService,
    private readonly tiramisPayload: ClaimTiramisPayloadService,
    private readonly claimTiramis: ClaimTiramisService,
    private readonly documentGeneration: DocumentGenerationService,
  ) {}

  async create(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateDischargeVoucherDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if (
        ![ClaimStatus.APPROVED, ClaimStatus.DISCHARGE_REJECTED].includes(
          claim.status,
        )
      ) {
        throw new ConflictException(
          'A discharge voucher needs an approved claim or a rejected previous offer',
        );
      }

      const assessment = await manager.getRepository(ClaimAssessment).findOne({
        where: { claim_id: claim.id, status: ClaimAssessmentStatus.APPROVED },
        order: { approved_at: 'DESC' },
      });

      if (!assessment) {
        throw new ConflictException('The claim has no approved assessment');
      }

      const outstanding = MoneyUtil.subtract(
        claim.approved_amount,
        claim.paid_amount,
      );

      if (MoneyUtil.compare(dto.claim_offer_amount, '0.00') <= 0) {
        throw new BadRequestException(
          'The offer amount must be greater than zero',
        );
      }

      if (MoneyUtil.compare(dto.claim_offer_amount, outstanding) > 0) {
        throw new BadRequestException(
          `The offer exceeds the outstanding approved amount (${outstanding} ${claim.currency_code})`,
        );
      }

      const claimants = await this.claimantsFor(
        manager,
        claim.id,
        dto.claimant_id,
      );
      const previous = await manager
        .getRepository(ClaimDischargeVoucher)
        .findOne({
          where: {
            claim_id: claim.id,
            status: Not(In([ClaimDischargeStatus.CANCELLED])),
          },
          order: { version: 'DESC' },
        });

      if (previous && previous.status !== ClaimDischargeStatus.REJECTED) {
        throw new ConflictException(
          `Voucher ${previous.discharge_voucher_number} is still ${previous.status.toLowerCase()}`,
        );
      }

      const voucher = await manager.getRepository(ClaimDischargeVoucher).save(
        manager.getRepository(ClaimDischargeVoucher).create({
          company_id: claim.company_id,
          branch_id: claim.branch_id,
          claim_id: claim.id,
          claimant_id: dto.claimant_id ?? null,
          assessment_id: assessment.id,
          discharge_voucher_number: await this.referenceService.next({
            companyId: claim.company_id,
            documentType: 'CLAIM_DISCHARGE_VOUCHER',
            prefix: `DV-${new Date().getFullYear()}-`,
            manager,
          }),
          claim_assessment_number: assessment.claim_assessment_number,
          claim_reference_number: claim.claim_reference_number,
          cover_note_reference_number: claim.cover_note_reference_number,
          discharge_voucher_date: new Date(),
          currency_code: claim.currency_code,
          exchange_rate: claim.exchange_rate,
          claim_offer_communication_date: dto.claim_offer_communication_date
            ? new Date(dto.claim_offer_communication_date)
            : new Date(),
          claim_offer_amount: dto.claim_offer_amount,
          claimant_response_date: null,
          offer_accepted: 'N',
          claimants: claimants.map((claimant) =>
            this.tiramisPayload.identityClaimant(claimant),
          ) as unknown as Record<string, unknown>[],
          version: (previous?.version ?? 0) + 1,
          supersedes_voucher_id: previous?.id ?? null,
          status: ClaimDischargeStatus.DRAFT,
          created_by: user.id,
          tiramis_status: 'NOT_SUBMITTED',
        }),
      );

      await manager.getRepository(InsuranceClaim).update(
        { id: claim.id },
        {
          current_discharge_voucher_id: voucher.id,
          settlement_status: ClaimSettlementStatus.DISCHARGE_PENDING,
        },
      );
      await this.stateMachine.transition(
        manager,
        claim,
        ClaimStatus.DISCHARGE_PENDING,
        {
          eventType: 'DISCHARGE_CREATED',
          summary: `Discharge voucher ${voucher.discharge_voucher_number} (v${voucher.version}) prepared for ${voucher.claim_offer_amount} ${voucher.currency_code}`,
          actorId: user.id,
          subjectType: VOUCHER_SUBJECT,
          subjectId: voucher.id,
        },
      );

      return voucher;
    });
  }

  /**
   * Edits a draft voucher: a new one, or one returned for rework by an
   * approver. Issued vouchers change only through adjustment or a new version.
   */
  async update(
    user: AuthenticatedUser,
    voucherId: string,
    dto: UpdateDischargeVoucherDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, voucherId);

      if (record.status !== ClaimDischargeStatus.DRAFT) {
        throw new ConflictException(
          'Only a draft discharge voucher can be edited',
        );
      }

      if (dto.claim_offer_amount !== undefined) {
        const outstanding = MoneyUtil.subtract(
          claim.approved_amount,
          claim.paid_amount,
        );

        if (MoneyUtil.compare(dto.claim_offer_amount, '0.00') <= 0) {
          throw new BadRequestException(
            'The offer amount must be greater than zero',
          );
        }

        if (MoneyUtil.compare(dto.claim_offer_amount, outstanding) > 0) {
          throw new BadRequestException(
            `The offer exceeds the outstanding approved amount (${outstanding} ${claim.currency_code})`,
          );
        }

        record.claim_offer_amount = dto.claim_offer_amount;
      }

      if (dto.claim_offer_communication_date) {
        record.claim_offer_communication_date = new Date(
          dto.claim_offer_communication_date,
        );
      }

      if (dto.claimant_id !== undefined) {
        const claimants = await this.claimantsFor(
          manager,
          claim.id,
          dto.claimant_id || undefined,
        );
        record.claimant_id = dto.claimant_id || null;
        record.claimants = claimants.map((claimant) =>
          this.tiramisPayload.identityClaimant(claimant),
        ) as unknown as Record<string, unknown>[];
      }

      const saved = await manager
        .getRepository(ClaimDischargeVoucher)
        .save(record);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'DISCHARGE_UPDATED',
        summary: `Discharge voucher ${record.discharge_voucher_number} updated (offer ${record.claim_offer_amount} ${record.currency_code})`,
        actorId: user.id,
        subjectType: VOUCHER_SUBJECT,
        subjectId: record.id,
      });

      return saved;
    });
  }

  async submit(user: AuthenticatedUser, voucherId: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, voucherId);

      if (record.status !== ClaimDischargeStatus.DRAFT) {
        throw new ConflictException(
          'Only a draft discharge voucher can be submitted',
        );
      }

      await this.claims.assertMandatoryDocuments(claim, 'DISCHARGE', manager);

      record.status = ClaimDischargeStatus.SUBMITTED;
      record.submitted_by = user.id;
      record.submitted_at = new Date();
      await manager.getRepository(ClaimDischargeVoucher).save(record);
      await this.approvals.submit(
        manager,
        this.subject(claim, record),
        user.id,
      );

      return record;
    });
  }

  async approve(user: AuthenticatedUser, voucherId: string, comments?: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, voucherId);

      if (record.status !== ClaimDischargeStatus.SUBMITTED) {
        throw new ConflictException(
          'Only a submitted discharge voucher can be approved',
        );
      }

      const outcome = await this.approvals.approve(
        manager,
        user,
        this.subject(claim, record),
        comments,
      );

      if (!outcome.completed) {
        return { voucher: record, completed: false };
      }

      record.status = ClaimDischargeStatus.SENT_TO_CLAIMANT;
      record.approved_by = user.id;
      record.approved_at = new Date();
      await manager.getRepository(ClaimDischargeVoucher).save(record);

      await this.stateMachine.transition(
        manager,
        claim,
        ClaimStatus.DISCHARGE_ISSUED,
        {
          eventType: 'DISCHARGE_ISSUED',
          summary: `Discharge voucher ${record.discharge_voucher_number} issued to the claimant`,
          actorId: user.id,
          subjectType: VOUCHER_SUBJECT,
          subjectId: record.id,
        },
      );

      return { voucher: record, completed: true };
    });
  }

  async decline(
    user: AuthenticatedUser,
    voucherId: string,
    comments: string,
    decision: 'REJECT' | 'RETURN' = 'REJECT',
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, voucherId);

      if (record.status !== ClaimDischargeStatus.SUBMITTED) {
        throw new ConflictException(
          'Only a submitted discharge voucher can be declined',
        );
      }

      await this.approvals.decline(
        manager,
        user,
        this.subject(claim, record),
        decision === 'RETURN'
          ? ClaimApprovalStatus.RETURNED
          : ClaimApprovalStatus.REJECTED,
        comments,
      );

      if (decision === 'RETURN') {
        record.status = ClaimDischargeStatus.DRAFT;
        await manager.getRepository(ClaimDischargeVoucher).save(record);

        return record;
      }

      record.status = ClaimDischargeStatus.CANCELLED;
      record.rejected_by = user.id;
      record.rejected_at = new Date();
      record.rejection_reason = comments.trim();
      await manager.getRepository(ClaimDischargeVoucher).save(record);

      await this.stateMachine.transition(manager, claim, ClaimStatus.APPROVED, {
        eventType: 'DISCHARGE_CANCELLED',
        summary: `Discharge voucher ${record.discharge_voucher_number} not approved: ${comments.trim()}`,
        actorId: user.id,
        subjectType: VOUCHER_SUBJECT,
        subjectId: record.id,
      });

      return record;
    });
  }

  async respond(
    user: AuthenticatedUser,
    voucherId: string,
    dto: RespondToDischargeDto,
  ) {
    const voucher = await this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, voucherId);

      if (record.status !== ClaimDischargeStatus.SENT_TO_CLAIMANT) {
        throw new ConflictException(
          'The discharge voucher is not awaiting a claimant response',
        );
      }

      if (dto.signed_document_id) {
        const linked = await manager.getRepository(ClaimDocument).count({
          where: { claim_id: claim.id, document_id: dto.signed_document_id },
        });

        if (!linked) {
          throw new BadRequestException(
            'The signed voucher must be a document of this claim',
          );
        }
      }

      const accepted = dto.response === DischargeResponse.ACCEPT;
      const responseDate = dto.claimant_response_date
        ? new Date(dto.claimant_response_date)
        : new Date();

      if (responseDate < record.claim_offer_communication_date) {
        throw new BadRequestException(
          'The claimant response date cannot be before the offer was communicated',
        );
      }

      record.claimant_response_date = responseDate;
      record.signed_document_id =
        dto.signed_document_id ?? record.signed_document_id;
      record.offer_accepted = accepted ? 'Y' : 'N';
      record.status = accepted
        ? ClaimDischargeStatus.ACCEPTED
        : ClaimDischargeStatus.REJECTED;
      await manager.getRepository(ClaimDischargeVoucher).save(record);

      await manager.getRepository(InsuranceClaim).update(
        { id: claim.id },
        {
          settlement_status: accepted
            ? ClaimSettlementStatus.DISCHARGE_ACCEPTED
            : ClaimSettlementStatus.DISCHARGE_PENDING,
        },
      );
      await this.stateMachine.transition(
        manager,
        claim,
        accepted
          ? ClaimStatus.DISCHARGE_ACCEPTED
          : ClaimStatus.DISCHARGE_REJECTED,
        {
          eventType: accepted ? 'DISCHARGE_ACCEPTED' : 'DISCHARGE_REJECTED',
          summary: `Claimant ${accepted ? 'accepted' : 'rejected'} voucher ${record.discharge_voucher_number}${
            dto.reason ? `: ${dto.reason.trim()}` : ''
          }`,
          actorId: user.id,
          subjectType: VOUCHER_SUBJECT,
          subjectId: record.id,
        },
      );

      return record;
    });

    // TIRA receives the claimant's answer either way (OfferAccepted Y/N).
    await this.trySubmit(user, voucher);

    return voucher;
  }

  /**
   * Records an adjustment or reconciliation of the offer. Allowed until the
   * voucher has been accepted by TIRA; the reconciled amount becomes the
   * payable amount of an accepted voucher.
   */
  async adjust(
    user: AuthenticatedUser,
    voucherId: string,
    dto: AdjustDischargeVoucherDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.lock(manager, user, voucherId);

      if (
        ![
          ClaimDischargeStatus.ACCEPTED,
          ClaimDischargeStatus.REJECTED,
          ClaimDischargeStatus.SENT_TO_CLAIMANT,
        ].includes(record.status)
      ) {
        throw new ConflictException(
          'Only an issued discharge voucher can be adjusted',
        );
      }

      const reported = await manager
        .getRepository(ClaimRegulatoryOperation)
        .count({
          where: {
            source_record_id: record.id,
            operation_type: ClaimRegulatoryOperationType.DISCHARGE_VOUCHER,
            status: ClaimRegulatoryStatus.ACCEPTED,
          },
        });

      if (reported) {
        throw new ConflictException(
          'TIRA has already accepted this voucher; issue a new version instead',
        );
      }

      if (
        dto.adjustment_amount &&
        !dto.adjustment_reason?.trim() &&
        !record.adjustment_reason
      ) {
        throw new BadRequestException('An adjustment needs a reason');
      }

      if (dto.reconciled_amount) {
        const outstanding = MoneyUtil.subtract(
          claim.approved_amount,
          claim.paid_amount,
        );

        if (MoneyUtil.compare(dto.reconciled_amount, outstanding) > 0) {
          throw new BadRequestException(
            `The reconciled amount exceeds the outstanding approved amount (${outstanding})`,
          );
        }
      }

      const before = {
        adjustment_amount: record.adjustment_amount,
        reconciled_amount: record.reconciled_amount,
      };

      if (
        dto.adjustment_date ||
        dto.adjustment_amount ||
        dto.adjustment_reason
      ) {
        record.adjustment_date = dto.adjustment_date
          ? new Date(dto.adjustment_date)
          : new Date();
      }
      if (dto.adjustment_reason !== undefined)
        record.adjustment_reason = dto.adjustment_reason.trim();
      if (dto.adjustment_amount !== undefined)
        record.adjustment_amount = dto.adjustment_amount;
      if (
        dto.reconciliation_date ||
        dto.reconciled_amount ||
        dto.reconciliation_summary
      ) {
        record.reconciliation_date = dto.reconciliation_date
          ? new Date(dto.reconciliation_date)
          : new Date();
      }
      if (dto.reconciliation_summary !== undefined) {
        record.reconciliation_summary = dto.reconciliation_summary.trim();
      }
      if (dto.reconciled_amount !== undefined)
        record.reconciled_amount = dto.reconciled_amount;

      const saved = await manager
        .getRepository(ClaimDischargeVoucher)
        .save(record);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'DISCHARGE_ADJUSTED',
        summary: `Voucher ${record.discharge_voucher_number} adjusted`,
        actorId: user.id,
        subjectType: VOUCHER_SUBJECT,
        subjectId: record.id,
        metadata: {
          before,
          after: {
            adjustment_amount: record.adjustment_amount,
            reconciled_amount: record.reconciled_amount,
          },
        },
      });

      return saved;
    });
  }

  async submitToTiramis(
    user: AuthenticatedUser,
    voucherId: string,
    options: TiramisSubmitOptionsDto = {},
  ) {
    const { record, claim } = await this.dataSource.transaction(
      async (manager) => {
        const locked = await this.lock(manager, user, voucherId);

        if (
          ![
            ClaimDischargeStatus.ACCEPTED,
            ClaimDischargeStatus.REJECTED,
          ].includes(locked.record.status)
        ) {
          throw new ConflictException(
            'A discharge voucher is reported to TIRA after the claimant has responded',
          );
        }

        if (!locked.claim.claim_reference_number) {
          throw new ConflictException(
            'The claim has no TIRA claim reference number',
          );
        }

        const assessmentAccepted = await manager
          .getRepository(ClaimRegulatoryOperation)
          .count({
            where: {
              claim_id: locked.claim.id,
              operation_type: ClaimRegulatoryOperationType.ASSESSMENT,
              source_record_id: locked.record.assessment_id ?? '',
              status: ClaimRegulatoryStatus.ACCEPTED,
            },
          });

        if (!assessmentAccepted) {
          throw new ConflictException(
            'TIRA must accept the claim assessment before the discharge voucher is reported',
          );
        }

        return locked;
      },
    );

    return this.claimTiramis.submit({
      user,
      claim,
      operationType: ClaimRegulatoryOperationType.DISCHARGE_VOUCHER,
      sourceRecordId: record.id,
      sourceRecordNumber: record.discharge_voucher_number,
      payload: this.tiramisPayload.dischargeVoucher(claim, record),
      retry: options.retry,
    });
  }

  /** Renders the voucher with the company template CLAIM_DISCHARGE_VOUCHER. */
  async generateDocument(user: AuthenticatedUser, voucherId: string) {
    const { record, claim } = await this.dataSource.transaction((manager) =>
      this.lock(manager, user, voucherId),
    );
    const full = await this.claims.findOne(user, claim.id);
    const claimant =
      (full.claimants ?? []).find((item) => item.is_primary) ??
      full.claimants?.[0];

    let document;
    try {
      document = await this.documentGeneration.request(user, {
        templateCode: DISCHARGE_VOUCHER_TEMPLATE,
        documentType: 'CLAIM_DISCHARGE_VOUCHER',
        title: `Discharge voucher ${record.discharge_voucher_number}`,
        sourceSnapshot: {
          voucher: {
            number: record.discharge_voucher_number,
            version: record.version,
            date: record.discharge_voucher_date,
            offer_amount: record.claim_offer_amount,
            reconciled_amount: record.reconciled_amount,
            currency: record.currency_code,
          },
          claim: {
            claim_no: claim.claim_no,
            claim_reference_number: claim.claim_reference_number,
            cover_note_reference_number: claim.cover_note_reference_number,
            loss_date: claim.loss_date,
            loss_nature: claim.loss_nature,
          },
          policy: { policy_no: full.policy?.policy_no ?? null },
          claimant: { name: claimant?.full_name ?? null },
        },
        resourceType: 'CLAIM_DISCHARGE',
        resourceId: record.id,
        customerVisible: true,
        intermediaryVisible: true,
        publicVerificationEnabled: true,
        idempotencyKey: `claim-discharge:${record.id}:v${record.version}`,
      });
    } catch (error: any) {
      if (error?.status === 404 || /template/i.test(String(error?.message))) {
        throw new UnprocessableEntityException({
          code: 'CLAIM_TEMPLATE_NOT_CONFIGURED',
          message: `Publish a ${DISCHARGE_VOUCHER_TEMPLATE} document template to generate vouchers`,
        });
      }
      throw error;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(ClaimDischargeVoucher)
        .update({ id: record.id }, { generated_document_id: document.id });
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'DISCHARGE_DOCUMENT_GENERATED',
        summary: `Voucher document generated for ${record.discharge_voucher_number}`,
        actorId: user.id,
        subjectType: VOUCHER_SUBJECT,
        subjectId: record.id,
        sourceEventId: `discharge-document:${record.id}:${document.id}`,
      });
    });

    return document;
  }

  /** Amount a payment against this claim may draw from the accepted voucher. */
  async payableAmount(manager: EntityManager, claim: InsuranceClaim) {
    const voucher = await manager.getRepository(ClaimDischargeVoucher).findOne({
      where: { claim_id: claim.id, status: ClaimDischargeStatus.ACCEPTED },
      order: { version: 'DESC' },
    });

    return voucher
      ? (voucher.reconciled_amount ?? voucher.claim_offer_amount)
      : null;
  }

  private async trySubmit(
    user: AuthenticatedUser,
    voucher: ClaimDischargeVoucher,
  ) {
    try {
      await this.submitToTiramis(user, voucher.id);
    } catch (error: any) {
      this.logger.warn(
        `Voucher ${voucher.discharge_voucher_number} not yet sent to TIRAMIS: ${error?.message}`,
      );
    }
  }

  private async claimantsFor(
    manager: EntityManager,
    claimId: string,
    claimantId?: string,
  ) {
    const claimants = await this.claims.activeClaimants(manager, claimId);
    const selected = claimantId
      ? claimants.filter((claimant) => claimant.id === claimantId)
      : claimants;

    if (claimantId && selected.length === 0) {
      throw new BadRequestException(
        'The selected claimant does not belong to this claim',
      );
    }

    this.assertIdentity(selected);

    return selected;
  }

  private assertIdentity(claimants: ClaimClaimant[]) {
    const incomplete = claimants.filter(
      (claimant) =>
        !claimant.claimant_category ||
        !claimant.party_type ||
        !claimant.id_type ||
        !claimant.identification_number,
    );

    if (incomplete.length || !claimants.length) {
      throw new UnprocessableEntityException({
        code: 'CLAIMANT_DETAILS_INCOMPLETE',
        message:
          'Claimant category, type and identification are required by TIRAMIS',
        details: incomplete.map((claimant) => claimant.full_name),
      });
    }
  }

  private lock(
    manager: EntityManager,
    user: AuthenticatedUser,
    voucherId: string,
  ) {
    return this.access.getRecordForWrite(
      manager,
      user,
      ClaimDischargeVoucher,
      voucherId,
      'Discharge voucher',
    );
  }

  private subject(claim: InsuranceClaim, voucher: ClaimDischargeVoucher) {
    return {
      claim,
      subjectType: VOUCHER_SUBJECT,
      subjectId: voucher.id,
      approvalType: ClaimApprovalType.DISCHARGE,
      amount: voucher.claim_offer_amount,
      currencyCode: voucher.currency_code,
    };
  }
}
