import { randomUUID } from 'node:crypto';
import {
  validateIntegrationProfile,
  integrationLease,
  referenceOutcome,
  validAck,
} from './finance-integration.types';
const profile = () => ({
  schema: 'FINANCE_INTEGRATION_RULES_V1',
  purpose: 'INACTIVE_REFERENCE_ONLY',
  handler: 'HOLD_REFERENCE_V1',
  leaseSeconds: 30,
  maxAttempts: 3,
  retryDelaySeconds: 5,
  consumerId: 'SYNTHETIC',
});
describe('Inactive integration lease, handler and acknowledgement contracts', () => {
  it('requires explicit reviewed parameters and preserves unresolved integration references', () => {
    expect(validateIntegrationProfile(profile(), ['DEC-12', 'DEC-14'])).toEqual(
      profile(),
    );
    expect(() => validateIntegrationProfile(profile(), ['DEC-12'])).toThrow();
  });
  it.each([
    { leaseSeconds: 0 },
    { leaseSeconds: 3601 },
    { maxAttempts: 0 },
    { maxAttempts: 101 },
    { retryDelaySeconds: -1 },
    { retryDelaySeconds: 86401 },
    { handler: 'POST_JOURNAL' },
    { purpose: 'ACTIVATE' },
    { consumerId: '' },
    { automaticReplay: true },
  ])('holds unsupported or implicit reliability setting %j', (override) => {
    expect(() =>
      validateIntegrationProfile({ ...profile(), ...override }, [
        'DEC-12',
        'DEC-14',
      ]),
    ).toThrow();
  });
  it('copies and freezes exact lease identity and rejects caller bypass fields', () => {
    const lease = { id: randomUUID(), token: randomUUID(), version: 2 };
    expect(Object.isFrozen(integrationLease(lease))).toBe(true);
    expect(() => integrationLease({ ...lease, bypass: true })).toThrow();
  });
  it.each([
    undefined,
    null,
    true,
    {},
    { messageId: 'x', payloadHash: 'y', consumerId: 'z', receiptId: 'r' },
  ])('requires a complete exact durable ACK (%j)', (ack) => {
    expect(validAck(ack, 'm', 'h', 'c')).toBe(false);
  });
  it('binds acknowledgement identity to exact message, hash and consumer', () => {
    const a = {
      messageId: randomUUID(),
      payloadHash: 'a'.repeat(64),
      consumerId: 'C',
      receiptId: randomUUID(),
    };
    expect(validAck(a, a.messageId, a.payloadHash, 'C')).toBe(true);
    expect(validAck(a, a.messageId, 'b'.repeat(64), 'C')).toBe(false);
    expect(
      validAck({ ...a, extra: true }, a.messageId, a.payloadHash, 'C'),
    ).toBe(false);
  });
  it('accepts only zero-effect held-reference outcomes', () => {
    const p = {
      schema: 'FINANCE_REFERENCE_OUTCOME_V1',
      messageId: randomUUID(),
      inboxId: randomUUID(),
      dispositionId: randomUUID(),
      previewId: randomUUID(),
      semanticHash: 'a'.repeat(64),
      tenantId: randomUUID(),
      legalEntityId: randomUUID(),
      bookId: randomUUID(),
      accountingState: 'HELD_INACTIVE',
      financialEffects: 0,
    };
    expect(referenceOutcome(p)).toEqual(p);
    expect(() => referenceOutcome({ ...p, financialEffects: 1 })).toThrow();
    expect(() =>
      referenceOutcome({ ...p, accountingState: 'POSTED' }),
    ).toThrow();
  });
});
