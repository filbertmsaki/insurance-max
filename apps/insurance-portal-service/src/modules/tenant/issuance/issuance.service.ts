import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type {
  RegulatoryCoverNoteReference,
  RegulatoryFinalResponse,
} from '@insurance-max/contracts';
import { DataSource, EntityManager } from 'typeorm';

import { TiramisNotificationEventDto } from '../tiramis-integration/dto/tiramis-notification-event.dto';
import { PortalTiraSubmission } from '../tiramis-integration/entities/portal-tira-submission.entity';
import { CoverNote } from '../cover-notes/entities/cover-note.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationCalculationBase } from '../quotations/enums/quotation-calculation-base.enum';
import { QuotationPremiumItemType } from '../quotations/enums/quotation-premium-item-type.enum';
import { QuotationEntryRisk } from '../quotations/entities/structured/quotation-entry-risk.entity';
import { QuotationCoverNote } from '../quotations/entities/structured/quotation-cover-note.entity';
import { QuotationCoverNoteEntry } from '../quotations/entities/structured/quotation-cover-note-entry.entity';
import { QuotationMotorDetail } from '../quotations/entities/structured/quotation-motor-detail.entity';
import { QuotationPolicyHolder } from '../quotations/entities/structured/quotation-policy-holder.entity';
import { QuotationRiskDiscount } from '../quotations/entities/structured/quotation-risk-discount.entity';
import { QuotationRiskTax } from '../quotations/entities/structured/quotation-risk-tax.entity';
import { QuotationSubjectMatter } from '../quotations/entities/structured/quotation-subject-matter.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyCoverNote } from '../policies/entities/policy-cover-note.entity';
import { PolicyPremiumBreakdown } from '../policies/entities/policy-premium-breakdown.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { PolicyStatusHistory } from '../policies/entities/policy-status-history.entity';
import { PolicyVersion } from '../policies/entities/policy-version.entity';
import { ProductChannelType } from '../product-distribution/enums/product-channel-type.enum';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';

type IssuableQuotation = Quotation & {
  customer: Customer | null;
  cover_note: QuotationCoverNote & {
    entries: Array<
      QuotationCoverNoteEntry & {
        motor_detail: QuotationMotorDetail | null;
        subject_matters: QuotationSubjectMatter[];
        risks: Array<
          QuotationEntryRisk & {
            discounts: QuotationRiskDiscount[];
            taxes: QuotationRiskTax[];
          }
        >;
      }
    >;
  };
  policy_holders: QuotationPolicyHolder[];
};

