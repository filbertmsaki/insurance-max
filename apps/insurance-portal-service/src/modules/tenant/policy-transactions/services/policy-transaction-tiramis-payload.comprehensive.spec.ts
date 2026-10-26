import { PolicyTransactionTiramisPayloadService } from './policy-transaction-tiramis-payload.service';

function serviceWithRisks(risks: Array<Record<string, unknown>>) {
  const repo = { find: jest.fn().mockResolvedValue(risks) };
  const service = new PolicyTransactionTiramisPayloadService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    repo as any,
  );
  return { service, repo };
}

const payload = (...vehicles: string[][]) => ({
  isFleet: true,
  fleet: {
    comprehensiveInsured: 99,
    items: vehicles.map((codes) => ({
      risks: codes.map((riskCode) => ({ riskCode })),
    })),
  },
});

const apply = (service: PolicyTransactionTiramisPayloadService, body: any) =>
  (service as any).withComprehensiveCount(body, { company_id: 'tenant-1' });

describe('PolicyTransactionTiramisPayloadService ComprehensiveInsured', () => {
  it('counts Comprehensive and TPFT vehicles from configured risks', async () => {
    const { service, repo } = serviceWithRisks([
      { risk_code: 'COMP', risk_name: 'x', cover_class: 'COMPREHENSIVE' },
      {
        risk_code: 'TPFT',
        risk_name: 'x',
        cover_class: 'THIRD_PARTY_FIRE_THEFT',
      },
      { risk_code: 'TP', risk_name: 'x', cover_class: 'THIRD_PARTY' },
    ]);
    const result = await apply(
      service,
      payload(['COMP'], ['TPFT'], ['TP'], ['TP', 'COMP']),
    );
    expect(result.fleet.comprehensiveInsured).toBe(3);
    expect(repo.find.mock.calls[0][0].where.company_id).toBe('tenant-1');
  });

  it('keeps the existing value when a cover cannot be classified', async () => {
    const { service } = serviceWithRisks([
      { risk_code: 'ODD', risk_name: 'Special', cover_class: null },
    ]);
    const result = await apply(service, payload(['ODD']));
    expect(result.fleet.comprehensiveInsured).toBe(99);
  });

  it('leaves non-fleet payloads alone', async () => {
    const { service, repo } = serviceWithRisks([]);
    const body = { isFleet: false };
    expect(await apply(service, body)).toBe(body);
    expect(repo.find).not.toHaveBeenCalled();
  });
});
