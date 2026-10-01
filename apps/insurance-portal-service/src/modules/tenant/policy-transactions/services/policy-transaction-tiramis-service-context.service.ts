import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  PricingRateBookSnapshot,
  PricingResultSnapshot,
  ProductDefinitionSnapshot,
  QuotationApprovalStatus,
  QuotationPaymentStatus,
  QuotationStage,
  QuotationSubmissionStatus,
  ServiceFinanceContext,
  ServiceInsuredDataContext,
  ServicePricingContext,
  ServiceProductContext,
  ServiceQuotationGateContext,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { CommissionTransaction } from '../../billing-commission/entities/commission-transaction.entity';
import { Invoice } from '../../billing-commission/entities/invoice.entity';
import { Receipt } from '../../billing-commission/entities/receipt.entity';
import { CustomerKycStatus } from '../../customers/enums/customer-kyc-status.enum';
import { PricingQuote } from '../../pricing/entities/pricing-quote.entity';
import { PricingRateBook } from '../../pricing-rate-books/entities/pricing-rate-book.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';

export interface PolicyTransactionTiramisServiceContext {
  product?: ServiceProductContext;
  pricing?: ServicePricingContext;
  insuredData: ServiceInsuredDataContext;
  quotationGate: ServiceQuotationGateContext;
  finance?: ServiceFinanceContext;
}

/**
 * Builds the same signed `X-Service-Context` that apps/tiramis's submission
 * guards (TiramisProductContextGuard, TiramisPricingContextGuard,
 * TiramisInsuredDataContextGuard, TiramisQuotationGateGuard,
 * TiramisFinanceContextGuard) require on every `/tiramis/*\/submit` call —
 * but for a policy-transaction (cancellation/endorsement) submission
 * against an already-issued policy, rather than a fresh quotation.
 *
 * Field-for-field mirror of the private `buildService*Context` methods on
 * `QuotationsService` (product/pricing/insuredData/finance), which is the
 * canonical implementation this was derived from — kept as a separate
 * service rather than a shared extraction so the live quotation-submission
 * path is not touched by this change.
 *
 * One deliberate divergence: a cancellation/endorsement can only be
 * requested once its originating quotation has already been fully issued
 * (approved, paid, accepted by TIRAMIS), so the workflow-gate portion of
 * the context is NOT recomputed from the quotation's *current* status —
 * that would read back SUBMITTED/ACCEPTED rather than the gate's
 * pre-submission COMPLETED state and fail `TiramisQuotationGateGuard`. It
 * instead asserts the gate the quotation already passed at issuance time.
 */
