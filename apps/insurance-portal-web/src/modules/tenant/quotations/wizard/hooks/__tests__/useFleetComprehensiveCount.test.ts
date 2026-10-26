import { describe, expect, it } from 'vitest';
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../../schemas';
import { countFleetComprehensive } from '../useFleetComprehensiveCount';

type FleetItems = QuotationFormSchemaValues['fleet']['items'];

const risk = (
  id: string,
  risk_name: string,
  cover_class: InsuranceRisk['cover_class'] = null,
) => ({ id, risk_code: id.toUpperCase(), risk_name, cover_class }) as InsuranceRisk;

const vehicle = (...riskIds: string[]) =>
  ({
    risks_covered: riskIds.map((risk_id) => ({ risk_id, risk_code: '' })),
  }) as unknown as FleetItems[number];

describe('countFleetComprehensive', () => {
  const risks = [
    risk('comp', 'Private Comprehensive', 'COMPREHENSIVE'),
    risk('tpft', 'Fire & Theft', 'THIRD_PARTY_FIRE_THEFT'),
    risk('tp', 'Act Only', 'THIRD_PARTY'),
    risk('legacy', 'Commercial Comprehensive'),
    risk('odd', 'Special Cover'),
  ];

  it('counts configured, TPFT and name-matched covers; flags unknown ones', () => {
    expect(
      countFleetComprehensive(
        [
          vehicle('comp'),
          vehicle('tpft'),
          vehicle('tp'),
          vehicle('legacy'),
          vehicle('odd'),
          vehicle(),
        ],
        risks,
      ),
    ).toEqual({ comprehensive: 3, unclassified: 2, total: 6 });
  });
});
