import {
  SHORT_TERM_COVER,
  UNDERWRITE_COVER_PERMISSION_NAMES,
  UnderwriteCover,
  UnderwriteCoverStatus,
  canAccessUnderwriteCover,
  classifyUnderwriteCover,
  collectRiskCodes,
  resolveUnderwriteCover,
  resolveUnderwriteCoverAccess,
  underwriteActionForScopePermission,
  underwriteCoverGrantSource,
  underwriteCoverPermissionsGranting,
  underwriteCoversAllowed,
  underwriteCoversWithAnyAccess,
  underwriteLineEntryPermissions,
} from './cover-access';
import { UnderwriteLine } from './underwrite-line';
import {
  UNDERWRITE_PERMISSION_NAMES,
  UnderwriteAction,
  withUnderwritePermissionAliases,
} from './underwrite-permissions';

const ST_PRODUCT = SHORT_TERM_COVER.productCode;
const ST_RISK = SHORT_TERM_COVER.riskCode;
const COMPREHENSIVE = 'SP014001000002';

describe('Short-Term configuration', () => {
  it('uses the catalogue product and transit risk', () => {
    expect(ST_PRODUCT).toBe('SP014001000000');
    expect(ST_RISK).toBe('SP014001000007');
    expect(SHORT_TERM_COVER.durationDays).toBe(30);
  });
});

describe('classifyUnderwriteCover', () => {
  const single = (
    overrides: Partial<Parameters<typeof classifyUnderwriteCover>[0]> = {},
  ) =>
    classifyUnderwriteCover({
      quotationFlow: 'MOTOR_SINGLE',
      productCode: ST_PRODUCT,
      riskCodes: [ST_RISK],
      coverStart: '2026-11-01T00:00:00Z',
      coverEnd: '2026-11-30T23:59:59Z',
      ...overrides,
    });

  it('classifies Short-Term Single and Fleet', () => {
    expect(single().cover).toBe(UnderwriteCover.SHORT_TERM_SINGLE);
    expect(single({ quotationFlow: 'MOTOR_FLEET' }).cover).toBe(
      UnderwriteCover.SHORT_TERM_FLEET,
    );
  });

  it('is case and whitespace insensitive and de-duplicates risks', () => {
    expect(
      single({ riskCodes: [` ${ST_RISK.toLowerCase()} `, ST_RISK] }).cover,
    ).toBe(UnderwriteCover.SHORT_TERM_SINGLE);
  });

  it('classifies ordinary Motor, Fleet and Non-Motor', () => {
    expect(single({ riskCodes: [COMPREHENSIVE] }).cover).toBe('MOTOR');
    expect(
      single({ quotationFlow: 'MOTOR_FLEET', riskCodes: [COMPREHENSIVE] })
        .cover,
    ).toBe('FLEET');
    expect(
      classifyUnderwriteCover({
        quotationFlow: 'NON_MOTOR',
        productCode: 'FIRE',
        riskCodes: [],
      }),
    ).toEqual({ cover: 'NON_MOTOR', status: 'CLASSIFIED', reason: null });
  });

  it('classifies mixed transit and other risks as the whole line', () => {
    const result = single({ riskCodes: [ST_RISK, COMPREHENSIVE] });
    expect(result.status).toBe(UnderwriteCoverStatus.MIXED);
    expect(result.cover).toBe('MOTOR');
    const fleet = single({
      quotationFlow: 'MOTOR_FLEET',
      riskCodes: [ST_RISK, COMPREHENSIVE],
    });
    expect(fleet).toMatchObject({ status: 'MIXED', cover: 'FLEET' });
  });

  it('classifies a transit risk on another product as the whole line', () => {
    expect(single({ productCode: 'SP014002000000' })).toMatchObject({
      status: 'MIXED',
      cover: 'MOTOR',
    });
    expect(single({ productCode: null })).toMatchObject({ status: 'MIXED' });
  });

  it('classifies a cover period over 30 days as the whole line', () => {
    expect(single({ coverEnd: '2027-10-31T23:59:59Z' })).toMatchObject({
      status: 'MIXED',
      cover: 'MOTOR',
    });
    expect(single({ coverEnd: '2026-10-01T00:00:00Z' })).toMatchObject({
      status: 'MIXED',
    });
    // Exactly the 30-day maximum is allowed; missing dates are not judged.
    expect(single({ coverEnd: '2026-12-01T00:00:00Z' }).cover).toBe(
      'SHORT_TERM_SINGLE',
    );
    expect(single({ coverStart: null }).cover).toBe('SHORT_TERM_SINGLE');
  });

  it('reports drafts without risks as incomplete and unknown flows as invalid', () => {
    expect(single({ riskCodes: [] })).toMatchObject({
      status: 'INCOMPLETE',
      cover: null,
    });
    expect(single({ riskCodes: ['', null, undefined] }).status).toBe(
      'INCOMPLETE',
    );
    expect(single({ quotationFlow: 'MARINE' }).status).toBe('INVALID');
  });
});

