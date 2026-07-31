import { Injectable } from '@nestjs/common';
import { Quotation } from '../entities/quotation.entity';
import { QuotationStatusHistory } from '../entities/quotation-status-history.entity';
import { QuotationCoverNoteEntry } from '../entities/structured/quotation-cover-note-entry.entity';
import { QuotationEntryAddon } from '../entities/structured/quotation-entry-addon.entity';
import { QuotationEntryAddonTax } from '../entities/structured/quotation-entry-addon-tax.entity';
import { QuotationEntryRisk } from '../entities/structured/quotation-entry-risk.entity';
import { QuotationMotorDetail } from '../entities/structured/quotation-motor-detail.entity';
import { QuotationPolicyHolder } from '../entities/structured/quotation-policy-holder.entity';
import { QuotationRiskDiscount } from '../entities/structured/quotation-risk-discount.entity';
import { QuotationRiskPremiumOverride } from '../entities/structured/quotation-risk-premium-override.entity';
import { QuotationRiskTax } from '../entities/structured/quotation-risk-tax.entity';
import { QuotationSubjectMatter } from '../entities/structured/quotation-subject-matter.entity';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationPremiumOverrideStatus } from '../enums/quotation-premium-override-status.enum';
import { QuotationType } from '../enums/quotation-type.enum';
import { QuotationDisplayStatusResolver } from '../services/quotation-display-status.resolver';
import { PortalTiraSubmission } from '../../tiramis-integration/entities/portal-tira-submission.entity';
import { PortalTiraSubmissionEvent } from '../../tiramis-integration/entities/portal-tira-submission-event.entity';
import { Invoice } from '../../billing-commission/entities/invoice.entity';
import { Receipt } from '../../billing-commission/entities/receipt.entity';
import { PaymentTransaction } from '../../billing-commission/entities/payment-transaction.entity';
import { TiramisSubmissionTrackingEntity } from '../../../tiramis/entities/tiramis-submission-tracking.entity';
import {
  QuotationPreviewAddon,
  QuotationPreviewCoverNote,
  QuotationPreviewDiscount,
  QuotationPreviewFleetHeader,
  QuotationPreviewFleetSummary,
  QuotationPreviewFleetVehicle,
  QuotationPreviewHistoryItem,
  QuotationPreviewMotorDetails,
  QuotationPreviewOverview,
  QuotationPreviewPayment,
  QuotationPreviewPolicyholder,
  QuotationPreviewPremiumSummary,
  QuotationPreviewRef,
  QuotationPreviewResponse,
  QuotationPreviewRisk,
  QuotationPreviewPremiumOverride,
  QuotationPreviewSubjectMatter,
  QuotationPreviewTax,
  QuotationPreviewTiramisSubmission,
} from '../dto/quotation-preview.dto';

type QuotationPreviewRelations = {
  invoice?: Invoice | null;
  receipt?: Receipt | null;
  paymentTransaction?: PaymentTransaction | null;
  portalSubmission?: PortalTiraSubmission | null;
  portalSubmissionEvents?: PortalTiraSubmissionEvent[];
  tiramisTracking?: TiramisSubmissionTrackingEntity | null;
  tiramisTrackingByEntry?: Map<string, TiramisSubmissionTrackingEntity | null>;
};

interface QuotationPreviewOptions {
  includePremiumOverrides?: boolean;
}

@Injectable()
export class QuotationPreviewMapper {
  constructor(
    private readonly quotationDisplayStatusResolver: QuotationDisplayStatusResolver,
  ) {}

  toResponse(
    quotation: Quotation,
    relations: QuotationPreviewRelations = {},
    options: QuotationPreviewOptions = {},
  ): QuotationPreviewResponse {
    const coverNote = quotation.cover_note;

    if (!coverNote) {
      throw new Error(
        `Cover-note information is missing for quotation ${quotation.quotation_no}`,
      );
    }

    const entries = this.sortedEntries(coverNote.entries);
    const isFleet = quotation.quotation_flow === QuotationFlow.MOTOR_FLEET;
    const header = this.buildOverview(quotation);
    const coverNotePreview = this.buildCoverNote(quotation, coverNote);
    const policyholders = this.mapPolicyHolders(quotation.policy_holders);
    const risks = isFleet
      ? []
      : this.mapRisks(entries[0]?.risks ?? [], options.includePremiumOverrides);
    const subjectMatters = isFleet
      ? []
      : this.mapSubjectMatters(entries[0]?.subject_matters ?? []);
    const addons = isFleet ? [] : this.mapAddons(entries[0]?.addons ?? []);
    const motorDetails = this.mapMotorDetail(entries[0]?.motor_detail ?? null);
    const fleet = isFleet
      ? this.buildFleetPreview(
          quotation,
          coverNote,
          entries,
          relations,
          options,
        )
      : null;

    const payment = this.buildPaymentPreview(quotation, relations);
    const tiramis = this.buildTiramisPreview(
      quotation,
      coverNote,
      entries,
      relations,
    );
    const history = this.buildHistoryPreview(
      quotation,
      relations,
      options,
      isFleet ? (fleet?.vehicles ?? []) : undefined,
    );

    return {
      overview: header,
      cover_note: coverNotePreview,
      premium_summary: this.buildPremiumSummary(
        coverNote,
        isFleet ? fleet?.summary : undefined,
      ),
      policyholders,
      risks,
      subject_matters: subjectMatters,
      addons,
      motor_details: isFleet ? null : motorDetails,
      fleet,
      payment,
      tiramis,
      history,
    };
  }

