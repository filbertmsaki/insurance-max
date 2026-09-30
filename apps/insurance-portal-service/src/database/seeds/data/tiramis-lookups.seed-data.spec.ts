import { TIRAMIS_LOOKUPS } from './tiramis-lookups.seed-data';

describe('TIRAMIS lookup seed data', () => {
  const groups = new Set(TIRAMIS_LOOKUPS.map((lookup) => lookup.group));

  it.each([
    'COVER_NOTE_TYPE',
    'PAYMENT_MODE',
    'POLICY_HOLDER_TYPE',
    'IDENTITY_TYPE',
    'GENDER',
    'MOTOR_CATEGORY',
    'MOTOR_TYPE',
    'MOTOR_USAGE',
    'OWNER_CATEGORY',
    'TAX_CODE',
    'REINSURANCE_CATEGORY',
    'PARTICIPANT_TYPE',
    'REINSURANCE_FORM',
    'REINSURANCE_TYPE',
    'LOSS_ASSESSMENT_OPTION',
  ])('contains required lookup group %s', (group) => {
    expect(groups.has(group)).toBe(true);
  });

  it('uses the TIRAMIS v1.3 identification type codes 1–7', () => {
    const identityTypes = TIRAMIS_LOOKUPS.filter(
      (lookup) => lookup.group === 'IDENTITY_TYPE',
    ).map((lookup) => [lookup.code, lookup.label]);

    expect(identityTypes).toEqual([
      ['1', 'National ID'],
      ['2', 'Voter ID'],
      ['3', 'Passport'],
      ['4', 'Driving License'],
      ['5', 'Zanzibar Resident ID (ZANID)'],
      ['6', 'Tax Identification Number'],
      ['7', 'Company Incorporation Certificate Number'],
    ]);
  });

  it('does not define duplicate code values inside a lookup group', () => {
    const keys = TIRAMIS_LOOKUPS.map(
      (lookup) => `${lookup.group}:${lookup.code}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});
