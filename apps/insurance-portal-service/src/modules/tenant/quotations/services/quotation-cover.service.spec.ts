import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SHORT_TERM_COVER } from '@insurance-max/contracts';
import { QuotationCoverService } from './quotation-cover.service';

const ST_PRODUCT = SHORT_TERM_COVER.productCode;
const ST_RISK = SHORT_TERM_COVER.riskCode;
const COMPREHENSIVE = 'SP014001000002';

const SHORT_TERM_ONLY = {
  permissions: [
    'quotations:read',
    'quotations:create',
    'quotations:update',
    'underwrite.short_term.view',
    'underwrite.short_term.create',
    'underwrite.short_term.edit',
  ],
};
const SHORT_TERM_FLEET_ONLY = {
  permissions: [
    'quotations:create',
    'quotations:update',
    'underwrite.short_term_fleet.create',
    'underwrite.short_term_fleet.edit',
  ],
};
const MOTOR_UNDERWRITER = {
  permissions: [
    'quotations:create',
    'quotations:update',
    'underwrite.motor.create',
    'underwrite.motor.edit',
  ],
};

interface Stored {
  quotation_flow: string;
  product_code: string | null;
  underwrite_cover?: string | null;
  draft_payload?: Record<string, unknown> | null;
  risks?: string[];
  cover_start?: string | null;
  cover_end?: string | null;
}

function fakeManager(stored: Stored) {
  const row = {
    id: 'q-1',
    quotation_flow: stored.quotation_flow,
    product_id: 'product-1',
    underwrite_cover: stored.underwrite_cover ?? null,
    draft_payload: stored.draft_payload ?? null,
  };
  const update = jest.fn(
    async (_where: unknown, values: { underwrite_cover: string }) => {
      row.underwrite_cover = values.underwrite_cover;
    },
  );
  const manager = {
    getRepository: () => ({
      findOne: jest.fn(async () => row),
      update,
    }),
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM insurance_products')) {
        return [{ product_code: stored.product_code }];
      }
      if (sql.includes('quotation_entry_risks')) {
        return (stored.risks ?? []).map((risk_code) => ({ risk_code }));
      }
      return [
        {
          cover_start: stored.cover_start ?? '2026-11-01T00:00:00Z',
          cover_end: stored.cover_end ?? '2026-11-30T23:59:59Z',
        },
      ];
    }),
  };
  return { manager: manager as any, row, update };
}

