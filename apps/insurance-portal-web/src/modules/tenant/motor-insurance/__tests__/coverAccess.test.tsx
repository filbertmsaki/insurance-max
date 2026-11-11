import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnderwriteAction, UnderwriteLine } from '@insurance-max/contracts';
import { UnderwriteAccessMatrix } from '@/modules/tenant/users/components/form/UnderwriteAccessMatrix';
import {
  MOTOR_INSURANCE_CUSTOMERS_GATE,
  canCreateMotorKind,
  hasLineGate,
  motorInsuranceLineGates,
} from '../access';
import { isShortTermQuotation } from '../shortTerm';

const has = (permissions: string[]) => (name: string) =>
  permissions.includes(name);

const SHORT_TERM_ONLY = has([
  'quotations:create',
  'quotations:read',
  'underwrite.short_term.view',
  'underwrite.short_term.create',
]);

describe('cover-aware Motor Insurance access (UI only)', () => {
  it('offers a Short-Term-only user Short-Term Single and nothing else', () => {
    expect(canCreateMotorKind(SHORT_TERM_ONLY, 'short-term')).toBe(true);
    expect(canCreateMotorKind(SHORT_TERM_ONLY, 'short-term-single')).toBe(true);
    expect(canCreateMotorKind(SHORT_TERM_ONLY, 'short-term-fleet')).toBe(false);
    expect(canCreateMotorKind(SHORT_TERM_ONLY, 'single')).toBe(false);
    expect(canCreateMotorKind(SHORT_TERM_ONLY, 'fleet')).toBe(false);
  });

  it('keeps broad Motor and Fleet users able to create every kind', () => {
    const broad = has([
      'quotations:create',
      'underwrite.motor.create',
      'underwrite.fleet.create',
    ]);
    for (const kind of [
      'single',
      'fleet',
      'short-term-single',
      'short-term-fleet',
    ] as const) {
      expect(canCreateMotorKind(broad, kind)).toBe(true);
    }
  });

  it('requires the base quotations:create permission', () => {
    expect(
      canCreateMotorKind(has(['underwrite.short_term.create']), 'short-term'),
    ).toBe(false);
  });

  it('opens cover-filtered screens only', () => {
    expect(
      hasLineGate(SHORT_TERM_ONLY, UnderwriteLine.MOTOR, UnderwriteAction.VIEW),
    ).toBe(true);
    expect(
      hasLineGate(SHORT_TERM_ONLY, UnderwriteLine.FLEET, UnderwriteAction.VIEW),
    ).toBe(false);
    expect(
      hasLineGate(
        SHORT_TERM_ONLY,
        UnderwriteLine.MOTOR,
        UnderwriteAction.ENDORSEMENTS_VIEW,
      ),
    ).toBe(false);
    expect(motorInsuranceLineGates(UnderwriteAction.TIRA_RETRY)).not.toContain(
      'underwrite.short_term.tira.retry',
    );
    expect(MOTOR_INSURANCE_CUSTOMERS_GATE.anyPermissionGroups[0]).not.toContain(
      'underwrite.short_term.view',
    );
  });

  it('reopens drafts by the server classification', () => {
    expect(isShortTermQuotation({ underwrite_cover: 'SHORT_TERM_FLEET' })).toBe(
      true,
    );
    expect(
      isShortTermQuotation({
        underwrite_cover: 'MOTOR',
        draft_payload: { risks: [{ risk_code: 'SP014001000007' }] },
      }),
    ).toBe(false);
  });
});

describe('UnderwriteAccessMatrix', () => {
  it('shows where each grant comes from and missing dependencies', () => {
    render(
      <UnderwriteAccessMatrix
        permissionNames={[
          'underwrite.short_term.create',
          'underwrite.fleet.view',
          'quotations:read',
        ]}
      />,
    );
    expect(
      screen.getByLabelText(
        'Create and complete quotations: SHORT_TERM_SINGLE: COVER',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('View quotations: SHORT_TERM_FLEET: LINE'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        'Create and complete quotations: MOTOR: not granted',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Create needs quotations:create',
    );
  });
});