  private buildOverview(quotation: Quotation): QuotationPreviewOverview {
    const display = this.quotationDisplayStatusResolver.resolve(quotation);
    const salesPointCode =
      quotation.cover_note?.sale_point_code ??
      quotation.branch?.sale_point_code ??
      null;
    const salesPointName =
      quotation.branch?.sale_point_name ?? quotation.branch?.name ?? null;

    return {
      quotation_id: quotation.id,
      quotation_no: quotation.quotation_no,
      quotation_type: quotation.quotation_type,
      quotation_flow: quotation.quotation_flow,
      quotation_status: quotation.status,
      approval_status: quotation.approval_status,
      payment_status: quotation.payment_status,
      tira_status: quotation.tira_status,
      display_status: display.displayStatus,
      display_label: display.displayLabel,
      requires_approval: quotation.requires_approval,
      requires_payment: quotation.requires_payment,
      channel_type: quotation.channel_type,
      company: this.ref(quotation.company),
      branch: this.ref(quotation.branch, 'code', 'name'),
      department: this.ref(quotation.department, 'code', 'name'),
      product: this.ref(quotation.product, 'product_code', 'product_name'),
      insurance_category: {
        ...this.ref(quotation.category, 'code', 'name'),
        business_line:
          (quotation.category as { business_line?: string | null } | undefined)
            ?.business_line ?? null,
      },
      subclass: this.ref(quotation.sub_class, 'code', 'name'),
      sales_point: {
        id: salesPointCode,
        code: salesPointCode,
        name: salesPointName,
      },
      created_by: this.userRef(quotation.creator),
      updated_by: this.userRef(quotation.updater),
      submitted_by: this.userRef(quotation.submitter),
      created_at: quotation.created_at.toISOString(),
      updated_at: quotation.updated_at.toISOString(),
      submitted_at: quotation.submitted_at?.toISOString() ?? null,
    };
  }

  private buildCoverNote(
    quotation: Quotation,
    coverNote: Quotation['cover_note'],
  ): QuotationPreviewCoverNote {
    const entry = this.sortedEntries(coverNote.entries)[0] ?? null;
    return {
      cover_note_type: coverNote.cover_note_type ?? null,
      cover_note_number: entry?.cover_note_number ?? null,
      previous_cover_note_reference_number:
        entry?.prev_cover_note_reference_number ?? null,
      cover_note_start_date:
        coverNote.cover_note_start_date?.toISOString() ?? null,
      cover_note_end_date: coverNote.cover_note_end_date?.toISOString() ?? null,
      cover_note_description: entry?.cover_note_desc ?? null,
      operative_clause: entry?.operative_clause ?? null,
      payment_mode: coverNote.payment_mode ?? null,
      currency: coverNote.currency_code ?? null,
      exchange_rate: this.toNumber(coverNote.exchange_rate),
      product_code: coverNote.product_code ?? null,
      authorizing_officer_name: coverNote.officer_name ?? null,
      authorizing_officer_title: coverNote.officer_title ?? null,
      commission_rate: this.toNumber(coverNote.commission_rate),
      commission_paid: this.toNumber(coverNote.commission_paid),
      endorsement_type: entry?.endorsement_type ?? null,
      endorsement_reason: entry?.endorsement_reason ?? null,
      endorsement_premium_earned: this.toNullableNumber(
        entry?.endorsement_premium_earned,
      ),
      fleet_id: coverNote.fleet_id ?? null,
      fleet_type: coverNote.fleet_type ?? null,
      fleet_size: coverNote.fleet_size ?? null,
      comprehensive_insured: coverNote.comprehensive_insured ?? null,
      sale_point_code: coverNote.sale_point_code ?? null,
    };
  }

  private buildPremiumSummary(
    coverNote: Quotation['cover_note'],
    fleetSummary?: QuotationPreviewFleetSummary,
  ): QuotationPreviewPremiumSummary {
    const totalPremiumExcludingTax = this.toNumber(
      coverNote.total_premium_excluding_tax,
    );
    const totalPremiumIncludingTax = this.toNumber(
      coverNote.total_premium_including_tax,
    );

    if (fleetSummary) {
      return {
        total_sum_insured: fleetSummary.total_fleet_sum_insured,
        total_premium_before_discount:
          fleetSummary.total_risk_premium + fleetSummary.total_discounts,
        total_discount_amount: fleetSummary.total_discounts,
        total_premium_after_discount: fleetSummary.total_risk_premium,
        total_premium_excluding_tax: totalPremiumExcludingTax,
        total_tax_amount: fleetSummary.total_taxes,
        total_premium_including_tax: totalPremiumIncludingTax,
        equivalent_premium_excluding_tax: totalPremiumExcludingTax,
        equivalent_premium_including_tax: totalPremiumIncludingTax,
        currency: coverNote.currency_code ?? null,
        exchange_rate: this.toNumber(coverNote.exchange_rate),
      };
    }

    const risks = this.sortedEntries(coverNote.entries).flatMap((entry) =>
      this.mapRisks(entry.risks),
    );
    const addons = this.sortedEntries(coverNote.entries).flatMap((entry) =>
      this.mapAddons(entry.addons),
    );

    const totalSumInsured = risks.reduce(
      (sum, risk) => sum + (risk.sum_insured ?? 0),
      0,
    );
    const totalRiskPremium = risks.reduce(
      (sum, risk) => sum + (risk.premium_after_discount ?? 0),
      0,
    );
    const totalAddonPremium = addons.reduce(
      (sum, addon) => sum + (addon.premium_including_tax ?? 0),
      0,
    );
    const totalTax = [...risks, ...addons].reduce(
      (sum, item) =>
        sum +
        item.taxes.reduce((taxSum, tax) => taxSum + (tax.tax_amount ?? 0), 0),
      0,
    );

    return {
      total_sum_insured: totalSumInsured,
      total_premium_before_discount:
        totalRiskPremium + totalAddonPremium + totalTax,
      total_discount_amount: risks.reduce(
        (sum, risk) =>
          sum +
          risk.discounts.reduce(
            (discountSum, discount) =>
              discountSum + (discount.discount_amount ?? 0),
            0,
          ),
        0,
      ),
      total_premium_after_discount: totalRiskPremium + totalAddonPremium,
      total_premium_excluding_tax: totalPremiumExcludingTax,
      total_tax_amount: totalTax,
      total_premium_including_tax: totalPremiumIncludingTax,
      equivalent_premium_excluding_tax: totalPremiumExcludingTax,
      equivalent_premium_including_tax: totalPremiumIncludingTax,
      currency: coverNote.currency_code ?? null,
      exchange_rate: this.toNumber(coverNote.exchange_rate),
    };
  }

