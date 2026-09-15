import { BadRequestException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { SaveQuotationDraftDto } from '../../quotations/dto/quotation-draft.dto';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { QuotationType } from '../../quotations/enums/quotation-type.enum';
import { QuotationsService } from '../../quotations/quotations.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';

const TIRA_COVER_NOTE_TYPE_ENDORSEMENT = 3;

@Injectable()
export class PolicyTransactionQuotationFactoryService {
  constructor(private readonly quotationsService: QuotationsService) {}

  async createTransactionDraft(
    manager: EntityManager,
    user: AuthenticatedUser,
    params: {
      policy: Policy;
      version: PolicyVersion;
      transaction: PolicyTransaction;
      previousCoverNoteReference: string;
      endorsementType: number;
      endorsementReason: string;
      recordOnly?: boolean;
    },
  ): Promise<Quotation> {
    const snapshot = params.version.policy_snapshot;
    const source = this.asObject(snapshot['source']) ?? {};
    const cover = this.asObject(snapshot['cover']) ?? {};
    const entries = this.asArray(snapshot['entries'])
      .map((value) => this.asObject(value))
      .filter((value): value is Record<string, unknown> => !!value);

    if (!entries.length) {
      throw new BadRequestException(
        'The current policy version does not contain insured risks.',
      );
    }

    const quotationFlow = String(
      source['quotationFlow'] ?? QuotationFlow.NON_MOTOR,
    ) as QuotationFlow;
    const quotationType =
      quotationFlow === QuotationFlow.NON_MOTOR
        ? QuotationType.NON_MOTOR
        : QuotationType.MOTOR;
    const draftPayload = this.buildDraftPayload({
      policy: params.policy,
      transaction: params.transaction,
      quotationFlow,
      entries,
      cover,
      previousCoverNoteReference: params.previousCoverNoteReference,
      endorsementType: params.endorsementType,
      endorsementReason: params.endorsementReason,
      recordOnly: params.recordOnly === true,
    });
    const dto: SaveQuotationDraftDto = {
      insurer_company_id: params.policy.insurer_company_id,
      intermediary_company_id: params.policy.intermediary_company_id,
      department_id: params.policy.department_id,
      customer_id: params.policy.customer_id,
      category_id: params.policy.category_id,
      product_id: params.policy.product_id,
      sub_class_id: params.policy.sub_class_id,
      quotation_type: quotationType,
      quotation_flow: quotationFlow,
      channel_type: params.policy.channel_type,
      is_fleet: quotationFlow === QuotationFlow.MOTOR_FLEET,
      current_wizard_step: 'cover-note',
      draft_payload: draftPayload,
    };

    const quotationId = await this.quotationsService.createDraftInTransaction(
      manager,
      user.companyId!,
      dto,
      user.id,
    );

    // These link columns are populated directly rather than via
    // SaveQuotationDraftDto because they are internal bookkeeping specific
    // to policy-transaction-generated quotations, not something a user
    // ever sets through the ordinary quotation wizard/DTO surface.
    await manager.getRepository(Quotation).update(
      { id: quotationId, company_id: user.companyId! },
      {
        source_policy_transaction_id: params.transaction.id,
        source_policy_id: params.policy.id,
        previous_quotation_id: params.policy.quotation_id ?? null,
      },
    );

    const quotation = await manager.getRepository(Quotation).findOne({
      where: { id: quotationId, company_id: user.companyId! },
    });

    if (!quotation) {
      throw new BadRequestException(
        'Policy transaction quotation could not be created.',
      );
    }

    return quotation;
  }

  private buildDraftPayload(params: {
    policy: Policy;
    transaction: PolicyTransaction;
    quotationFlow: QuotationFlow;
    entries: Record<string, unknown>[];
    cover: Record<string, unknown>;
    previousCoverNoteReference: string;
    endorsementType: number;
    endorsementReason: string;
    recordOnly: boolean;
  }): Record<string, unknown> {
    const firstEntry = params.entries[0];
    const firstMotor = this.asObject(firstEntry['motor']);

    return {
      policyholder_mode: 'existing',
      customer_id: params.policy.customer_id,
      category_id: params.policy.category_id,
      product_id: params.policy.product_id,
      sub_class_id: params.policy.sub_class_id ?? '',
      quotation_flow: params.quotationFlow,
      quotation_type:
        params.quotationFlow === QuotationFlow.NON_MOTOR
          ? QuotationType.NON_MOTOR
          : QuotationType.MOTOR,
      is_fleet: params.quotationFlow === QuotationFlow.MOTOR_FLEET,
      channel_type: params.policy.channel_type,
      currency: params.policy.currency,
      exchange_rate: String(params.cover['exchangeRate'] ?? '1'),
      cover_note_type: String(TIRA_COVER_NOTE_TYPE_ENDORSEMENT),
      prev_cover_note_reference: params.previousCoverNoteReference,
      valid_from: params.transaction.effective_date,
      valid_until: String(params.cover['endDate'] ?? params.policy.end_date),
      cover_note_number: '',
      cover_note_desc: String(firstEntry['coverNoteDescription'] ?? ''),
      operative_clause: String(firstEntry['operativeClause'] ?? ''),
      payment_mode_tira: String(params.cover['paymentMode'] ?? '1'),
      officer_name: String(params.cover['officerName'] ?? ''),
      officer_title: String(params.cover['officerTitle'] ?? ''),
      basic_premium: '',
      total_discount: '',
      total_tax: '',
      total_charges: '',
      total_commission: '',
      total_premium: '',
      net_premium: '',
      rating_version: '',
      sum_insured: this.sumInsured(params.entries),
      risks:
        params.quotationFlow === QuotationFlow.MOTOR_FLEET
          ? []
          : this.mapRisks(firstEntry),
      addons:
        params.quotationFlow === QuotationFlow.MOTOR_FLEET
          ? []
          : this.mapAddons(firstEntry),
      motor_mode: firstMotor ? 'new' : 'existing',
      motor: firstMotor ? this.mapMotor(firstMotor) : {},
      nonMotor: {
        items:
          params.quotationFlow === QuotationFlow.NON_MOTOR
            ? this.mapSubjectMatters(firstEntry)
            : [],
      },
      fleet:
        params.quotationFlow === QuotationFlow.MOTOR_FLEET
          ? this.mapFleet(params.entries, params.previousCoverNoteReference)
          : { header: {}, items: [] },
      endorsement_type: String(params.endorsementType),
      endorsement_reason: params.endorsementReason,
      endorsement_premium_earned: '',
      policy_transaction: {
        record_only: params.recordOnly,
        transaction_id: params.transaction.id,
        transaction_no: params.transaction.transaction_no,
        transaction_type: params.transaction.transaction_type,
        source_policy_id: params.policy.id,
        source_policy_no: params.policy.policy_no,
        source_policy_version_id: params.policy.active_version_id,
        previous_cover_note_reference: params.previousCoverNoteReference,
      },
    };
  }

  private mapRisks(entry: Record<string, unknown>) {
    return this.asArray(entry['risks']).map((risk) => {
      const item = this.asObject(risk) ?? {};
      return {
        risk_id: item['insuranceRiskId'] ?? item['riskId'] ?? item['id'] ?? '',
        sum_insured: String(item['sumInsured'] ?? item['sum_insured'] ?? ''),
        rate: '',
        basic_premium: '',
      };
    });
  }

  private mapAddons(entry: Record<string, unknown>) {
    const pricing = this.asObject(entry['pricing']);
    return this.asArray(pricing?.['addons']).map((addon) => {
      const item = this.asObject(addon) ?? {};
      return {
        addon_id: item['addonId'] ?? item['id'] ?? '',
        amount: '',
        premium_rate: '',
      };
    });
  }

  private mapSubjectMatters(entry: Record<string, unknown>) {
    return this.asArray(entry['subjectMatters']).map((subject) => {
      const item = this.asObject(subject) ?? {};
      return {
        subject_matter_id: item['subjectMatterId'] ?? item['id'] ?? '',
        description: item['description'] ?? '',
        sum_insured: item['sumInsured'] ?? item['sum_insured'] ?? '',
      };
    });
  }

  private mapMotor(motor: Record<string, unknown>) {
    return {
      registration_no:
        motor['registrationNumber'] ?? motor['registration_no'] ?? '',
      chassis_no: motor['chassisNumber'] ?? motor['chassis_no'] ?? '',
      engine_no: motor['engineNumber'] ?? motor['engine_no'] ?? '',
      make: motor['make'] ?? '',
      model: motor['model'] ?? '',
      body_type: motor['bodyType'] ?? '',
      year_of_manufacture: motor['yearOfManufacture'] ?? '',
      seating_capacity: motor['sittingCapacity'] ?? '',
      sum_insured: motor['sumInsured'] ?? '',
    };
  }

  private mapFleet(
    entries: Record<string, unknown>[],
    previousCoverNoteReference: string,
  ) {
    return {
      header: {
        declared_total_vehicles: entries.length,
      },
      items: entries.map((entry, index) => ({
        fleet_entry: String(entry['fleetEntry'] ?? index + 1),
        cover_note_number: '',
        prev_cover_note_reference_number:
          this.resolveEntryPreviousReference(entry) ??
          previousCoverNoteReference,
        cover_note_desc: String(entry['coverNoteDescription'] ?? ''),
        operative_clause: String(entry['operativeClause'] ?? ''),
        risks: this.mapRisks(entry),
        addons: this.mapAddons(entry),
        motor: this.mapMotor(this.asObject(entry['motor']) ?? {}),
        subject_matters: this.mapSubjectMatters(entry),
      })),
    };
  }

  private sumInsured(entries: Record<string, unknown>[]) {
    return entries
      .flatMap((entry) => this.asArray(entry['risks']))
      .map((risk) => this.asObject(risk) ?? {})
      .reduce((total, risk) => total + Number(risk['sumInsured'] ?? 0), 0)
      .toFixed(2);
  }

  private resolveEntryPreviousReference(entry: Record<string, unknown>) {
    const regulatory = this.asObject(entry['regulatory']);
    return (
      regulatory?.['coverNoteReferenceNumber'] ??
      entry['coverNoteReferenceNumber'] ??
      null
    );
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
}