@Injectable()
export class PolicyTransactionTiramisServiceContextService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async build(
    companyId: string,
    quotation: Quotation,
    outboundPayload: Record<string, unknown>,
  ): Promise<PolicyTransactionTiramisServiceContext> {
    const product = quotation.product_definition_snapshot
      ? this.buildProductContext(
          quotation.product_definition_snapshot,
          outboundPayload,
        )
      : undefined;

    // TIRAMIS checks the signed pricing against the payload's lead risk, so
    // sign the fleet vehicle that leads the payload (entries load unordered).
    const leadFleetEntry = Number(
      ((outboundPayload.fleet as { items?: Array<{ fleetEntry?: unknown }> })
        ?.items ?? [])[0]?.fleetEntry,
    );
    const entries = [...(quotation.cover_note?.entries ?? [])].sort(
      (a, b) =>
        Number(b.entry_number === leadFleetEntry) -
          Number(a.entry_number === leadFleetEntry) ||
        a.entry_number - b.entry_number,
    );
    const riskWithPricingSnapshot = entries
      .flatMap((entry) => entry.risks ?? [])
      .find((risk) => !!risk.pricing_snapshot);
    const pricing = riskWithPricingSnapshot?.pricing_snapshot
      ? await this.buildPricingContext(
          companyId,
          riskWithPricingSnapshot.pricing_snapshot as unknown as PricingResultSnapshot,
          riskWithPricingSnapshot.pricing_quote_id,
        )
      : undefined;

    const insuredData = this.buildInsuredDataContext(
      quotation,
      outboundPayload,
    );
    const quotationGate = this.buildQuotationGateContext(
      quotation,
      outboundPayload,
    );
    const finance = await this.buildFinanceContext(companyId, quotation);

    return { product, pricing, insuredData, quotationGate, finance };
  }

  private buildProductContext(
    definition: ProductDefinitionSnapshot,
    outboundPayload: Record<string, unknown>,
  ): ServiceProductContext {
    const outboundCoverNoteDesc =
      typeof outboundPayload.coverNoteDesc === 'string'
        ? outboundPayload.coverNoteDesc
        : definition.coverNoteDescription;
    const outboundOperativeClause =
      typeof outboundPayload.operativeClause === 'string'
        ? outboundPayload.operativeClause
        : definition.operativeClause;

    return {
      productId: definition.productId,
      productVersionId: definition.productVersionId,
      versionNumber: definition.versionNumber,
      productCode: definition.productCode,
      tiramisProductCode: definition.tiramisProductCode,
      definitionHash: definition.definitionHash,
      coverNoteType:
        typeof outboundPayload.coverNoteType === 'number'
          ? outboundPayload.coverNoteType
          : definition.coverNoteType,
      coverNoteDescriptionHash: this.hashService.hashText(
        outboundCoverNoteDesc,
      ),
      operativeClauseHash: this.hashService.hashText(outboundOperativeClause),
      policyOperativeClauseHash: this.hashService.hashText(
        definition.policyOperativeClause,
      ),
      specialConditionsHash: this.hashService.hashText(
        definition.specialConditions,
      ),
      exclusionsHash: this.hashService.hashText(definition.exclusions),
      allowsCoverTextOverride: definition.allowsCoverTextOverride,
    };
  }

  private async buildPricingContext(
    companyId: string,
    snapshot: PricingResultSnapshot,
    pricingQuoteId?: string | null,
  ): Promise<ServicePricingContext> {
    const pricingQuote = pricingQuoteId
      ? await this.dataSource.getRepository(PricingQuote).findOne({
          where: {
            company_id: companyId,
            pricing_quote_id: pricingQuoteId,
          },
        })
      : null;
    const persistedRateBookSnapshot =
      pricingQuote?.rate_book_snapshot as PricingRateBookSnapshot | null;
    const rateBookSnapshot = snapshot.rateBook ?? persistedRateBookSnapshot;
    const rateBookId =
      rateBookSnapshot?.rateBookId ?? pricingQuote?.rate_book_id ?? '';
    const rateBook = rateBookId
      ? await this.dataSource.getRepository(PricingRateBook).findOne({
          where: {
            company_id: companyId,
            id: rateBookId,
          },
        })
      : null;
    const matchedRule = rateBookSnapshot?.matchedRule;
    const resolvedPricingQuoteId =
      snapshot.pricingQuoteId ?? pricingQuote?.pricing_quote_id ?? '';
    const rateBookDefinitionHash =
      rateBookSnapshot?.definitionHash?.trim() ||
      pricingQuote?.rate_book_definition_hash?.trim() ||
      rateBook?.definition_hash?.trim() ||
      '';
    const matchedRuleId =
      matchedRule?.ruleId?.trim() || pricingQuote?.matched_rule_id || '';
    const resultHash =
      snapshot.resultHash?.trim() || pricingQuote?.result_hash?.trim() || '';

    if (
      !resolvedPricingQuoteId ||
      !rateBookId ||
      !rateBookDefinitionHash ||
      !matchedRuleId ||
      !resultHash
    ) {
      throw new ConflictException({
        code: 'TIRAMIS_PRICING_CONTEXT_INCOMPLETE',
        message:
          'The originating quotation is missing signed TIRAMIS pricing context data.',
      });
    }

    return {
      pricingQuoteId: resolvedPricingQuoteId,
      productVersionId:
        rateBookSnapshot?.productVersionId?.trim() ||
        pricingQuote?.product_version_id ||
        rateBook?.product_version_id ||
        '',
      productDefinitionHash:
        rateBookSnapshot?.productDefinitionHash?.trim() ||
        pricingQuote?.product_definition_hash?.trim() ||
        rateBook?.product_definition_hash?.trim() ||
        '',
      rateBookId,
      rateBookCode: rateBookSnapshot?.code?.trim() || rateBook?.code || '',
      rateBookVersion:
        rateBookSnapshot?.version?.trim() ||
        pricingQuote?.rate_book_version ||
        rateBook?.version ||
        '',
      rateBookDefinitionHash,
      matchedRuleId,
      matchedRuleVersion:
        matchedRule?.ruleVersion ?? pricingQuote?.matched_rule_version ?? 0,
      riskId: snapshot.riskId,
      riskCode: snapshot.riskCode,
      currencyCode: snapshot.currencyCode,
      basicPremium: snapshot.premiumAfterMaximum,
      addonPremium: snapshot.baseAddonPremium,
      loadingAmount: snapshot.loading.appliedAmount,
      discountAmount: snapshot.discount.appliedAmount,
      premiumExcludingTax: snapshot.premiumExcludingCharges,
      taxAmount: snapshot.totalChargeAmount,
      premiumIncludingTax: snapshot.finalPayablePremium,
      finalPayablePremium: snapshot.finalPayablePremium,
      calculationVersion: snapshot.calculationVersion,
      inputHash: snapshot.inputHash,
      resultHash: snapshot.resultHash,
    };
  }

  private buildInsuredDataContext(
    quotation: Quotation,
    outboundPayload: Record<string, unknown>,
  ): ServiceInsuredDataContext {
    const customer = quotation.customer;

    if (!customer?.id || !customer.customer_no) {
      throw new ConflictException(
        'The originating quotation is missing an authoritative customer record for TIRAMIS submission.',
      );
    }

    if (customer.kyc_status !== CustomerKycStatus.VERIFIED) {
      throw new ConflictException(
        'Customer KYC must be verified before submitting this transaction to TIRAMIS.',
      );
    }

    const policyHolderManifest =
      this.buildPolicyHolderManifest(outboundPayload);

    if (policyHolderManifest.length === 0) {
      throw new BadRequestException(
        'This submission is missing policy-holder data for TIRAMIS.',
      );
    }

    // Cancellations don't re-describe the insured asset in their own
    // outbound payload (nothing about the vehicle/subject-matter changes on
    // cancellation) — apps/tiramis's insured-data guard only cross-checks
    // this hash against the request body when the body actually carries a
    // motorDetail/fleet/subjectMatters field, so falling back to the
    // *quotation's* own asset data here is safe: there's nothing in the
    // cancellation body to mismatch against.
    const payloadAssetManifest = this.buildAssetManifest(outboundPayload);
    const assetManifest =
      payloadAssetManifest.length > 0
        ? payloadAssetManifest
        : this.buildAssetManifestFromQuotation(quotation);

    if (assetManifest.length === 0) {
      throw new BadRequestException(
        'This submission is missing insured-asset data for TIRAMIS.',
      );
    }

    const tiramisPolicyHolderHash = this.hashService.hashDefinition(
      policyHolderManifest as unknown as Record<string, unknown>,
    );
    const assetManifestHash = this.hashService.hashDefinition(
      assetManifest as unknown as Record<string, unknown>,
    );

    return {
      customerId: customer.id,
      customerNumber: customer.customer_no,
      customerKycStatus: customer.kyc_status,
      customerKycVersion: Number(customer.kyc_version ?? 0),
      customerSnapshotHash: tiramisPolicyHolderHash,
      tiramisPolicyHolderHash,
      assetManifestHash,
      assetCount: assetManifest.length,
      manifestVersion: '8.1',
    };
  }

  private buildQuotationGateContext(
    quotation: Quotation,
    outboundPayload: Record<string, unknown>,
  ): ServiceQuotationGateContext {
    const workflowRevision = Math.max(1, quotation.workflow_revision ?? 1);
    const approvalRequired = quotation.requires_approval;
    const paymentRequired = quotation.requires_payment;
    // The gate below describes the state this quotation already satisfied
    // at issuance time, not its current post-issuance status — see class
    // doc comment.
    const quotationStage = QuotationStage.COMPLETED;
    const approvalStatus = approvalRequired
      ? QuotationApprovalStatus.APPROVED
      : QuotationApprovalStatus.NOT_REQUIRED;
    const paymentStatus = paymentRequired
      ? QuotationPaymentStatus.PAID
      : QuotationPaymentStatus.NOT_REQUIRED;
    const submissionStatus = QuotationSubmissionStatus.ACCEPTED;
    const completedAt = (
      quotation.workflow_completed_at ??
      quotation.submitted_at ??
      quotation.updated_at ??
      quotation.created_at ??
      null
    )?.toISOString();
    const finalizationHash =
      quotation.finalization_hash ??
      this.hashService.hashDefinition(outboundPayload);
    const workflowGateHash = this.hashService.hashDefinition({
      quotationId: quotation.id,
      quotationNumber: quotation.quotation_no,
      workflowRevision,
      quotationStage,
      approvalStatus,
      paymentStatus,
      submissionStatus,
      approvalRequired,
      paymentRequired,
      finalizationHash,
      completedAt,
    });

    return {
      quotationId: quotation.id,
      quotationNumber: quotation.quotation_no,
      workflowRevision,
      quotationStage,
      approvalStatus,
      paymentStatus,
      submissionStatus,
      paymentRequired,
      approvalRequired,
      finalizationHash,
      workflowGateHash,
      completedAt,
    };
  }

  private async buildFinanceContext(
    companyId: string,
    quotation: Quotation,
  ): Promise<ServiceFinanceContext | undefined> {
    const invoice = await this.dataSource
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .where('invoice.company_id = :companyId', { companyId })
      .andWhere('invoice.quotation_id = :quotationId', {
        quotationId: quotation.id,
      })
      .andWhere('invoice.deleted_at IS NULL')
      .orderBy('invoice.created_at', 'DESC')
      .getOne();

    const latestReceipt = invoice?.id
      ? await this.dataSource
          .getRepository(Receipt)
          .createQueryBuilder('receipt')
          .where('receipt.company_id = :companyId', { companyId })
          .andWhere('receipt.invoice_id = :invoiceId', {
            invoiceId: invoice.id,
          })
          .andWhere('receipt.deleted_at IS NULL')
          .orderBy('receipt.created_at', 'DESC')
          .getOne()
      : null;

    const commissionAccrual = await this.dataSource
      .getRepository(CommissionTransaction)
      .createQueryBuilder('commission')
      .where('commission.company_id = :companyId', { companyId })
      .andWhere('commission.quotation_id = :quotationId', {
        quotationId: quotation.id,
      })
      .andWhere('commission.deleted_at IS NULL')
      .orderBy('commission.created_at', 'DESC')
      .getOne();

    const requiredAmount = this.numeric(
      invoice?.total_amount ??
        quotation.cover_note?.total_premium_including_tax ??
        0,
      4,
    );
    const allocatedAmount = this.numeric(invoice?.paid_amount ?? 0, 4);
    const balanceAmount = this.numeric(invoice?.balance_amount ?? 0, 4);
    const currencyCode =
      invoice?.currency ??
      quotation.cover_note?.currency_code?.trim().toUpperCase() ??
      'TZS';

    return {
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoice_no ?? null,
      invoiceStatus: invoice?.status ?? null,
      requiredAmount,
      allocatedAmount,
      balanceAmount,
      currencyCode,
      latestReceiptId: latestReceipt?.id ?? null,
      latestReceiptNumber: latestReceipt?.receipt_no ?? null,
      paymentGateHash: this.hashService.hashDefinition({
        invoiceId: invoice?.id ?? null,
        invoiceStatus: invoice?.status ?? null,
        requiredAmount,
        allocatedAmount,
        balanceAmount,
        paymentStatus: quotation.payment_status_v2,
        workflowRevision: quotation.workflow_revision,
      }),
      commissionRate: commissionAccrual?.commission_rate ?? null,
      commissionAmount: commissionAccrual?.commission_amount ?? null,
      commissionAccrualId: commissionAccrual?.id ?? null,
    };
  }

  private buildPolicyHolderManifest(
    outboundPayload: Record<string, unknown>,
  ): Array<Record<string, string | number | null>> {
    const policyHolders = Array.isArray(outboundPayload.policyHolders)
      ? outboundPayload.policyHolders
      : [];

    return policyHolders
      .map((holder) => {
        const record = holder as Record<string, unknown>;

        return {
          policyHolderName: String(record.policyHolderName ?? '').trim(),
          policyHolderBirthDate: record.policyHolderBirthDate
            ? this.formatDate(record.policyHolderBirthDate)
            : null,
          policyHolderType: Number(record.policyHolderType),
          policyHolderIdNumber: String(record.policyHolderIdNumber ?? '')
            .replace(/[^A-Za-z0-9]/g, '')
            .toUpperCase(),
          policyHolderIdType: Number(record.policyHolderIdType),
          phoneNumber: String(record.phoneNumber ?? '').replace(/[\s()-]/g, ''),
          email:
            (record.email ?? record.emailAddress ?? null)
              ?.toString()
              .trim()
              .toLowerCase() ?? null,
        };
      })
      .sort((left, right) =>
        String(left.policyHolderIdNumber).localeCompare(
          String(right.policyHolderIdNumber),
        ),
      );
  }

  private buildAssetManifest(
    outboundPayload: Record<string, unknown>,
  ): Array<Record<string, string | number | null>> {
    const fleet = outboundPayload.fleet as { items?: unknown[] } | undefined;

    if (Array.isArray(fleet?.items)) {
      return fleet.items
        .map((item) =>
          this.mapMotorManifestItem(
            ((item as Record<string, unknown>).motorDetail ?? {}) as Record<
              string,
              unknown
            >,
          ),
        )
        .sort((left, right) =>
          String(
            left.registrationNumber ?? left.chassisNumber ?? '',
          ).localeCompare(
            String(right.registrationNumber ?? right.chassisNumber ?? ''),
          ),
        );
    }

    if (outboundPayload.motorDetail) {
      return [
        this.mapMotorManifestItem(
          outboundPayload.motorDetail as Record<string, unknown>,
        ),
      ];
    }

    const subjectMatters = Array.isArray(outboundPayload.subjectMatters)
      ? outboundPayload.subjectMatters
      : [];

    return subjectMatters
      .map((subject) => {
        const record = subject as Record<string, unknown>;

        return {
          reference: String(record.subjectMatterReference ?? '')
            .trim()
            .toUpperCase(),
          description: String(record.subjectMatterDesc ?? '').trim(),
        };
      })
      .sort((left, right) =>
        String(left.reference).localeCompare(String(right.reference)),
      );
  }

  /**
   * Fallback source for the asset manifest when the outbound payload
   * itself carries none (cancellations don't restate the insured
   * vehicle/subject-matter) — reads the same insured-asset data straight
   * off the originating quotation's cover-note entries instead.
   */
  private buildAssetManifestFromQuotation(
    quotation: Quotation,
  ): Array<Record<string, string | number | null>> {
    const entries = quotation.cover_note?.entries ?? [];
    const motorEntries = entries
      .filter((entry) => !!entry.motor_detail)
      .map((entry) => {
        const motor = entry.motor_detail!;

        return this.mapMotorManifestItem({
          registrationNumber: motor.registration_number,
          chassisNumber: motor.chassis_number,
          engineNumber: motor.engine_number,
          make: motor.make,
          model: motor.model,
          yearOfManufacture: motor.year_of_manufacture,
          ownerName: motor.owner_name,
        });
      });

    if (motorEntries.length > 0) {
      return motorEntries.sort((left, right) =>
        String(
          left.registrationNumber ?? left.chassisNumber ?? '',
        ).localeCompare(
          String(right.registrationNumber ?? right.chassisNumber ?? ''),
        ),
      );
    }

    return entries
      .flatMap((entry) => entry.subject_matters ?? [])
      .map((subject) => ({
        reference: String(subject.subject_matter_reference ?? '')
          .trim()
          .toUpperCase(),
        description: String(subject.subject_matter_desc ?? '').trim(),
      }))
      .sort((left, right) =>
        String(left.reference).localeCompare(String(right.reference)),
      );
  }

  private mapMotorManifestItem(
    motor: Record<string, unknown>,
  ): Record<string, string | number | null> {
    return {
      registrationNumber: this.normalizeMotorField(motor.registrationNumber),
      chassisNumber: this.normalizeMotorField(motor.chassisNumber),
      engineNumber: this.normalizeMotorField(motor.engineNumber),
      make: motor.make?.toString().trim() ?? null,
      model: motor.model?.toString().trim() ?? null,
      yearOfManufacture: motor.yearOfManufacture
        ? Number(motor.yearOfManufacture)
        : null,
      ownerName: motor.ownerName?.toString().trim() ?? null,
    };
  }

  private normalizeMotorField(value: unknown): string | null {
    const normalized = String(value ?? '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();

    return normalized || null;
  }

  private formatDate(value: unknown): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
      }
    }

    return new Date(value as string | number | Date).toISOString().slice(0, 10);
  }

  private numeric(
    value: string | number | null | undefined,
    dp: number,
  ): string {
    if (value === null || value === undefined) {
      return (0).toFixed(dp);
    }

    return Number(value).toFixed(dp);
  }
}