  private buildFleetPreview(
    quotation: Quotation,
    coverNote: Quotation['cover_note'],
    entries: QuotationCoverNoteEntry[],
    relations: QuotationPreviewRelations,
    options: QuotationPreviewOptions,
  ) {
    const vehicles = entries.map((entry) =>
      this.buildFleetVehicle(entry, relations, quotation, options),
    );
    const summary = this.buildFleetSummary(coverNote, vehicles);

    return {
      header: this.buildFleetHeader(quotation, coverNote),
      summary,
      vehicles,
    };
  }

  private buildFleetHeader(
    quotation: Quotation,
    coverNote: Quotation['cover_note'],
  ): QuotationPreviewFleetHeader {
    return {
      fleet_id: coverNote.fleet_id ?? null,
      fleet_type: coverNote.fleet_type ?? null,
      fleet_type_label: this.fleetTypeLabel(coverNote.fleet_type),
      fleet_size: coverNote.fleet_size ?? null,
      comprehensive_insured: coverNote.comprehensive_insured ?? null,
      cover_note_type: coverNote.cover_note_type ?? null,
      sales_point_code: coverNote.sale_point_code ?? null,
      cover_start_date: coverNote.cover_note_start_date?.toISOString() ?? null,
      cover_end_date: coverNote.cover_note_end_date?.toISOString() ?? null,
      payment_mode: coverNote.payment_mode ?? null,
      currency: coverNote.currency_code ?? null,
      exchange_rate: this.toNumber(coverNote.exchange_rate),
      product_code: coverNote.product_code ?? null,
      commission_rate: this.toNumber(coverNote.commission_rate),
      commission_paid: this.toNumber(coverNote.commission_paid),
      authorizing_officer_name: coverNote.officer_name ?? null,
      authorizing_officer_title: coverNote.officer_title ?? null,
      total_premium_excluding_tax: this.toNumber(
        coverNote.total_premium_excluding_tax,
      ),
      total_premium_including_tax: this.toNumber(
        coverNote.total_premium_including_tax,
      ),
      policyholders: this.mapPolicyHolders(quotation.policy_holders),
    };
  }

  private buildFleetSummary(
    coverNote: Quotation['cover_note'],
    vehicles: QuotationPreviewFleetVehicle[],
  ): QuotationPreviewFleetSummary {
    const declaredFleetSize = coverNote.fleet_size ?? null;
    const comprehensiveVehicleCount = vehicles.filter((vehicle) =>
      this.vehicleIsComprehensive(vehicle),
    ).length;
    const thirdPartyVehicleCount = Math.max(
      0,
      vehicles.length - comprehensiveVehicleCount,
    );

    return {
      declared_fleet_size: declaredFleetSize,
      saved_vehicle_count: vehicles.length,
      comprehensive_vehicle_count: comprehensiveVehicleCount,
      third_party_vehicle_count: thirdPartyVehicleCount,
      total_fleet_sum_insured: vehicles.reduce(
        (sum, vehicle) =>
          sum +
          vehicle.risks.reduce(
            (riskSum, risk) => riskSum + (risk.sum_insured ?? 0),
            0,
          ),
        0,
      ),
      total_risk_premium: vehicles.reduce(
        (sum, vehicle) =>
          sum +
          vehicle.risks.reduce(
            (riskSum, risk) => riskSum + (risk.premium_including_tax ?? 0),
            0,
          ),
        0,
      ),
      total_addon_premium: vehicles.reduce(
        (sum, vehicle) =>
          sum +
          vehicle.addons.reduce(
            (addonSum, addon) => addonSum + (addon.premium_including_tax ?? 0),
            0,
          ),
        0,
      ),
      total_discounts: vehicles.reduce(
        (sum, vehicle) =>
          sum +
          vehicle.risks.reduce(
            (riskSum, risk) =>
              riskSum +
              risk.discounts.reduce(
                (discountSum, discount) =>
                  discountSum + (discount.discount_amount ?? 0),
                0,
              ),
            0,
          ),
        0,
      ),
      total_taxes: vehicles.reduce(
        (sum, vehicle) =>
          sum +
          [...vehicle.risks, ...vehicle.addons].reduce(
            (taxableSum, item) =>
              taxableSum +
              item.taxes.reduce(
                (taxSum, tax) => taxSum + (tax.tax_amount ?? 0),
                0,
              ),
            0,
          ),
        0,
      ),
      total_premium_excluding_tax:
        this.toNumber(coverNote.total_premium_excluding_tax) ?? 0,
      total_premium_including_tax:
        this.toNumber(coverNote.total_premium_including_tax) ?? 0,
      successful_entries: vehicles.filter((vehicle) =>
        this.tiramisStatus(vehicle.tiramis)?.includes('SUCCESS'),
      ).length,
      failed_entries: vehicles.filter((vehicle) =>
        this.tiramisStatus(vehicle.tiramis)?.includes('FAILED'),
      ).length,
      pending_entries: vehicles.filter(
        (vehicle) =>
          !vehicle.tiramis || this.tiramisStatus(vehicle.tiramis) === 'PENDING',
      ).length,
    };
  }