describe('QuotationCoverService', () => {
  const service = new QuotationCoverService();

  describe('Short-Term Single', () => {
    it('classifies and lets a Short-Term underwriter create it', async () => {
      const { manager, row } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
        risks: [ST_RISK],
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: SHORT_TERM_ONLY,
          write: 'quotations:create',
        }),
      ).resolves.toBe('SHORT_TERM_SINGLE');
      expect(row.underwrite_cover).toBe('SHORT_TERM_SINGLE');
    });

    it('keeps it available to existing Motor underwriters', async () => {
      const { manager } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
        risks: [ST_RISK],
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: MOTOR_UNDERWRITER,
          write: 'quotations:create',
        }),
      ).resolves.toBe('SHORT_TERM_SINGLE');
    });
  });

  describe('refusals for a Short-Term-only user', () => {
    it.each([
      ['ordinary Motor risk', { risks: [COMPREHENSIVE] }],
      ['mixed transit and Motor risks', { risks: [ST_RISK, COMPREHENSIVE] }],
      [
        'transit risk on another product',
        { product_code: 'SP014002000000', risks: [ST_RISK] },
      ],
      [
        'cover period over 30 days',
        { risks: [ST_RISK], cover_end: '2027-10-31T23:59:59Z' },
      ],
    ])('rejects %s', async (_label, overrides) => {
      const { manager, update } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
        ...overrides,
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: SHORT_TERM_ONLY,
          write: 'quotations:create',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(update).not.toHaveBeenCalled();
    });

    it('rejects Fleet and Non-Motor quotations', async () => {
      for (const stored of [
        {
          quotation_flow: 'MOTOR_FLEET',
          product_code: ST_PRODUCT,
          risks: [ST_RISK],
        },
        {
          quotation_flow: 'NON_MOTOR',
          product_code: 'FIRE',
          risks: ['FIRE01'],
        },
      ]) {
        const { manager } = fakeManager(stored);
        await expect(
          service.applyInTransaction(manager, 'q-1', {
            user: SHORT_TERM_ONLY,
            write: 'quotations:create',
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
    });

    it('rejects a client label that contradicts the risks', async () => {
      const { manager } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
        risks: [COMPREHENSIVE],
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: SHORT_TERM_ONLY,
          write: 'quotations:create',
          intent: 'SHORT_TERM_SINGLE',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('Short-Term Fleet', () => {
    it('is granted separately from Short-Term Single', async () => {
      const stored = {
        quotation_flow: 'MOTOR_FLEET',
        product_code: ST_PRODUCT,
        risks: [ST_RISK],
      };
      await expect(
        service.applyInTransaction(fakeManager(stored).manager, 'q-1', {
          user: SHORT_TERM_FLEET_ONLY,
          write: 'quotations:create',
        }),
      ).resolves.toBe('SHORT_TERM_FLEET');
      await expect(
        service.applyInTransaction(
          fakeManager({ ...stored, quotation_flow: 'MOTOR_SINGLE' }).manager,
          'q-1',
          { user: SHORT_TERM_FLEET_ONLY, write: 'quotations:create' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('incomplete drafts', () => {
    it('uses the stated cover while no risk is selected', async () => {
      const { manager, row } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
        draft_payload: { step: 'policyholder' },
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: SHORT_TERM_ONLY,
          write: 'quotations:create',
          intent: 'SHORT_TERM_SINGLE',
          includeDraftPayload: true,
        }),
      ).resolves.toBe('SHORT_TERM_SINGLE');
      expect(row.underwrite_cover).toBe('SHORT_TERM_SINGLE');
    });

    it('treats an unlabelled empty draft as the whole line', async () => {
      const { manager } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: SHORT_TERM_ONLY,
          write: 'quotations:create',
          includeDraftPayload: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a stated cover that does not fit the product or flow', async () => {
      const wrongProduct = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: 'SP014002000000',
      });
      await expect(
        service.applyInTransaction(wrongProduct.manager, 'q-1', {
          user: SHORT_TERM_ONLY,
          intent: 'SHORT_TERM_SINGLE',
          includeDraftPayload: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      const wrongFlow = fakeManager({
        quotation_flow: 'NON_MOTOR',
        product_code: 'FIRE',
      });
      // A complete record is classified from its data; the label is ignored.
      await expect(
        service.applyInTransaction(wrongFlow.manager, 'q-1', {
          intent: 'SHORT_TERM_SINGLE',
        }),
      ).resolves.toBe('NON_MOTOR');
    });

    it('reads risks from the draft payload, including fleet vehicles', async () => {
      const { manager } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
        underwrite_cover: 'SHORT_TERM_SINGLE',
        draft_payload: { risks: [{ risk_code: COMPREHENSIVE }] },
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: SHORT_TERM_ONLY,
          write: 'quotations:update',
          includeDraftPayload: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('changing a draft', () => {
    it('prevents a Short-Term user turning a draft into Motor', async () => {
      const { manager, update } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
        underwrite_cover: 'SHORT_TERM_SINGLE',
        risks: [COMPREHENSIVE],
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: SHORT_TERM_ONLY,
          write: 'quotations:update',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(update).not.toHaveBeenCalled();
    });

    it('prevents taking over a Motor record by turning it into Short-Term', async () => {
      const { manager } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
        underwrite_cover: 'MOTOR',
        risks: [ST_RISK],
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: SHORT_TERM_ONLY,
          write: 'quotations:update',
        }),
      ).rejects.toThrow(/Motor quotations/);
    });

    it('lets a Motor underwriter reclassify a Short-Term draft', async () => {
      const { manager, row } = fakeManager({
        quotation_flow: 'MOTOR_SINGLE',
        product_code: ST_PRODUCT,
        underwrite_cover: 'SHORT_TERM_SINGLE',
        risks: [COMPREHENSIVE],
      });
      await expect(
        service.applyInTransaction(manager, 'q-1', {
          user: MOTOR_UNDERWRITER,
          write: 'quotations:update',
        }),
      ).resolves.toBe('MOTOR');
      expect(row.underwrite_cover).toBe('MOTOR');
    });
  });

  it('classifies system-generated quotations without a user check', async () => {
    const { manager } = fakeManager({
      quotation_flow: 'MOTOR_SINGLE',
      product_code: ST_PRODUCT,
      risks: [COMPREHENSIVE],
    });
    await expect(service.applyInTransaction(manager, 'q-1')).resolves.toBe(
      'MOTOR',
    );
  });

  it('does not narrow callers that do not hold the write permission (portal)', async () => {
    const { manager } = fakeManager({
      quotation_flow: 'MOTOR_SINGLE',
      product_code: ST_PRODUCT,
      risks: [COMPREHENSIVE],
    });
    await expect(
      service.applyInTransaction(manager, 'q-1', {
        user: { permissions: ['quotations:read'] },
        write: 'quotations:update',
      }),
    ).resolves.toBe('MOTOR');
  });
});
