import { BadRequestException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PolicyTransactionType } from '@insurance-max/contracts';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { Customer } from '../../customers/entities/customer.entity';
import { CustomerVersion } from '../../customers/entities/customer-version.entity';
import { CustomerPolicyHolderType } from '../../customers/enums/customer-policy-holder-type.enum';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationCoverNote } from '../../quotations/entities/structured/quotation-cover-note.entity';
import { QuotationPolicyHolder } from '../../quotations/entities/structured/quotation-policy-holder.entity';
import { QuotationsService } from '../../quotations/quotations.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionContextService } from './policy-transaction-context.service';

@Injectable()
export class PolicyTransactionQuotationFactoryService {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly contextService: PolicyTransactionContextService,
  ) {}

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
    const context = this.contextService.buildDraftContext({
      policy: params.policy,
      version: params.version,
      transaction: params.transaction,
      type:
        params.transaction.transaction_type ===
        PolicyTransactionType.CANCELLATION
          ? 'CANCELLATION'
          : 'ENDORSEMENT',
      effectiveDate: params.transaction.effective_date,
      endDate: String(
        (params.transaction.proposed_policy_snapshot ??
          params.version.policy_snapshot)?.['endDate'] ??
          params.policy.end_date,
      ),
      previousCoverNoteReference: params.previousCoverNoteReference,
      endorsementType: params.endorsementType,
      endorsementReason: params.endorsementReason,
      recordOnly: params.recordOnly === true,
    });

    const quotationId = await this.quotationsService.createDraftInTransaction(
      manager,
      user.companyId!,
      context.dto,
      user.id,
      context.branchContext,
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

    // Transaction quotations never pass through the full quotation save, so
    // the draft placeholder has no policyholders and zero premiums. Carry the
    // policy's holders and the transaction's premium delta across so the
    // quotation lists and previews show the real customer and amount.
    await this.persistPolicyHolders(
      manager,
      quotationId,
      params.policy,
      context.dto.draft_payload,
    );
    await this.persistPremiumTotals(manager, quotationId, params.transaction);

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

  private async persistPolicyHolders(
    manager: EntityManager,
    quotationId: string,
    policy: Policy,
    draftPayload: Record<string, unknown>,
  ) {
    const repository = manager.getRepository(QuotationPolicyHolder);
    if (await repository.exists({ where: { quotation_id: quotationId } })) {
      return;
    }

    const snapshotHolders = this.asArray(draftPayload['policy_holders'])
      .map((value) => this.asObject(value))
      .filter((value): value is Record<string, unknown> => !!value);
    const primarySnapshot = this.asObject(
      draftPayload['policyholder_snapshot'],
    );
    const holders =
      snapshotHolders.length > 0
        ? snapshotHolders
        : primarySnapshot
          ? [primarySnapshot]
          : [{}];
    const [customer, customerVersion] = policy.customer_id
      ? await Promise.all([
          manager.getRepository(Customer).findOne({
            where: { id: policy.customer_id, company_id: policy.company_id },
          }),
          manager.getRepository(CustomerVersion).findOne({
            where: { customer_id: policy.customer_id, is_current_version: true },
            order: { version_number: 'DESC' },
          }),
        ])
      : [null, null];

    const entities = holders
      .map((holder, index) => {
        // Only the primary holder is linked to (and backfilled from) the
        // policy's customer; joint holders rely on their own snapshot.
        const fallback = index === 0 ? customer : null;
        const name =
          this.text(holder['name']) ??
          this.text(holder['policyHolderName']) ??
          this.text(fallback?.display_name);
        if (!name) {
          return null;
        }

        return repository.create({
          quotation_id: quotationId,
          customer_id: index === 0 ? policy.customer_id : null,
          customer_version_id:
            index === 0 ? (customerVersion?.id ?? null) : null,
          sequence_no: index + 1,
          policy_holder_name: name,
          policy_holder_birth_date:
            this.text(holder['birthDate']) ??
            this.text(fallback?.date_of_birth) ??
            '1900-01-01',
          policy_holder_type:
            this.integer(holder['type']) ??
            fallback?.policy_holder_type ??
            CustomerPolicyHolderType.INDIVIDUAL,
          policy_holder_id_number:
            this.text(holder['idNumber']) ??
            this.text(fallback?.id_number) ??
            '',
          policy_holder_id_type:
            this.integer(holder['idType']) ?? fallback?.id_type ?? 1,
          gender: this.text(holder['gender']) ?? fallback?.gender ?? null,
          country_code:
            this.text(holder['countryCode']) ??
            this.text(fallback?.country_code) ??
            'TZA',
          region:
            this.text(holder['region']) ?? this.text(fallback?.region) ?? '',
          district:
            this.text(holder['district']) ??
            this.text(fallback?.district) ??
            '',
          street:
            this.text(holder['street']) ?? this.text(fallback?.street) ?? null,
          policy_holder_phone_number:
            this.text(holder['phone']) ?? this.text(fallback?.phone) ?? '',
          policy_holder_fax:
            this.text(holder['fax']) ?? this.text(fallback?.fax) ?? null,
          postal_address:
            this.text(holder['postalAddress']) ??
            this.text(fallback?.postal_address) ??
            null,
          email_address:
            this.text(holder['email']) ?? this.text(fallback?.email) ?? null,
        });
      })
      .filter((entity): entity is QuotationPolicyHolder => !!entity);

    if (entities.length > 0) {
      await repository.save(entities);
    }
  }

  private async persistPremiumTotals(
    manager: EntityManager,
    quotationId: string,
    transaction: PolicyTransaction,
  ) {
    const premium = DecimalUtil.value(transaction.net_premium_difference ?? 0);
    const tax = DecimalUtil.value(transaction.tax_difference ?? 0);

    await manager.getRepository(QuotationCoverNote).update(
      { quotation_id: quotationId },
      {
        currency_code: transaction.currency_code,
        total_premium_excluding_tax: premium.toFixed(2),
        total_premium_including_tax: premium.plus(tax).toFixed(2),
      },
    );
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private integer(value: unknown): number | null {
    const parsed = Number(value);
    return value !== null && value !== '' && Number.isInteger(parsed)
      ? parsed
      : null;
  }
}