  private buildFleetVehicle(
    entry: QuotationCoverNoteEntry,
    relations: QuotationPreviewRelations,
    quotation: Quotation,
    options: QuotationPreviewOptions,
  ): QuotationPreviewFleetVehicle {
    const tracking =
      relations.tiramisTrackingByEntry?.get(entry.cover_note_number) ??
      relations.tiramisTracking ??
      null;

    return {
      fleet_entry_number: entry.fleet_entry ?? entry.entry_number ?? null,
      cover_note_number: entry.cover_note_number ?? null,
      previous_cover_note_reference_number:
        entry.prev_cover_note_reference_number ?? null,
      cover_note_description: entry.cover_note_desc ?? null,
      operative_clause: entry.operative_clause ?? null,
      endorsement_type: entry.endorsement_type ?? null,
      endorsement_reason: entry.endorsement_reason ?? null,
      endorsement_premium_earned: this.toNullableNumber(
        entry.endorsement_premium_earned,
      ),
      risks: this.mapRisks(entry.risks, options.includePremiumOverrides),
      subject_matters: this.mapSubjectMatters(entry.subject_matters),
      addons: this.mapAddons(entry.addons),
      motor_details: this.mapMotorDetail(entry.motor_detail),
      tiramis: this.mapTiramisSubmission(
        quotation,
        entry.cover_note_number,
        tracking,
      ),
    };
  }

  private buildPaymentPreview(
    quotation: Quotation,
    relations: QuotationPreviewRelations,
  ): QuotationPreviewPayment | null {
    const invoice = relations.invoice ?? null;
    const receipt = relations.receipt ?? null;
    const paymentTransaction = relations.paymentTransaction ?? null;

    if (!invoice && !receipt && !paymentTransaction) {
      return null;
    }

    return {
      quotation_payment_status: quotation.payment_status,
      payment_status: this.text(
        invoice?.status ?? receipt?.status ?? paymentTransaction?.status,
      ),
      payment_method: this.text(receipt?.payment_method),
      payment_reference: this.text(
        receipt?.payment_reference ?? paymentTransaction?.provider_reference,
      ),
      receipt_number: this.text(receipt?.receipt_no),
      amount_paid: this.toNumber(receipt?.amount ?? invoice?.paid_amount),
      payment_date:
        receipt?.received_at?.toISOString() ??
        paymentTransaction?.created_at?.toISOString() ??
        invoice?.updated_at?.toISOString() ??
        null,
      currency: this.text(receipt?.currency ?? invoice?.currency),
      outstanding_amount: this.toNumber(invoice?.balance_amount),
      verification_status: this.text(
        paymentTransaction?.status ?? receipt?.status,
      ),
      invoice_number: this.text(invoice?.invoice_no),
    };
  }

  private buildTiramisPreview(
    quotation: Quotation,
    coverNote: Quotation['cover_note'],
    entries: QuotationCoverNoteEntry[],
    relations: QuotationPreviewRelations,
  ): QuotationPreviewTiramisSubmission | null {
    const submission = relations.portalSubmission ?? null;
    const tracking = relations.tiramisTracking ?? null;

    if (!submission && !tracking) {
      return null;
    }

    const eventHistory = relations.portalSubmissionEvents ?? [];
    const acknowledgementEvent = eventHistory.find(
      (event) =>
        event.event_type === 'TIRAMIS_ACK_RECEIVED' ||
        event.event_type === 'TIRAMIS_ACK_FAILED',
    );
    const callbackEvent = eventHistory.find(
      (event) =>
        event.event_type === 'TIRAMIS_FINAL_RESPONSE_RECEIVED' ||
        event.event_type === 'TIRAMIS_FINAL_SUCCESS' ||
        event.event_type === 'TIRAMIS_FINAL_FAILED' ||
        event.event_type === 'TIRAMIS_CALLBACK_REJECTED',
    );

    return {
      source: this.determineTiramisSource(quotation),
      submission_status: this.text(submission?.status ?? tracking?.status),
      request_id: this.text(
        submission?.tiramis_request_id ?? tracking?.tiramisRequestId,
      ),
      submission_attempt_number: this.toNumber(
        tracking?.syncAttempts ??
          tracking?.retryAttempts ??
          (submission ? 1 : null),
      ),
      date_submitted:
        submission?.submitted_at?.toISOString() ??
        tracking?.submittedAt?.toISOString() ??
        null,
      submitted_by: this.userLabel(quotation.submitter),
      tiramis_environment: this.text(
        submission?.service_type ?? tracking?.tiramisServiceType,
      ),
      last_submission_error: this.text(
        submission?.last_error ?? tracking?.lastErrorMessage,
      ),
      next_retry_time: tracking?.nextRetryAt?.toISOString() ?? null,
      acknowledgement_id: this.text(
        submission?.tiramis_request_id ?? tracking?.tiramisRequestId,
      ),
      acknowledgement_status_code: this.text(
        submission?.status_code ?? tracking?.acknowledgementStatusCode,
      ),
      acknowledgement_status_description: this.text(
        submission?.status_description ?? tracking?.acknowledgementStatusDesc,
      ),
      acknowledgement_received_date:
        acknowledgementEvent?.created_at?.toISOString() ??
        tracking?.acknowledgedAt?.toISOString() ??
        null,
      callback_received_status: this.text(
        callbackEvent?.status_description ?? tracking?.finalResponseStatusDesc,
      ),
      callback_received_date:
        callbackEvent?.created_at?.toISOString() ??
        tracking?.finalResponseReceivedAt?.toISOString() ??
        null,
      response_id: this.text(
        callbackEvent?.response_id ??
          submission?.tiramis_response_id ??
          tracking?.finalResponseId,
      ),
      response_status_code: this.text(
        callbackEvent?.status_code ?? tracking?.finalResponseStatusCode,
      ),
      response_status_description: this.text(
        callbackEvent?.status_description ?? tracking?.finalResponseStatusDesc,
      ),
      cover_note_reference_number: this.text(
        submission?.cover_note_reference_number ??
          tracking?.tiramisResponsePayload?.coverNoteReferenceNumber ??
          entries[0]?.cover_note_number ??
          coverNote.fleet_id ??
          quotation.quotation_no,
      ),
      sticker_number: this.text(
        submission?.sticker_number ??
          tracking?.tiramisResponsePayload?.stickerNumber,
      ),
    };
  }