describe('resolveUnderwriteCover', () => {
  const incomplete = classifyUnderwriteCover({
    quotationFlow: 'MOTOR_SINGLE',
    productCode: ST_PRODUCT,
    riskCodes: [],
  });

  it('uses the classification of complete records and ignores the label', () => {
    const motor = classifyUnderwriteCover({
      quotationFlow: 'MOTOR_SINGLE',
      productCode: ST_PRODUCT,
      riskCodes: [COMPREHENSIVE],
    });
    expect(
      resolveUnderwriteCover(motor, {
        quotationFlow: 'MOTOR_SINGLE',
        productCode: ST_PRODUCT,
        intent: 'SHORT_TERM_SINGLE',
      }),
    ).toEqual({ cover: 'MOTOR' });
  });

  it('uses a valid stated cover for an incomplete draft', () => {
    expect(
      resolveUnderwriteCover(incomplete, {
        quotationFlow: 'MOTOR_SINGLE',
        productCode: ST_PRODUCT,
        intent: 'SHORT_TERM_SINGLE',
      }),
    ).toEqual({ cover: 'SHORT_TERM_SINGLE' });
  });

  it('rejects a stated cover that does not fit the flow or product', () => {
    expect(
      resolveUnderwriteCover(incomplete, {
        quotationFlow: 'MOTOR_SINGLE',
        productCode: ST_PRODUCT,
        intent: 'SHORT_TERM_FLEET',
      }).error,
    ).toMatch(/cannot be quoted/);
    expect(
      resolveUnderwriteCover(incomplete, {
        quotationFlow: 'MOTOR_SINGLE',
        productCode: 'SP014002000000',
        intent: 'SHORT_TERM_SINGLE',
      }).error,
    ).toMatch(/must use product/);
    expect(
      resolveUnderwriteCover(incomplete, {
        quotationFlow: 'MOTOR_SINGLE',
        productCode: ST_PRODUCT,
        intent: 'GOLD',
      }).error,
    ).toMatch(/Unknown cover/);
  });

  it('keeps the stored cover of an incomplete draft, else the whole line', () => {
    expect(
      resolveUnderwriteCover(incomplete, {
        quotationFlow: 'MOTOR_SINGLE',
        productCode: ST_PRODUCT,
        existing: 'SHORT_TERM_SINGLE',
      }),
    ).toEqual({ cover: 'SHORT_TERM_SINGLE' });
    // The draft moved to another product: the restricted cover no longer fits.
    expect(
      resolveUnderwriteCover(incomplete, {
        quotationFlow: 'MOTOR_SINGLE',
        productCode: 'SP014002000000',
        existing: 'SHORT_TERM_SINGLE',
      }),
    ).toEqual({ cover: 'MOTOR' });
    expect(
      resolveUnderwriteCover(incomplete, {
        quotationFlow: 'MOTOR_SINGLE',
        productCode: ST_PRODUCT,
      }),
    ).toEqual({ cover: 'MOTOR' });
  });
});

