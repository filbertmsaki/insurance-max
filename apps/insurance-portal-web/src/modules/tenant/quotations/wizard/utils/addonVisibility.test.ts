import { describe, expect, it } from 'vitest';
import type { QuotationFormSchemaValues } from '../../schemas';
import {
  allowsAddons,
  riskKeepsAddons,
  withApplicableAddons,
} from './addonVisibility';

const addon = { enabled: true, premium_excluding_tax: '1000' };
const priced = { rating_result_metadata: { ok: true } };

function single(risk: object) {
  return {
    quotation_flow: 'MOTOR_SINGLE',
    risks: [risk],
    addons: [addon],
  } as unknown as QuotationFormSchemaValues;
}

function fleet(...risks: object[]) {
  return {
    quotation_flow: 'MOTOR_FLEET',
    fleet: {
      header: {},
      items: risks.map((risk) => ({
        risks_covered: [risk],
        cover_note_addons: [addon],
      })),
    },
  } as unknown as QuotationFormSchemaValues;
}

describe('add-on applicability', () => {
  it('needs a rate above zero', () => {
    expect(allowsAddons('2.5')).toBe(true);
    expect(allowsAddons('0')).toBe(false);
    expect(allowsAddons('')).toBe(false);
  });

  it('keeps add-ons in a draft while the rate is being recalculated', () => {
    expect(riskKeepsAddons({ premium_rate: '' }, 'draft')).toBe(true);
    expect(riskKeepsAddons({ premium_rate: '' }, 'charge')).toBe(false);
  });

  it('drops add-ons once the final rate is zero', () => {
    expect(riskKeepsAddons({ premium_rate: '0', ...priced }, 'draft')).toBe(
      false,
    );
    const values = single({ premium_rate: '0', ...priced });
    expect(withApplicableAddons(values, 'draft').addons).toEqual([]);
  });

  it('keeps add-ons on a positive rate and returns the same object', () => {
    const values = single({ premium_rate: '3', ...priced });
    expect(withApplicableAddons(values, 'charge')).toBe(values);
  });

  it('judges each fleet vehicle on its own rate', () => {
    const values = fleet(
      { premium_rate: '3', ...priced },
      { premium_rate: '0', ...priced },
    );
    const items = withApplicableAddons(values, 'charge').fleet.items;
    expect(items[0].cover_note_addons).toHaveLength(1);
    expect(items[1].cover_note_addons).toEqual([]);
  });

  it('leaves non-motor quotations alone', () => {
    const values = {
      quotation_flow: 'NON_MOTOR',
      addons: [addon],
    } as unknown as QuotationFormSchemaValues;
    expect(withApplicableAddons(values, 'charge')).toBe(values);
  });
});