  private buildHistoryPreview(
    quotation: Quotation,
    relations: QuotationPreviewRelations,
    options: QuotationPreviewOptions,
    fleetVehicles?: QuotationPreviewFleetVehicle[],
  ): QuotationPreviewHistoryItem[] {
    const history: QuotationPreviewHistoryItem[] = [];

    history.push({
      action: 'Quotation created',
      previous_status: null,
      new_status: quotation.status,
      performed_by: this.userLabel(quotation.creator),
      date_time: quotation.created_at.toISOString(),
      remarks: null,
    });

    if (quotation.updated_at) {
      history.push({
        action: 'Quotation updated',
        previous_status: null,
        new_status: quotation.status,
        performed_by: this.userLabel(quotation.updater),
        date_time: quotation.updated_at.toISOString(),
        remarks: null,
      });
    }

    if (quotation.submitted_at) {
      history.push({
        action: 'Quotation submitted',
        previous_status: quotation.status,
        new_status: quotation.status,
        performed_by: this.userLabel(quotation.submitter),
        date_time: quotation.submitted_at.toISOString(),
        remarks: null,
      });
    }

    for (const statusHistory of quotation.status_history ?? []) {
      history.push({
        action: this.statusActionLabel(statusHistory.new_status ?? 'UNKNOWN'),
        previous_status: statusHistory.old_status ?? null,
        new_status: statusHistory.new_status ?? null,
        performed_by: this.userLabel(statusHistory.changer),
        date_time: statusHistory.created_at.toISOString(),
        remarks: statusHistory.reason ?? null,
      });
    }

    const submissionEvents = relations.portalSubmissionEvents ?? [];
    for (const event of submissionEvents) {
      history.push({
        action: this.portalEventAction(event.event_type),
        previous_status: null,
        new_status: event.status_code ?? null,
        performed_by: null,
        date_time: event.created_at.toISOString(),
        remarks: event.status_description ?? event.error_message ?? null,
      });
    }

    if (relations.paymentTransaction || relations.receipt) {
      history.push({
        action: 'Payment confirmed',
        previous_status: null,
        new_status:
          relations.receipt?.status ??
          relations.paymentTransaction?.status ??
          null,
        performed_by: null,
        date_time:
          relations.receipt?.received_at?.toISOString() ??
          relations.paymentTransaction?.created_at?.toISOString() ??
          null,
        remarks:
          relations.receipt?.payment_reference ??
          relations.paymentTransaction?.provider_reference ??
          null,
      });
    }

    if (options.includePremiumOverrides) {
      for (const entry of quotation.cover_note?.entries ?? []) {
        for (const risk of entry.risks ?? []) {
          for (const premiumOverride of this.sortedBySequence(
            risk.premium_overrides,
          )) {
            history.push({
              action: `Premium override requested for ${risk.risk_code}`,
              previous_status: null,
              new_status: premiumOverride.approval_status,
              performed_by: this.userLabel(premiumOverride.requester),
              date_time: premiumOverride.requested_at?.toISOString() ?? null,
              remarks: this.premiumOverrideRequestRemarks(premiumOverride),
            });

            if (
              premiumOverride.approval_status ===
                QuotationPremiumOverrideStatus.APPROVED &&
              premiumOverride.approved_at
            ) {
              history.push({
                action: `Premium override approved for ${risk.risk_code}`,
                previous_status: QuotationPremiumOverrideStatus.PENDING,
                new_status: premiumOverride.approval_status,
                performed_by: this.userLabel(premiumOverride.approver),
                date_time: premiumOverride.approved_at.toISOString(),
                remarks: this.premiumOverrideApprovalRemarks(premiumOverride),
              });
            }

            if (
              premiumOverride.approval_status ===
                QuotationPremiumOverrideStatus.REJECTED &&
              premiumOverride.approved_at
            ) {
              history.push({
                action: `Premium override rejected for ${risk.risk_code}`,
                previous_status: QuotationPremiumOverrideStatus.PENDING,
                new_status: premiumOverride.approval_status,
                performed_by: this.userLabel(premiumOverride.approver),
                date_time: premiumOverride.approved_at.toISOString(),
                remarks: premiumOverride.rejection_reason ?? null,
              });
            }
          }
        }
      }
    }

    if (fleetVehicles) {
      for (const vehicle of fleetVehicles) {
        if (vehicle.tiramis) {
          history.push({
            action: `Fleet vehicle ${vehicle.fleet_entry_number ?? ''} TIRAMIS result`,
            previous_status: null,
            new_status: vehicle.tiramis.submission_status,
            performed_by: null,
            date_time:
              vehicle.tiramis.callback_received_date ??
              vehicle.tiramis.acknowledgement_received_date,
            remarks: vehicle.tiramis.last_submission_error,
          });
        }
      }
    }

    return history
      .filter((item) => item.date_time)
      .sort((left, right) =>
        String(right.date_time).localeCompare(String(left.date_time)),
      );
  }