describe('cover access', () => {
  const SHORT_TERM_ONLY = [
    'underwrite.short_term.view',
    'underwrite.short_term.create',
    'underwrite.short_term.edit',
  ];

  it('defines restricted cover permissions distinct from line permissions', () => {
    expect(UNDERWRITE_COVER_PERMISSION_NAMES).toContain(
      'underwrite.short_term.create',
    );
    expect(UNDERWRITE_COVER_PERMISSION_NAMES).toContain(
      'underwrite.short_term_fleet.submit',
    );
    for (const name of UNDERWRITE_COVER_PERMISSION_NAMES) {
      expect(UNDERWRITE_PERMISSION_NAMES).not.toContain(name);
    }
  });

  it('never derives restricted covers from legacy permissions', () => {
    const expanded = withUnderwritePermissionAliases([
      'quotations:read',
      'quotations:create',
    ]);
    expect(
      expanded.filter((name) =>
        UNDERWRITE_COVER_PERMISSION_NAMES.includes(name),
      ),
    ).toEqual([]);
  });

  it('limits a Short-Term grant to Short-Term Single', () => {
    const access = resolveUnderwriteCoverAccess(SHORT_TERM_ONLY);
    expect(access.SHORT_TERM_SINGLE).toEqual(['view', 'create', 'edit']);
    expect(access.MOTOR).toEqual([]);
    expect(access.FLEET).toEqual([]);
    expect(access.SHORT_TERM_FLEET).toEqual([]);
    expect(
      underwriteCoversAllowed(SHORT_TERM_ONLY, UnderwriteAction.VIEW),
    ).toEqual(['SHORT_TERM_SINGLE']);
    expect(
      canAccessUnderwriteCover(SHORT_TERM_ONLY, 'MOTOR', UnderwriteAction.VIEW),
    ).toBe(false);
  });

  it('includes restricted covers in an existing line grant', () => {
    const motor = ['underwrite.motor.view'];
    expect(underwriteCoversAllowed(motor, UnderwriteAction.VIEW)).toEqual([
      'MOTOR',
      'SHORT_TERM_SINGLE',
    ]);
    expect(underwriteCoverGrantSource(motor, 'SHORT_TERM_SINGLE', 'view')).toBe(
      'LINE',
    );
    expect(
      underwriteCoverGrantSource(SHORT_TERM_ONLY, 'SHORT_TERM_SINGLE', 'view'),
    ).toBe('COVER');
  });

  it('combines grants additively', () => {
    const permissions = [
      ...SHORT_TERM_ONLY,
      'underwrite.fleet.view',
      'underwrite.non_motor.view',
    ];
    expect(underwriteCoversAllowed(permissions, UnderwriteAction.VIEW)).toEqual(
      ['FLEET', 'NON_MOTOR', 'SHORT_TERM_SINGLE', 'SHORT_TERM_FLEET'],
    );
    expect(
      underwriteCoversAllowed(permissions, UnderwriteAction.CREATE),
    ).toEqual(['SHORT_TERM_SINGLE']);
    expect(underwriteCoversWithAnyAccess(permissions)).not.toContain('MOTOR');
  });

  it('keeps policy transactions with the line grant', () => {
    expect(
      underwriteCoverPermissionsGranting(
        'SHORT_TERM_SINGLE',
        UnderwriteAction.ENDORSEMENTS_MANAGE,
      ),
    ).toEqual(['underwrite.motor.endorsements.manage']);
  });

  it('lets restricted grants enter the parent line only', () => {
    expect(
      underwriteLineEntryPermissions(
        UnderwriteLine.MOTOR,
        UnderwriteAction.CREATE,
      ),
    ).toEqual(['underwrite.motor.create', 'underwrite.short_term.create']);
    expect(
      underwriteLineEntryPermissions(
        UnderwriteLine.FLEET,
        UnderwriteAction.CREATE,
      ),
    ).toEqual([
      'underwrite.fleet.create',
      'underwrite.short_term_fleet.create',
    ]);
    expect(
      underwriteLineEntryPermissions(
        UnderwriteLine.NON_MOTOR,
        UnderwriteAction.CREATE,
      ),
    ).toEqual(['underwrite.non_motor.create']);
    expect(
      underwriteLineEntryPermissions(
        UnderwriteLine.MOTOR,
        UnderwriteAction.ENDORSEMENTS_VIEW,
      ),
    ).not.toContain('underwrite.short_term.endorsements.view');
  });

  it('maps scope permissions to cover actions', () => {
    expect(underwriteActionForScopePermission('quotations:read')).toBe('view');
    expect(
      underwriteActionForScopePermission('quotations:request-payment'),
    ).toBe('submit');
    expect(underwriteActionForScopePermission('quotations:approve')).toBe(
      'approve',
    );
    expect(underwriteActionForScopePermission('policies:read')).toBe(
      'policies.view',
    );
    expect(underwriteActionForScopePermission('claims:read')).toBeNull();
    expect(underwriteActionForScopePermission(undefined)).toBeNull();
  });
});

describe('collectRiskCodes', () => {
  it('finds risk codes at any depth, including fleet vehicles', () => {
    expect(
      collectRiskCodes({
        risks: [{ risk_code: ST_RISK }],
        fleet: {
          items: [{ risks: [{ risk_code: COMPREHENSIVE.toLowerCase() }] }],
        },
      }).sort(),
    ).toEqual([COMPREHENSIVE, ST_RISK].sort());
    expect(collectRiskCodes(null)).toEqual([]);
    expect(collectRiskCodes({ risk_code: '  ' })).toEqual([]);
  });
});
