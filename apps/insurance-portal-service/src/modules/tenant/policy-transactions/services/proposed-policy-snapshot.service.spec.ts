import { ProposedPolicySnapshotService } from './proposed-policy-snapshot.service';

function fakeHashService() {
  return {
    hashDefinition: (value: unknown) => JSON.stringify(value),
  } as any;
}

describe('ProposedPolicySnapshotService', () => {
  const service = new ProposedPolicySnapshotService(fakeHashService());

  const sourceSnapshot = {
    totals: { totalPremium: '100000' },
    risks: {
      'risk-1': { sumInsured: '20000000' },
    },
  };

  it('applies a MODIFY change without mutating the source snapshot', () => {
    const result = service.build(sourceSnapshot, [
      {
        fieldPath: 'risks.risk-1.sumInsured',
        operation: 'MODIFY',
        newValue: '25000000',
      },
    ]);

    expect(result.snapshot.risks).toEqual({
      'risk-1': { sumInsured: '25000000' },
    });
    expect(sourceSnapshot.risks['risk-1'].sumInsured).toBe('20000000');
  });

  it('applies a REMOVE change by deleting the path', () => {
    const result = service.build(sourceSnapshot, [
      {
        fieldPath: 'risks.risk-1',
        operation: 'REMOVE',
        newValue: null,
      },
    ]);

    expect(result.snapshot.risks).toEqual({});
  });

  it('produces a stable hash for the same change set regardless of input order', () => {
    const changes = [
      {
        fieldPath: 'risks.risk-1.sumInsured',
        operation: 'MODIFY' as const,
        newValue: '25000000',
      },
      {
        fieldPath: 'totals.totalPremium',
        operation: 'MODIFY' as const,
        newValue: '125000',
      },
    ];

    const first = service.build(sourceSnapshot, changes);
    const second = service.build(sourceSnapshot, [...changes].reverse());

    expect(first.snapshotHash).toBe(second.snapshotHash);
  });

  it('rejects a change with an empty field path', () => {
    expect(() =>
      service.build(sourceSnapshot, [
        { fieldPath: '', operation: 'MODIFY', newValue: '1' },
      ]),
    ).toThrow();
  });
});
