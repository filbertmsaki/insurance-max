import { randomUUID } from 'node:crypto';
import {
  normalizeBeneficiary,
  validateApprovalProfile,
  validateApprovalToken,
  type InactiveApprovalProfile,
} from './finance-approval.types';
const profile = (): InactiveApprovalProfile => ({
  schema: 'FINANCE_APPROVAL_PROFILE_V1',
  purpose: 'JOURNAL_CANDIDATE_ONLY',
  roleCode: 'CHECKER',
  requiredCheckers: 2,
  ttlSeconds: 60,
});
describe('Inactive approval subject contracts', () => {
  it('requires explicit inactive purpose, quorum, lifetime and unresolved control references', () => {
    expect(validateApprovalProfile(profile(), ['DEC-11', 'DEC-14'])).toEqual(
      profile(),
    );
    expect(() => validateApprovalProfile(profile(), ['DEC-11'])).toThrow();
  });
  it.each([
    { requiredCheckers: 0 },
    { requiredCheckers: 11 },
    { requiredCheckers: 1.5 },
    { ttlSeconds: 0 },
    { ttlSeconds: 2592001 },
    { purpose: 'CASH_RELEASE' },
    { roleCode: '' },
    { activate: true },
  ])('rejects unsafe or implicit profile %j', (override) => {
    expect(() =>
      validateApprovalProfile({ ...profile(), ...override }, [
        'DEC-11',
        'DEC-14',
      ]),
    ).toThrow();
  });
  it('normalizes and detaches beneficiary references without accepting raw bank detail fields', () => {
    const id = randomUUID(),
      value = {
        mode: 'REFERENCED',
        sourceSystem: 'SYNTHETIC',
        referenceId: 'ref-1',
        version: '1',
        evidenceHash: 'a'.repeat(64),
        naturalPersonIds: [id.toUpperCase()],
      };
    const result = normalizeBeneficiary(value);
    value.referenceId = 'changed';
    expect(result).toMatchObject({
      referenceId: 'ref-1',
      naturalPersonIds: [id],
    });
    expect(() =>
      normalizeBeneficiary({ ...value, bankAccount: 'secret' }),
    ).toThrow();
  });
  it.each([
    { mode: 'NOT_APPLICABLE', reason: '' },
    {
      mode: 'REFERENCED',
      sourceSystem: 'TEST',
      referenceId: 'r',
      version: '1',
      evidenceHash: 'a'.repeat(64),
      naturalPersonIds: [],
    },
    { mode: 'UNASSESSED' },
  ])('holds missing beneficiary assessment %j', (value) => {
    expect(() => normalizeBeneficiary(value)).toThrow();
  });
  it('rejects duplicate people across identity casing', () => {
    const id = randomUUID();
    expect(() =>
      normalizeBeneficiary({
        mode: 'REFERENCED',
        sourceSystem: 'TEST',
        referenceId: 'r',
        version: '1',
        evidenceHash: 'a'.repeat(64),
        naturalPersonIds: [id, id.toUpperCase()],
      }),
    ).toThrow();
  });
  it('pins both request and beneficiary hashes and rejects activation flags', () => {
    const value = {
      requestId: randomUUID(),
      requestHash: 'a'.repeat(64),
      beneficiaryHash: 'b'.repeat(64),
    };
    expect(Object.isFrozen(validateApprovalToken(value))).toBe(true);
    expect(() => validateApprovalToken({ ...value, bypass: true })).toThrow();
    expect(() =>
      validateApprovalToken({ ...value, beneficiaryHash: '' }),
    ).toThrow();
  });
});