  private mapPolicyHolders(
    policyHolders: QuotationPolicyHolder[] | undefined,
  ): QuotationPreviewPolicyholder[] {
    return this.sortedBySequence(policyHolders).map((holder) => ({
      policyholder_type: this.policyholderTypeLabel(holder.policy_holder_type),
      full_name: holder.policy_holder_name,
      date_of_birth: holder.policy_holder_birth_date ?? null,
      identification_type: this.policyholderIdTypeLabel(
        holder.policy_holder_id_type,
      ),
      identification_number: holder.policy_holder_id_number,
      gender: this.genderLabel(holder.gender),
      country: holder.country_code,
      region: holder.region,
      district: holder.district,
      street: holder.street,
      phone_number: holder.policy_holder_phone_number,
      fax_number: holder.policy_holder_fax,
      postal_address: holder.postal_address,
      email_address: holder.email_address,
    }));
  }

  private mapRisks(
    risks: QuotationEntryRisk[] | undefined,
    includePremiumOverrides = false,
  ): QuotationPreviewRisk[] {
    return this.sortedBySequence(risks).map((risk, index) => ({
      risk_id: risk.id,
      risk_number: risk.sequence_no ?? index + 1,
      risk_code: risk.risk_code ?? null,
      risk_name:
        risk.insurance_risk?.risk_name ??
        risk.insurance_risk?.risk_code ??
        null,
      sum_insured: this.toNumber(risk.sum_insured),
      sum_insured_equivalent: this.toNumber(risk.sum_insured_equivalent),
      premium_rate: this.toNumber(risk.premium_rate),
      premium_before_discount: this.toNumber(risk.premium_before_discount),
      premium_after_discount: this.toNumber(risk.premium_after_discount),
      premium_excluding_tax_equivalent: this.toNumber(
        risk.premium_excluding_tax_equivalent,
      ),
      premium_including_tax: this.toNumber(risk.premium_including_tax),
      discounts: this.mapDiscounts(risk.discounts),
      premium_overrides: includePremiumOverrides
        ? this.mapPremiumOverrides(risk.premium_overrides)
        : [],
      taxes: this.mapRiskTaxes(risk.taxes),
    }));
  }

  private mapPremiumOverrides(
    overrides: QuotationRiskPremiumOverride[] | undefined,
  ): QuotationPreviewPremiumOverride[] {
    return [...(overrides ?? [])]
      .sort((left, right) => right.sequence_no - left.sequence_no)
      .map((premiumOverride) => ({
        id: premiumOverride.id,
        sequence_no: premiumOverride.sequence_no ?? null,
        original_calculated_premium: this.toNumber(
          premiumOverride.original_calculated_premium,
        ),
        proposed_premium: this.toNumber(premiumOverride.proposed_premium),
        difference_amount: this.toNumber(premiumOverride.difference_amount),
        difference_percentage: this.toNumber(
          premiumOverride.difference_percentage,
        ),
        override_reason: premiumOverride.override_reason ?? null,
        supporting_notes: premiumOverride.supporting_notes ?? null,
        requested_by: this.userRef(premiumOverride.requester),
        requested_at: premiumOverride.requested_at?.toISOString() ?? null,
        approval_status: premiumOverride.approval_status,
        approved_by: this.userRef(premiumOverride.approver),
        approved_at: premiumOverride.approved_at?.toISOString() ?? null,
        rejection_reason: premiumOverride.rejection_reason ?? null,
      }));
  }

  private mapDiscounts(
    discounts: QuotationRiskDiscount[] | undefined,
  ): QuotationPreviewDiscount[] {
    return this.sortedBySequence(discounts).map((discount) => ({
      discount_type: discount.discount_type,
      discount_label: this.discountLabel(discount.discount_type),
      discount_rate: this.toNumber(discount.discount_rate),
      discount_amount: this.toNumber(discount.discount_amount),
    }));
  }

  private mapRiskTaxes(
    taxes: QuotationRiskTax[] | undefined,
  ): QuotationPreviewTax[] {
    return this.sortedBySequence(taxes).map((tax) => ({
      tax_code: tax.tax_code,
      tax_name: this.taxName(tax.tax_code),
      tax_rate: this.toNumber(tax.tax_rate),
      tax_amount: this.toNumber(tax.tax_amount),
      is_tax_exempted: tax.is_tax_exempted === 'Y',
      tax_exemption_type: tax.tax_exemption_type,
      tax_exemption_reference: tax.tax_exemption_reference,
    }));
  }

  private mapSubjectMatters(
    subjects: QuotationSubjectMatter[] | undefined,
  ): QuotationPreviewSubjectMatter[] {
    return this.sortedBySequence(subjects).map((subject) => ({
      subject_matter_reference: subject.subject_matter_reference ?? null,
      subject_matter_description: subject.subject_matter_desc ?? null,
      related_risk_code: null,
    }));
  }

  private mapAddons(
    addons: QuotationEntryAddon[] | undefined,
  ): QuotationPreviewAddon[] {
    return this.sortedBySequence(addons).map((addon) => ({
      addon_reference: addon.addon_reference ?? null,
      addon_description: addon.addon_desc ?? null,
      insured_amount: this.toNumber(addon.addon_amount),
      premium_rate: this.toNumber(addon.addon_premium_rate),
      premium_excluding_tax: this.toNumber(addon.premium_excluding_tax),
      premium_excluding_tax_equivalent: this.toNumber(
        addon.premium_excluding_tax_equivalent,
      ),
      premium_including_tax: this.toNumber(addon.premium_including_tax),
      taxes: this.mapAddonTaxes(addon.taxes),
    }));
  }

