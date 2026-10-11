import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  CancellationReasonType,
  PolicyTransactionPremiumEffect,
} from '@insurance-max/contracts';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import {
  FLEET_ENTRY_REMOVED,
  FLEET_REMOVE_VEHICLE_CODE,
} from '../constants/fleet-vehicle-endorsement.constants';
import { CancellationPricingService } from './cancellation-pricing.service';
import { PolicyCancellationConfigService } from './policy-cancellation-config.service';

type SnapshotRecord = Record<string, unknown>;

export interface FleetRemovalRefundLine {
  fleetEntry: number;
  grossWrittenPremium: string;
  earnedPremium: string;
  unearnedPremium: string;
}

/**
 * Return premium for a "Fleet - Remove Vehicle" endorsement (design decision
 * D5): each removed vehicle is refunded under the company's configured
 * cancellation method (pro-rata, short-period, minimum retained, ...) on the
 * premium it was issued with, and the configured cancellation charge is
 * deducted once for the endorsement. Replaces the plain remaining-period
 * difference the endorsement repricing produces.
 */
@Injectable()
export class FleetRemovalRefundService {
  constructor(
    private readonly cancellationPricing: CancellationPricingService,
    private readonly cancellationConfig: PolicyCancellationConfigService,
  ) {}

  /** Adjusts `transaction`'s premium fields in place; true if it applied. */
  async adjust(
    manager: EntityManager,
    transaction: PolicyTransaction,
  ): Promise<boolean> {
    const endorsement = await manager
      .getRepository(PolicyEndorsement)
      .findOne({ where: { policy_transaction_id: transaction.id } });
    if (endorsement?.endorsement_type_code !== FLEET_REMOVE_VEHICLE_CODE) {
      return false;
    }

    const removed = this.asArray(
      transaction.proposed_policy_snapshot?.['entries'],
    )
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry['status'] === FLEET_ENTRY_REMOVED);
    if (!removed.length) return false;

    const [policy] = await manager.query<
      Array<{ start_date: string; end_date: string }>
    >(
      // As text: the driver returns `date` columns as Date objects otherwise.
      `SELECT start_date::text AS start_date, end_date::text AS end_date
         FROM policies WHERE id = $1`,
      [transaction.source_policy_id],
    );
    const rule = await this.cancellationConfig.resolve(
      transaction.company_id,
      CancellationReasonType.CUSTOMER_REQUEST,
    );

    const lines: FleetRemovalRefundLine[] = removed.map(({ entry, index }) => {
      const fleetEntry = this.fleetEntryOf(entry, index);
      const gross = this.issuedPremium(transaction, entry, fleetEntry);
      const result = this.cancellationPricing.calculate({
        policyStartDate: String(policy.start_date).slice(0, 10),
        policyEndDate: String(policy.end_date).slice(0, 10),
        cancellationEffectiveDate: transaction.effective_date,
        grossWrittenPremium: gross,
        cancellationMethod: rule.cancellationMethod,
        cancellationCharge: '0',
        minimumRetainedPremium: '0',
      });
      return {
        fleetEntry,
        grossWrittenPremium: gross,
        earnedPremium: result.earnedPremium,
        unearnedPremium: result.unearnedPremium,
      };
    });

    const unearned = lines.reduce(
      (total, line) => total.plus(DecimalUtil.value(line.unearnedPremium)),
      DecimalUtil.value(0),
    );
    const refund = DecimalUtil.value(
      Math.max(
        unearned.minus(DecimalUtil.value(rule.cancellationCharge)).toNumber(),
        0,
      ),
    );

    transaction.premium_effect = refund.gt(0)
      ? PolicyTransactionPremiumEffect.CREDIT
      : transaction.premium_effect;
    transaction.additional_premium = '0.0000';
    transaction.return_premium = refund.toFixed(4);
    transaction.net_premium_difference = refund.negated().toFixed(4);
    transaction.pricing_snapshot = {
      ...(transaction.pricing_snapshot ?? {}),
      fleetRemovalRefund: {
        cancellationMethod: rule.cancellationMethod,
        cancellationCharge: rule.cancellationCharge,
        refundAmount: refund.toFixed(4),
        lines,
      },
    };
    return true;
  }

  /** Premium the vehicle was issued with, excluding non-refundable tax. */
  private issuedPremium(
    transaction: PolicyTransaction,
    entry: SnapshotRecord,
    fleetEntry: number,
  ): string {
    const source = this.asObject(transaction.source_policy_snapshot['source']);
    const fleet = this.asObject(
      this.asObject(source?.['finalizationSnapshot'])?.['fleet'],
    );
    const issued = this.asArray(fleet?.['items']).find(
      (item) => String(item['fleetEntry']) === String(fleetEntry),
    );
    const risks = issued
      ? this.asArray(issued['risks'])
      : this.asArray(this.asObject(entry['pricing'])?.['risks']);
    return risks
      .reduce(
        (total, risk) =>
          total.plus(DecimalUtil.value(this.refundableRiskPremium(risk))),
        DecimalUtil.value(0),
      )
      .toFixed(4);
  }

  private refundableRiskPremium(risk: SnapshotRecord): string | number {
    return (risk['premiumExcludingTaxEquivalent'] ??
      risk['premiumExcludingTax'] ??
      risk['premium_excluding_tax_equivalent'] ??
      risk['premium_excluding_tax'] ??
      risk['premiumIncludingTax'] ??
      0) as string | number;
  }

  private fleetEntryOf(entry: SnapshotRecord, index: number) {
    const value = Number(entry['fleetEntry'] ?? entry['entryNumber']);
    return Number.isInteger(value) && value > 0 ? value : index + 1;
  }

  private asObject(value: unknown): SnapshotRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as SnapshotRecord)
      : null;
  }

  private asArray(value: unknown): SnapshotRecord[] {
    return Array.isArray(value)
      ? value.filter(
          (item): item is SnapshotRecord =>
            !!item && typeof item === 'object' && !Array.isArray(item),
        )
      : [];
  }
}