@Injectable()
export class IssuanceService {
  private readonly logger = new Logger(IssuanceService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async applyNotification(
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
  ): Promise<{
    coverNotes?: CoverNote[];
    policy?: Policy | null;
  } | null> {
    const regulatoryResponse = payload.regulatoryResponse;

    if (!regulatoryResponse?.success) {
      return null;
    }

    const requestType = String(
      regulatoryResponse.requestType ||
        submission.request_type ||
        payload.serviceType ||
        '',
    )
      .trim()
      .toUpperCase();

    if (
      [
        'NON_MOTOR',
        'MOTOR',
        'MOTOR_FLEET',
        'NON_MOTOR_COVER_NOTE',
        'MOTOR_COVER_NOTE',
        'MOTOR_FLEET_COVER_NOTE',
      ].includes(requestType)
    ) {
      return this.applyCoverNoteIssuance(
        submission,
        payload,
        regulatoryResponse,
      );
    }

    if (requestType === 'POLICY') {
      return this.applyPolicyActivation(
        submission,
        payload,
        regulatoryResponse,
      );
    }

    return null;
  }

  private async applyCoverNoteIssuance(
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
    regulatoryResponse: RegulatoryFinalResponse,
  ) {
    if (!submission.quotation_id) {
      this.logger.warn(
        `Skipping cover-note issuance for requestId ${payload.requestId}: quotation_id missing on Portal submission`,
      );
      return null;
    }

    return this.dataSource.transaction(async (manager) => {
      const quotation = await this.loadIssuableQuotation(
        manager,
        submission.company_id,
        submission.quotation_id!,
      );
      const tracking = await this.resolveTrackingOrThrow(manager, submission);
      const coverNotes = await this.createOrUpdateCoverNotes(
        manager,
        submission,
        tracking,
        quotation,
        regulatoryResponse,
      );
      const policy = await this.createOrReuseIssuedPolicy(
        manager,
        submission,
        quotation,
        regulatoryResponse,
        coverNotes,
      );

      if (policy) {
        submission.policy_id = policy.id;
        await manager.getRepository(PortalTiraSubmission).save(submission);
      }

      return {
        coverNotes,
        policy,
      };
    });
  }

  private async applyPolicyActivation(
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
    regulatoryResponse: RegulatoryFinalResponse,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const policy = await this.findLinkedPolicyForActivation(
        manager,
        submission,
      );

      if (!policy) {
        this.logger.warn(
          `Skipping policy activation for requestId ${payload.requestId}: linked policy not found`,
        );
        return null;
      }

      policy.policy_status = 'ACTIVE';
      policy.policy_reference_number =
        regulatoryResponse.policy?.policyReferenceNumber ??
        policy.policy_reference_number;
      policy.regulatory_sync_status = 'IN_SYNC';
      policy.regulatory_response_payload =
        regulatoryResponse as unknown as Record<string, unknown>;
      policy.regulatory_response_hash = regulatoryResponse.responsePayloadHash;
      policy.activated_at = policy.activated_at ?? new Date();
      policy.state_version = Number(policy.state_version || 1) + 1;

      const saved = await manager.getRepository(Policy).save(policy);

      const existingHistory = await manager
        .getRepository(PolicyStatusHistory)
        .findOne({
          where: {
            policy_id: saved.id,
            old_status: 'COVER_NOTE_ISSUED',
            new_status: 'ACTIVE',
          },
        });

      if (!existingHistory) {
        await manager.getRepository(PolicyStatusHistory).save({
          policy_id: saved.id,
          old_status: 'COVER_NOTE_ISSUED',
          new_status: 'ACTIVE',
          reason: regulatoryResponse.statusDescription,
          changed_by: null,
        });
      }

      return { policy: saved };
    });
  }

  private async createOrUpdateCoverNotes(
    manager: EntityManager,
    submission: PortalTiraSubmission,
    tracking: TiramisSubmissionTrackingEntity,
    quotation: IssuableQuotation,
    regulatoryResponse: RegulatoryFinalResponse,
  ): Promise<CoverNote[]> {
    const entries = [...(quotation.cover_note?.entries ?? [])].sort(
      (left, right) => left.entry_number - right.entry_number,
    );

    if (!entries.length) {
      throw new BadRequestException(
        'Quotation does not contain cover-note entries to issue.',
      );
    }

    const repository = manager.getRepository(CoverNote);
    const existing = await repository.find({
      where: {
        quotation_id: quotation.id,
      },
      order: {
        created_at: 'ASC',
      },
    });

    const references = regulatoryResponse.coverNotes ?? [];
    const saved: CoverNote[] = [];

    for (const [index, entry] of entries.entries()) {
      const reference = this.matchRegulatoryReference(
        entry,
        references,
        index,
        entries.length,
      );

      const customerSnapshot = this.buildCustomerSnapshot(quotation);
      const assetSnapshot = this.buildAssetSnapshot(entry);
      const pricingSnapshot = this.buildEntryPricingSnapshot(entry);
      const distributionSnapshot = this.buildDistributionSnapshot(quotation);
      const persisted = existing.find(
        (item) => item.quotation_entry_id === entry.id,
      );

      const issuedAt = new Date();
      const coverNoteUnsigned = {
        quotationId: quotation.id,
        quotationEntryId: entry.id,
        coverNoteNumber: entry.cover_note_number,
        coverNoteReferenceNumber: reference?.coverNoteReferenceNumber ?? null,
        stickerNumber: reference?.stickerNumber ?? null,
        responseId: regulatoryResponse.responseId,
        requestId: regulatoryResponse.requestId,
      };

      const record = repository.create({
        ...(persisted ?? {}),
        company_id: quotation.company_id,
        insurer_company_id: quotation.insurer_company_id,
        intermediary_company_id: quotation.intermediary_company_id,
        branch_id: quotation.branch_id,
        sale_point_id: null,
        customer_id: quotation.customer_id!,
        quotation_id: quotation.id,
        quotation_entry_id: entry.id,
        policy_id: persisted?.policy_id ?? null,
        insured_asset_id: persisted?.insured_asset_id ?? null,
        tiramis_tracking_id: tracking.id,
        tiramis_transaction_id:
          submission.tiramis_transaction_id ??
          regulatoryResponse.transactionId ??
          tracking.tiramisTransactionId ??
          tracking.id,
        tiramis_request_id:
          submission.tiramis_request_id ??
          regulatoryResponse.requestId ??
          tracking.tiramisRequestId ??
          tracking.id,
        response_id: regulatoryResponse.responseId,
        cover_note_number: entry.cover_note_number,
        cover_note_reference_number:
          reference?.coverNoteReferenceNumber ??
          persisted?.cover_note_reference_number ??
          null,
        sticker_number:
          reference?.stickerNumber ?? persisted?.sticker_number ?? null,
        entry_type: entry.entry_type,
        fleet_entry: entry.fleet_entry,
        status: 'ISSUED',
        regulatory_sync_status: 'IN_SYNC',
        product_id: quotation.product_id,
        product_version_id: quotation.product_version_id,
        product_code: quotation.cover_note.product_code,
        product_definition_hash: quotation.product_definition_hash,
        customer_snapshot: customerSnapshot,
        customer_snapshot_hash:
          this.hashService.hashDefinition(customerSnapshot),
        asset_snapshot: assetSnapshot,
        asset_snapshot_hash: this.hashService.hashDefinition(assetSnapshot),
        pricing_snapshot: pricingSnapshot,
        pricing_result_hash: this.hashService.hashDefinition(pricingSnapshot),
        distribution_snapshot: distributionSnapshot,
        distribution_snapshot_hash: distributionSnapshot
          ? this.hashService.hashDefinition(distributionSnapshot)
          : null,
        start_date: quotation.cover_note.cover_note_start_date
          .toISOString()
          .slice(0, 10),
        end_date: quotation.cover_note.cover_note_end_date
          .toISOString()
          .slice(0, 10),
        currency_code: quotation.cover_note.currency_code,
        sum_insured: this.sumEntryRiskValue(entry, 'sum_insured'),
        premium_excluding_tax: this.sumEntryRiskValue(
          entry,
          'premium_excluding_tax_equivalent',
        ),
        premium_including_tax: this.sumEntryRiskValue(
          entry,
          'premium_including_tax',
        ),
        commission_amount: quotation.cover_note.commission_paid,
        commission_rate: quotation.cover_note.commission_rate,
        final_response_status_code: regulatoryResponse.statusCode,
        final_response_status_desc: regulatoryResponse.statusDescription,
        final_response_payload: regulatoryResponse as unknown as Record<
          string,
          unknown
        >,
        final_response_payload_hash:
          regulatoryResponse.responsePayloadHash ??
          this.hashService.hashDefinition(coverNoteUnsigned),
        signature_verified: regulatoryResponse.signatureVerified,
        issued_at: issuedAt,
        rejected_at: null,
        expires_at: quotation.cover_note.cover_note_end_date,
        created_by: persisted?.created_by ?? quotation.created_by ?? null,
      });

      saved.push(await repository.save(record));
    }

    return saved;
  }

  private async createOrReuseIssuedPolicy(
    manager: EntityManager,
    submission: PortalTiraSubmission,
    quotation: IssuableQuotation,
    regulatoryResponse: RegulatoryFinalResponse,
    coverNotes: CoverNote[],
  ): Promise<Policy | null> {
    const policyRepository = manager.getRepository(Policy);
    let policy = await policyRepository.findOne({
      where: {
        company_id: quotation.company_id,
        quotation_id: quotation.id,
        source_quotation_revision: quotation.workflow_revision,
      },
    });

    if (!policy) {
      const policyNo = await this.generatePolicyNo(
        quotation.company_id,
        quotation.channel_type,
        manager,
      );
      const customerSnapshot = this.buildCustomerSnapshot(quotation);
      const distributionSnapshot = this.buildDistributionSnapshot(quotation);
      const pricingSnapshot = this.buildQuotationPricingSnapshot(quotation);

      policy = await policyRepository.save(
        policyRepository.create({
          company_id: quotation.company_id,
          insurer_company_id: quotation.insurer_company_id,
          intermediary_company_id: quotation.intermediary_company_id,
          branch_id: quotation.branch_id,
          department_id: quotation.department_id,
          created_by: quotation.created_by,
          customer_id: quotation.customer_id!,
          quotation_id: quotation.id,
          source_quotation_revision: quotation.workflow_revision,
          source_finalization_hash: quotation.finalization_hash,
          proposal_id: null,
          category_id: quotation.category_id,
          product_id: quotation.product_id,
          product_version_id: quotation.product_version_id,
          product_definition_hash: quotation.product_definition_hash,
          sub_class_id: quotation.sub_class_id,
          policy_no: policyNo,
          cover_note_no: coverNotes[0]?.cover_note_reference_number ?? null,
          external_policy_no: null,
          channel_type: quotation.channel_type,
          policy_status: 'COVER_NOTE_ISSUED',
          policy_reference_number: null,
          regulatory_sync_status: 'IN_SYNC',
          source_cover_note_count: coverNotes.length,
          issued_by_system: true,
          start_date: quotation.cover_note.cover_note_start_date
            .toISOString()
            .slice(0, 10),
          end_date: quotation.cover_note.cover_note_end_date
            .toISOString()
            .slice(0, 10),
          issue_date: new Date().toISOString().slice(0, 10),
          activated_at: null,
          rejected_at: null,
          currency: quotation.cover_note.currency_code,
          customer_snapshot: customerSnapshot,
          customer_snapshot_hash:
            this.hashService.hashDefinition(customerSnapshot),
          pricing_snapshot: pricingSnapshot,
          pricing_result_hash: this.hashService.hashDefinition(pricingSnapshot),
          distribution_snapshot: distributionSnapshot,
          distribution_snapshot_hash: distributionSnapshot
            ? this.hashService.hashDefinition(distributionSnapshot)
            : null,
          sum_insured: this.sumQuotationEntryValue(quotation, 'sum_insured'),
          basic_premium: quotation.cover_note.total_premium_excluding_tax,
          total_discount: this.sumQuotationDiscounts(quotation),
          total_tax: this.sumQuotationTaxes(quotation),
          total_charges: '0',
          total_commission: quotation.cover_note.commission_paid,
          total_premium: quotation.cover_note.total_premium_including_tax,
          net_premium: quotation.cover_note.total_premium_including_tax,
          reinsurance_required: false,
          reinsurance_status: 'NOT_REQUIRED',
          retention_amount: '0',
          ceded_sum_insured: '0',
          ceded_premium: '0',
          tira_status: 'SUBMITTED',
          tira_portal_transaction_id: submission.id,
          tiramis_transaction_id:
            submission.tiramis_transaction_id ??
            regulatoryResponse.transactionId,
          tiramis_submission_tracking_id: null,
          tiramis_status: submission.status,
          tiramis_request_id:
            submission.tiramis_request_id ?? regulatoryResponse.requestId,
          tiramis_service_type:
            submission.service_type ?? regulatoryResponse.requestType,
          tiramis_root_element:
            submission.root_element ?? regulatoryResponse.responseRoot,
          tiramis_final_response_id: regulatoryResponse.responseId,
          tiramis_final_response_status_code: regulatoryResponse.statusCode,
          tiramis_final_response_status_desc:
            regulatoryResponse.statusDescription,
          tiramis_last_synced_at: new Date(),
          tiramis_payload: payloadLike(regulatoryResponse),
          regulatory_response_payload: regulatoryResponse as unknown as Record<
            string,
            unknown
          >,
          regulatory_response_hash: regulatoryResponse.responsePayloadHash,
          state_version: 1,
          current_version_no: 1,
          metadata: {
            issuanceSource: 'TIRAMIS_FINAL_RESPONSE',
            quotationId: quotation.id,
            workflowRevision: quotation.workflow_revision,
          },
        }),
      );

      await this.createPolicyStatusHistory(
        manager,
        policy,
        'NONE',
        'COVER_NOTE_ISSUED',
      );
      await this.createPolicyChildren(manager, policy, quotation);
      await this.createPolicyVersion(
        manager,
        policy,
        quotation,
        coverNotes,
        submission,
      );
    } else {
      policy.cover_note_no =
        policy.cover_note_no ??
        coverNotes[0]?.cover_note_reference_number ??
        null;
      policy.regulatory_sync_status = 'IN_SYNC';
      policy.regulatory_response_payload =
        regulatoryResponse as unknown as Record<string, unknown>;
      policy.regulatory_response_hash = regulatoryResponse.responsePayloadHash;
      policy.source_cover_note_count = coverNotes.length;
      policy.state_version = Number(policy.state_version || 1) + 1;
      policy = await policyRepository.save(policy);
    }

    await this.linkPolicyToCoverNotes(manager, policy, coverNotes);

    return policy;
  }

  private async linkPolicyToCoverNotes(
    manager: EntityManager,
    policy: Policy,
    coverNotes: CoverNote[],
  ) {
    const linkRepository = manager.getRepository(PolicyCoverNote);
    const existing = await linkRepository.find({
      where: {
        policy_id: policy.id,
      },
    });

    for (const [index, coverNote] of coverNotes.entries()) {
      const found = existing.find(
        (item) => item.cover_note_id === coverNote.id,
      );
      if (!found) {
        await linkRepository.save({
          company_id: policy.company_id,
          policy_id: policy.id,
          cover_note_id: coverNote.id,
          sequence_number: index + 1,
        });
      }

      if (coverNote.policy_id !== policy.id) {
        coverNote.policy_id = policy.id;
        await manager.getRepository(CoverNote).save(coverNote);
      }
    }
  }

  private async createPolicyChildren(
    manager: EntityManager,
    policy: Policy,
    quotation: IssuableQuotation,
  ) {
    const riskRepository = manager.getRepository(PolicyRisk);
    const breakdownRepository = manager.getRepository(PolicyPremiumBreakdown);

    for (const entry of quotation.cover_note.entries) {
      for (const risk of entry.risks) {
        if (!risk.insurance_risk_id) {
          throw new BadRequestException(
            `Quotation risk ${risk.id} is missing insurance_risk_id and cannot be issued into a policy.`,
          );
        }

        const policyRisk = await riskRepository.save({
          policy_id: policy.id,
          quotation_entry_risk_id: risk.id,
          risk_id: risk.insurance_risk_id,
          subject_matter_id: null,
          motor_vehicle_id: null,
          sum_insured: risk.sum_insured,
          rate: risk.premium_rate,
          basic_premium: risk.premium_before_discount,
          discount_amount: this.sumRiskDiscounts(risk),
          tax_amount: this.sumRiskTaxes(risk),
          charges_amount: '0',
          commission_amount: '0',
          total_premium: risk.premium_including_tax,
          net_premium: risk.premium_including_tax,
          reinsurance_required: false,
          retention_amount: '0',
          ceded_sum_insured: '0',
          ceded_premium: '0',
          reinsurance_status: 'NOT_REQUIRED',
          status: 'ACTIVE',
        });

        await breakdownRepository.save({
          policy_id: policy.id,
          policy_risk_id: policyRisk.id,
          item_type: QuotationPremiumItemType.BASIC_PREMIUM,
          item_code: risk.risk_code,
          item_name: `${risk.risk_code} basic premium`,
          rate: risk.premium_rate,
          amount: risk.premium_before_discount,
          calculation_base: QuotationCalculationBase.BASIC_PREMIUM,
          calculation_order: 1,
        });

        for (const [discountIndex, discount] of risk.discounts.entries()) {
          await breakdownRepository.save({
            policy_id: policy.id,
            policy_risk_id: policyRisk.id,
            item_type: QuotationPremiumItemType.DISCOUNT,
            item_code: `DISCOUNT-${discount.discount_type}`,
            item_name: `Discount ${discount.discount_type}`,
            rate: discount.approved_rate ?? discount.discount_rate,
            amount: discount.approved_amount ?? discount.discount_amount,
            calculation_base: QuotationCalculationBase.BASIC_PREMIUM,
            calculation_order: 100 + discountIndex,
          });
        }

        for (const [taxIndex, tax] of risk.taxes.entries()) {
          await breakdownRepository.save({
            policy_id: policy.id,
            policy_risk_id: policyRisk.id,
            item_type: QuotationPremiumItemType.TAX,
            item_code: tax.tax_code,
            item_name: `Tax ${tax.tax_code}`,
            rate: tax.tax_rate,
            amount: tax.tax_amount,
            calculation_base: QuotationCalculationBase.NET_PREMIUM,
            calculation_order: 200 + taxIndex,
          });
        }
      }
    }
  }

  private async createPolicyVersion(
    manager: EntityManager,
    policy: Policy,
    quotation: IssuableQuotation,
    coverNotes: CoverNote[],
    submission: PortalTiraSubmission,
  ) {
    const repository = manager.getRepository(PolicyVersion);
    const existing = await repository.findOne({
      where: {
        policy_id: policy.id,
        version_number: 1,
      },
    });

    if (existing) {
      return existing;
    }

    const customerSnapshot = this.buildCustomerSnapshot(quotation);
    const pricingSnapshot = this.buildQuotationPricingSnapshot(quotation);
    const assetManifest = this.buildAssetManifest(quotation);
    const policySnapshot = {
      policyNo: policy.policy_no,
      quotationId: quotation.id,
      workflowRevision: quotation.workflow_revision,
      coverNotes: coverNotes.map((item) => ({
        id: item.id,
        coverNoteNumber: item.cover_note_number,
        coverNoteReferenceNumber: item.cover_note_reference_number,
        stickerNumber: item.sticker_number,
      })),
      policyStatus: policy.policy_status,
      issueDate: policy.issue_date,
      startDate: policy.start_date,
      endDate: policy.end_date,
      totals: {
        sumInsured: policy.sum_insured,
        totalPremium: policy.total_premium,
        totalCommission: policy.total_commission,
      },
    };

    return repository.save({
      company_id: policy.company_id,
      policy_id: policy.id,
      version_number: 1,
      version_type: 'NEW_BUSINESS',
      status: policy.policy_status,
      effective_from: policy.start_date,
      effective_to: policy.end_date,
      policy_snapshot: policySnapshot,
      policy_snapshot_hash: this.hashService.hashDefinition(policySnapshot),
      pricing_snapshot: pricingSnapshot,
      pricing_result_hash: this.hashService.hashDefinition(pricingSnapshot),
      customer_snapshot: customerSnapshot,
      customer_snapshot_hash: this.hashService.hashDefinition(customerSnapshot),
      asset_manifest: assetManifest,
      asset_manifest_hash: this.hashService.hashDefinition(assetManifest),
      tiramis_tracking_id: null,
      created_by: policy.created_by,
    });
  }

  private async findLinkedPolicyForActivation(
    manager: EntityManager,
    submission: PortalTiraSubmission,
  ) {
    const repository = manager.getRepository(Policy);

    if (submission.policy_id) {
      const byId = await repository.findOne({
        where: {
          id: submission.policy_id,
          company_id: submission.company_id,
        },
      });

      if (byId) {
        return byId;
      }
    }

    if (submission.source_record_id) {
      const bySource = await repository.findOne({
        where: {
          id: submission.source_record_id,
          company_id: submission.company_id,
        },
      });

      if (bySource) {
        return bySource;
      }
    }

    if (submission.quotation_id) {
      return repository
        .createQueryBuilder('policy')
        .where('policy.quotation_id = :quotationId', {
          quotationId: submission.quotation_id,
        })
        .andWhere('policy.company_id = :companyId', {
          companyId: submission.company_id,
        })
        .orderBy('policy.created_at', 'DESC')
        .getOne();
    }

    return null;
  }

  private async resolveTrackingOrThrow(
    manager: EntityManager,
    submission: PortalTiraSubmission,
  ) {
    const repository = manager.getRepository(TiramisSubmissionTrackingEntity);

    const byLegacySubmission = await repository.findOne({
      where: {
        legacyPortalSubmissionId: submission.id,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (byLegacySubmission) {
      return byLegacySubmission;
    }

    if (submission.tiramis_request_id) {
      const byRequest = await repository.findOne({
        where: {
          tiramisRequestId: submission.tiramis_request_id,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (byRequest) {
        return byRequest;
      }
    }

    if (submission.tiramis_transaction_id) {
      const byTransaction = await repository.findOne({
        where: {
          tiramisTransactionId: submission.tiramis_transaction_id,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (byTransaction) {
        return byTransaction;
      }
    }

    if (submission.source_record_id) {
      const bySourceRecord = await repository.findOne({
        where: {
          sourceRecordId: submission.source_record_id,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (bySourceRecord) {
        return bySourceRecord;
      }
    }

    if (submission.quotation_id) {
      const byQuotation = await repository.findOne({
        where: {
          quotationId: submission.quotation_id,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (byQuotation) {
        return byQuotation;
      }
    }

    throw new BadRequestException(
      'TIRAMIS tracking provenance is required before cover-note issuance can be persisted.',
    );
  }

  private async loadIssuableQuotation(
    manager: EntityManager,
    companyId: string,
    quotationId: string,
  ): Promise<IssuableQuotation> {
    const quotation = (await manager.getRepository(Quotation).findOne({
      where: {
        id: quotationId,
        company_id: companyId,
      },
      relations: {
        customer: true,
        cover_note: {
          entries: {
            motor_detail: true,
            subject_matters: true,
            risks: {
              discounts: true,
              taxes: true,
            },
          },
        },
        policy_holders: true,
      },
    })) as IssuableQuotation | null;

    if (!quotation || !quotation.cover_note) {
      throw new BadRequestException(
        'Quotation or quotation cover-note details were not found.',
      );
    }

    return quotation;
  }

  private matchRegulatoryReference(
    entry: QuotationCoverNoteEntry & {
      motor_detail: QuotationMotorDetail | null;
    },
    references: RegulatoryCoverNoteReference[],
    index: number,
    totalEntries: number,
  ): RegulatoryCoverNoteReference | null {
    if (!references.length) {
      return null;
    }

    return (
      references.find((item) => item.quotationEntryId === entry.id) ??
      references.find(
        (item) => item.sourceCoverNoteNumber === entry.cover_note_number,
      ) ??
      references.find(
        (item) =>
          item.fleetEntry !== null &&
          item.fleetEntry === (entry.fleet_entry ?? entry.entry_number),
      ) ??
      references.find(
        (item) =>
          item.registrationNumber &&
          entry.motor_detail?.registration_number &&
          item.registrationNumber.trim().toUpperCase() ===
            entry.motor_detail.registration_number.trim().toUpperCase(),
      ) ??
      references.find(
        (item) =>
          item.chassisNumber &&
          entry.motor_detail?.chassis_number &&
          item.chassisNumber.trim().toUpperCase() ===
            entry.motor_detail.chassis_number.trim().toUpperCase(),
      ) ??
      (references.length === totalEntries ? references[index] : null) ??
      (references.length === 1 ? references[0] : null)
    );
  }

  private buildCustomerSnapshot(quotation: IssuableQuotation) {
    const primaryHolder = [...(quotation.policy_holders ?? [])].sort(
      (left, right) => left.sequence_no - right.sequence_no,
    )[0];

    return {
      customerId: quotation.customer_id,
      customerNumber: quotation.customer?.customer_no ?? null,
      displayName:
        quotation.customer?.display_name ??
        primaryHolder?.policy_holder_name ??
        null,
      policyHolder: primaryHolder
        ? {
            id: primaryHolder.id,
            name: primaryHolder.policy_holder_name,
            birthDate: primaryHolder.policy_holder_birth_date,
            phone: primaryHolder.policy_holder_phone_number,
            email: primaryHolder.email_address,
            countryCode: primaryHolder.country_code,
            region: primaryHolder.region,
            district: primaryHolder.district,
          }
        : null,
    };
  }

  private buildAssetSnapshot(
    entry: QuotationCoverNoteEntry & {
      motor_detail: QuotationMotorDetail | null;
      subject_matters: QuotationSubjectMatter[];
      risks: QuotationEntryRisk[];
    },
  ) {
    return {
      entryId: entry.id,
      entryNumber: entry.entry_number,
      entryType: entry.entry_type,
      fleetEntry: entry.fleet_entry,
      coverNoteNumber: entry.cover_note_number,
      description: entry.cover_note_desc,
      motor: entry.motor_detail
        ? {
            registrationNumber: entry.motor_detail.registration_number,
            chassisNumber: entry.motor_detail.chassis_number,
            make: entry.motor_detail.make,
            model: entry.motor_detail.model,
            usage: entry.motor_detail.motor_usage,
            ownerName: entry.motor_detail.owner_name,
          }
        : null,
      subjectMatters: entry.subject_matters.map((subject) => ({
        id: subject.id,
        reference: subject.subject_matter_reference,
        description: subject.subject_matter_desc,
      })),
      riskCodes: entry.risks.map((risk) => risk.risk_code),
    };
  }

  private buildEntryPricingSnapshot(
    entry: QuotationCoverNoteEntry & {
      risks: Array<
        QuotationEntryRisk & {
          discounts: QuotationRiskDiscount[];
          taxes: QuotationRiskTax[];
        }
      >;
    },
  ) {
    return {
      entryId: entry.id,
      coverNoteNumber: entry.cover_note_number,
      risks: entry.risks.map((risk) => ({
        id: risk.id,
        riskCode: risk.risk_code,
        pricingQuoteId: risk.pricing_quote_id,
        pricingResultHash: risk.pricing_result_hash,
        pricingSnapshot: risk.pricing_snapshot,
        sumInsured: risk.sum_insured,
        sumInsuredEquivalent: risk.sum_insured_equivalent,
        premiumRate: risk.premium_rate,
        premiumBeforeDiscount: risk.premium_before_discount,
        premiumAfterDiscount: risk.premium_after_discount,
        premiumExcludingTaxEquivalent: risk.premium_excluding_tax_equivalent,
        premiumIncludingTax: risk.premium_including_tax,
        discounts: risk.discounts.map((discount) => ({
          discountType: discount.discount_type,
          discountRate: discount.discount_rate,
          discountAmount: discount.discount_amount,
          approvedRate: discount.approved_rate,
          approvedAmount: discount.approved_amount,
        })),
        taxes: risk.taxes.map((tax) => ({
          taxCode: tax.tax_code,
          taxRate: tax.tax_rate,
          taxAmount: tax.tax_amount,
        })),
      })),
    };
  }

  private buildQuotationPricingSnapshot(quotation: IssuableQuotation) {
    return {
      quotationId: quotation.id,
      workflowRevision: quotation.workflow_revision,
      currencyCode: quotation.cover_note.currency_code,
      exchangeRate: quotation.cover_note.exchange_rate,
      totalPremiumExcludingTax:
        quotation.cover_note.total_premium_excluding_tax,
      totalPremiumIncludingTax:
        quotation.cover_note.total_premium_including_tax,
      commissionPaid: quotation.cover_note.commission_paid,
      commissionRate: quotation.cover_note.commission_rate,
      entries: quotation.cover_note.entries.map((entry) =>
        this.buildEntryPricingSnapshot(entry),
      ),
    };
  }

  private buildDistributionSnapshot(quotation: IssuableQuotation) {
    const snapshot =
      quotation.finalization_snapshot &&
      typeof quotation.finalization_snapshot === 'object'
        ? (quotation.finalization_snapshot.distribution as
            | Record<string, unknown>
            | undefined)
        : undefined;

    return (
      snapshot ?? {
        intermediaryCompanyId: quotation.intermediary_company_id,
        channelType: quotation.channel_type,
      }
    );
  }

  private buildAssetManifest(quotation: IssuableQuotation) {
    return {
      quotationId: quotation.id,
      entryCount: quotation.cover_note.entries.length,
      entries: quotation.cover_note.entries.map((entry) =>
        this.buildAssetSnapshot(entry),
      ),
    };
  }

  private async createPolicyStatusHistory(
    manager: EntityManager,
    policy: Policy,
    oldStatus: string,
    newStatus: string,
  ) {
    return manager.getRepository(PolicyStatusHistory).save({
      policy_id: policy.id,
      old_status: oldStatus,
      new_status: newStatus,
      reason: 'Created from TIRA cover-note final response',
      changed_by: null,
    });
  }

  private async generatePolicyNo(
    companyId: string,
    channelType: ProductChannelType,
    manager: EntityManager,
  ) {
    const prefix = `POL-${channelType === ProductChannelType.DIRECT ? 'DIR' : channelType.slice(0, 3)}-${new Date().getFullYear()}-`;
    const last = await manager
      .getRepository(Policy)
      .createQueryBuilder('policy')
      .where('policy.company_id = :companyId', { companyId })
      .andWhere('policy.policy_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('policy.policy_no', 'DESC')
      .limit(1)
      .getOne();

    const next = last?.policy_no
      ? Number(last.policy_no.substring(prefix.length)) + 1
      : 1;

    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private sumEntryRiskValue(
    entry: QuotationCoverNoteEntry & { risks: QuotationEntryRisk[] },
    field:
      | 'sum_insured'
      | 'premium_excluding_tax_equivalent'
      | 'premium_including_tax',
  ) {
    return String(
      entry.risks.reduce(
        (total, risk) => total + Number(this.getRiskNumericField(risk, field)),
        0,
      ),
    );
  }

  private sumQuotationEntryValue(
    quotation: IssuableQuotation,
    field: 'sum_insured',
  ) {
    return String(
      quotation.cover_note.entries.reduce(
        (total, entry) =>
          total +
          entry.risks.reduce(
            (riskTotal, risk) =>
              riskTotal + Number(this.getRiskNumericField(risk, field)),
            0,
          ),
        0,
      ),
    );
  }

  private sumQuotationDiscounts(quotation: IssuableQuotation) {
    return String(
      quotation.cover_note.entries.reduce(
        (total, entry) =>
          total +
          entry.risks.reduce(
            (riskTotal, risk) =>
              riskTotal + Number(this.sumRiskDiscounts(risk)),
            0,
          ),
        0,
      ),
    );
  }

  private sumQuotationTaxes(quotation: IssuableQuotation) {
    return String(
      quotation.cover_note.entries.reduce(
        (total, entry) =>
          total +
          entry.risks.reduce(
            (riskTotal, risk) => riskTotal + Number(this.sumRiskTaxes(risk)),
            0,
          ),
        0,
      ),
    );
  }

  private sumRiskDiscounts(
    risk: QuotationEntryRisk & { discounts?: QuotationRiskDiscount[] },
  ) {
    return String(
      (risk.discounts ?? []).reduce(
        (total, discount) =>
          total +
          Number(discount.approved_amount ?? discount.discount_amount ?? 0),
        0,
      ),
    );
  }

  private sumRiskTaxes(
    risk: QuotationEntryRisk & { taxes?: QuotationRiskTax[] },
  ) {
    return String(
      (risk.taxes ?? []).reduce(
        (total, tax) => total + Number(tax.tax_amount ?? 0),
        0,
      ),
    );
  }

  private getRiskNumericField(
    risk: QuotationEntryRisk,
    field:
      | 'sum_insured'
      | 'premium_excluding_tax_equivalent'
      | 'premium_including_tax',
  ) {
    switch (field) {
      case 'sum_insured':
        return risk.sum_insured;
      case 'premium_excluding_tax_equivalent':
        return risk.premium_excluding_tax_equivalent;
      case 'premium_including_tax':
        return risk.premium_including_tax;
      default:
        return '0';
    }
  }
}

function payloadLike(value: RegulatoryFinalResponse): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}