  private mapAddonTaxes(
    taxes: QuotationEntryAddonTax[] | undefined,
  ): QuotationPreviewTax[] {
    return this.sortedBySequence(taxes).map((tax) => ({
      tax_code: tax.tax_code,
      tax_name: this.taxName(tax.tax_code),
      tax_rate: this.toNumber(tax.tax_rate),
      tax_amount: this.toNumber(tax.tax_amount),
      is_tax_exempted: tax.is_tax_exempted === 'Y',
      tax_exemption_type: tax.tax_exemption_type,
      tax_exemption_reference: tax.tax_exemption_reference,
    }));
  }

  private mapMotorDetail(
    motor: QuotationMotorDetail | null | undefined,
  ): QuotationPreviewMotorDetails | null {
    if (!motor) {
      return null;
    }

    return {
      motor_category: this.motorCategoryLabel(motor.motor_category),
      motor_type: this.motorTypeLabel(motor.motor_type),
      registration_number: motor.registration_number ?? null,
      chassis_number: motor.chassis_number ?? null,
      make: motor.make ?? null,
      model: motor.model ?? null,
      model_number: motor.model_number ?? null,
      body_type: motor.body_type ?? null,
      colour: motor.color ?? null,
      engine_number: motor.engine_number ?? null,
      engine_capacity: motor.engine_capacity ?? null,
      fuel_used: motor.fuel_used ?? null,
      number_of_axles: motor.number_of_axles ?? null,
      axle_distance: this.toNumber(motor.axle_distance),
      seating_capacity: motor.sitting_capacity ?? null,
      year_of_manufacture: motor.year_of_manufacture ?? null,
      tare_weight: this.toNumber(motor.tare_weight),
      gross_weight: this.toNumber(motor.gross_weight),
      motor_usage: this.motorUsageLabel(motor.motor_usage),
      owner_name: motor.owner_name ?? null,
      owner_category: this.ownerCategoryLabel(motor.owner_category),
      owner_address: motor.owner_address ?? null,
    };
  }

  private mapTiramisSubmission(
    quotation: Quotation,
    businessReference: string | null,
    tracking: TiramisSubmissionTrackingEntity | null,
  ): QuotationPreviewTiramisSubmission | null {
    if (!tracking && !quotation.submitted_at) {
      return null;
    }

    return {
      source:
        quotation.quotation_flow === QuotationFlow.MOTOR_FLEET
          ? 'fleet'
          : 'quotation',
      submission_status: this.text(tracking?.status),
      request_id: this.text(tracking?.tiramisRequestId),
      submission_attempt_number: this.toNumber(
        tracking?.syncAttempts ?? tracking?.retryAttempts,
      ),
      date_submitted:
        tracking?.submittedAt?.toISOString() ??
        quotation.submitted_at?.toISOString() ??
        null,
      submitted_by: this.userLabel(quotation.submitter),
      tiramis_environment: this.text(tracking?.tiramisServiceType),
      last_submission_error: this.text(
        tracking?.lastErrorMessage ?? tracking?.retryErrorMessage,
      ),
      next_retry_time: tracking?.nextRetryAt?.toISOString() ?? null,
      acknowledgement_id: this.text(tracking?.tiramisRequestId),
      acknowledgement_status_code: this.text(
        tracking?.acknowledgementStatusCode,
      ),
      acknowledgement_status_description: this.text(
        tracking?.acknowledgementStatusDesc,
      ),
      acknowledgement_received_date:
        tracking?.acknowledgedAt?.toISOString() ?? null,
      callback_received_status: this.text(tracking?.finalResponseStatusDesc),
      callback_received_date:
        tracking?.finalResponseReceivedAt?.toISOString() ?? null,
      response_id: this.text(tracking?.finalResponseId),
      response_status_code: this.text(tracking?.finalResponseStatusCode),
      response_status_description: this.text(tracking?.finalResponseStatusDesc),
      cover_note_reference_number: this.text(
        tracking?.businessReference ?? businessReference,
      ),
      sticker_number: this.text(
        tracking?.finalResponsePayload &&
          typeof tracking.finalResponsePayload === 'object'
          ? (tracking.finalResponsePayload as Record<string, unknown>)
              .stickerNumber
          : undefined,
      ),
    };
  }

  private ref(
    entity:
      | {
          id?: string | null;
          code?: string | null;
          name?: string | null;
          description?: string | null;
        }
      | null
      | undefined,
    codeKey: string = 'code',
    nameKey: string = 'name',
  ): QuotationPreviewRef {
    if (!entity) {
      return { id: null, code: null, name: null, description: null };
    }

    return {
      id: entity.id ?? null,
      code: (entity as Record<string, string | null>)[codeKey] ?? null,
      name: (entity as Record<string, string | null>)[nameKey] ?? null,
      description: entity.description ?? null,
    };
  }

  private userRef(
    user:
      | {
          id?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          user_no?: string | null;
        }
      | null
      | undefined,
  ): QuotationPreviewRef {
    if (!user) {
      return { id: null, code: null, name: null, description: null };
    }

    return {
      id: user.id ?? null,
      code: user.user_no ?? null,
      name:
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.email ||
        null,
      description: user.email ?? null,
    };
  }

  private userLabel(
    user:
      | {
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          user_no?: string | null;
        }
      | null
      | undefined,
  ) {
    if (!user) {
      return null;
    }

    return (
      [user.first_name, user.last_name].filter(Boolean).join(' ') ||
      user.email ||
      user.user_no ||
      null
    );
  }

  private statusActionLabel(status: string) {
    switch (status) {
      case 'SUBMITTED_TO_TIRA':
        return 'Quotation submitted to TIRAMIS';
      case 'PENDING_REQUIREMENTS':
        return 'Quotation pending requirements';
      case 'READY_FOR_SUBMISSION':
        return 'Quotation ready for TIRAMIS submission';
      case 'SUBMITTING_TO_TIRA':
        return 'Submitting quotation to TIRAMIS';
      case 'TIRA_PROCESSING':
        return 'Processing at TIRAMIS';
      case 'COMPLETED':
        return 'TIRAMIS submission completed';
      case 'FAILED':
        return 'TIRAMIS submission failed';
      case 'REJECTED':
        return 'Quotation rejected';
      case 'CANCELLED':
        return 'Quotation cancelled';
      default:
        return `Quotation status changed to ${status}`;
    }
  }

  private portalEventAction(eventType: string) {
    switch (eventType) {
      case 'PORTAL_SUBMITTED_TO_TIRAMIS':
        return 'Sent to TIRAMIS';
      case 'TIRAMIS_ACK_RECEIVED':
        return 'Acknowledgement received';
      case 'TIRAMIS_FINAL_RESPONSE_RECEIVED':
      case 'TIRAMIS_FINAL_SUCCESS':
      case 'TIRAMIS_FINAL_FAILED':
        return 'Callback received';
      case 'TIRAMIS_CALLBACK_REJECTED':
        return 'Callback rejected';
      default:
        return eventType.replace(/_/g, ' ');
    }
  }

  private premiumOverrideRequestRemarks(
    premiumOverride: QuotationRiskPremiumOverride,
  ) {
    const note = premiumOverride.supporting_notes?.trim();
    const diffAmount = this.toNumber(premiumOverride.difference_amount);
    const diffPercentage = this.toNumber(premiumOverride.difference_percentage);
    const parts = [
      premiumOverride.override_reason,
      diffAmount !== null ? `Delta ${diffAmount.toFixed(2)}` : null,
      diffPercentage !== null ? `(${diffPercentage.toFixed(2)}%)` : null,
      note || null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' | ') : null;
  }

  private premiumOverrideApprovalRemarks(
    premiumOverride: QuotationRiskPremiumOverride,
  ) {
    return premiumOverride.supporting_notes?.trim() || null;
  }

  private fleetTypeLabel(value: number | null | undefined) {
    switch (value) {
      case 1:
        return 'New Fleet';
      case 2:
        return 'Fleet Addition';
      default:
        return value == null ? null : `Fleet Type ${value}`;
    }
  }

  private policyholderTypeLabel(value: number | null | undefined) {
    switch (value) {
      case 1:
        return 'Individual';
      case 2:
        return 'Corporate';
      default:
        return value == null ? null : `Type ${value}`;
    }
  }

  private policyholderIdTypeLabel(value: number | null | undefined) {
    switch (value) {
      case 1:
        return 'National ID';
      case 2:
        return 'Passport';
      case 3:
        return 'TIN';
      case 4:
        return 'Driving Licence';
      default:
        return value == null ? null : `ID Type ${value}`;
    }
  }

  private genderLabel(value: string | null | undefined) {
    if (!value) return null;
    if (value === 'M') return 'Male';
    if (value === 'F') return 'Female';
    return value;
  }

  private motorCategoryLabel(value: number | null | undefined) {
    switch (value) {
      case 1:
        return 'Private';
      case 2:
        return 'Commercial';
      default:
        return value == null ? null : `Category ${value}`;
    }
  }

  private motorTypeLabel(value: number | null | undefined) {
    switch (value) {
      case 1:
        return 'Registered';
      case 2:
        return 'Unregistered';
      default:
        return value == null ? null : `Type ${value}`;
    }
  }

  private motorUsageLabel(value: number | null | undefined) {
    switch (value) {
      case 1:
        return 'Private';
      case 2:
        return 'Commercial';
      default:
        return value == null ? null : `Usage ${value}`;
    }
  }

  private ownerCategoryLabel(value: number | null | undefined) {
    switch (value) {
      case 1:
        return 'Individual';
      case 2:
        return 'Corporate';
      default:
        return value == null ? null : `Category ${value}`;
    }
  }

  private discountLabel(value: number | null | undefined) {
    if (value == null) return null;
    switch (value) {
      case 1:
        return 'Discount';
      case 2:
        return 'Special Discount';
      default:
        return `Discount ${value}`;
    }
  }

  private taxName(code: string | null | undefined) {
    if (!code) return null;
    const normalized = code.toUpperCase();
    const names: Record<string, string> = {
      VAT: 'Value Added Tax',
      WHT: 'Withholding Tax',
      VAT_ML: 'VAT Mainland',
      VAT_ZN: 'VAT Zanzibar',
    };
    return names[normalized] ?? normalized;
  }

  private determineTiramisSource(quotation: Quotation) {
    if (quotation.quotation_flow === QuotationFlow.MOTOR_FLEET) {
      return 'fleet';
    }
    return quotation.quotation_type === QuotationType.MOTOR
      ? 'quotation'
      : 'quotation';
  }

  private vehicleIsComprehensive(vehicle: QuotationPreviewFleetVehicle) {
    const status = this.tiramisStatus(vehicle.tiramis);
    return !status || !status.includes('THIRD');
  }

  private tiramisStatus(submission: QuotationPreviewTiramisSubmission | null) {
    return submission?.submission_status?.toUpperCase() ?? 'PENDING';
  }

  private sortedEntries(entries: QuotationCoverNoteEntry[] | undefined) {
    return [...(entries ?? [])].sort(
      (left, right) => left.entry_number - right.entry_number,
    );
  }

  private sortedBySequence<T extends { sequence_no: number }>(
    values: T[] | undefined,
  ): T[] {
    return [...(values ?? [])].sort(
      (left, right) => left.sequence_no - right.sequence_no,
    );
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNullableNumber(value: unknown): number | null {
    return this.toNumber(value);
  }

  private text(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text ? text : null;
  }
}
