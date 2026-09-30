import type { EntityManager } from 'typeorm';
import { linkIssuedPolicyToUnderwrite } from './issued-policy-links';

function fakeManager(queryImpl?: (sql: string) => Promise<unknown>) {
  const query = jest.fn(queryImpl ?? (() => Promise.resolve([])));
  const manager = {
    query,
    transaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager as unknown as EntityManager),
    ),
  };
  return manager;
}

const target = {
  policyId: 'policy-1',
  companyId: 'company-1',
  quotationId: 'quotation-1',
};

describe('linkIssuedPolicyToUnderwrite', () => {
  it('links the fleet and its items for a fleet policy', async () => {
    const manager = fakeManager();

    await linkIssuedPolicyToUnderwrite(manager, {
      ...target,
      quotationFlow: 'MOTOR_FLEET',
    });

    expect(manager.transaction).toHaveBeenCalledTimes(1);
    const [fleetSql, itemSql] = manager.query.mock.calls.map(
      (call) => call[0] as string,
    );
    expect(fleetSql).toContain('UPDATE motor_fleets');
    expect(fleetSql).toContain('policy_id IS NULL OR policy_id = $1');
    expect(itemSql).toContain('UPDATE motor_fleet_items');
    expect(itemSql).toContain(
      'policy_risk.quotation_entry_risk_id = item.quotation_entry_risk_id',
    );
    expect(manager.query.mock.calls[0][1]).toEqual([
      'policy-1',
      'company-1',
      'quotation-1',
    ]);
  });

  it('freezes non-motor risk details once per policy', async () => {
    const manager = fakeManager();

    await linkIssuedPolicyToUnderwrite(manager, {
      ...target,
      quotationFlow: 'NON_MOTOR',
    });

    expect(manager.query).toHaveBeenCalledTimes(1);
    const sql = manager.query.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO policy_non_motor_risk_details');
    expect(sql).toContain('ON CONFLICT (policy_id) DO NOTHING');
  });

  it('does nothing for single motor policies', async () => {
    const manager = fakeManager();

    await linkIssuedPolicyToUnderwrite(manager, {
      ...target,
      quotationFlow: 'MOTOR_SINGLE',
    });

    expect(manager.transaction).not.toHaveBeenCalled();
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('never fails issuance when linking fails', async () => {
    const manager = fakeManager(() =>
      Promise.reject(new Error('relation does not exist')),
    );

    await expect(
      linkIssuedPolicyToUnderwrite(manager as unknown as EntityManager, {
        ...target,
        quotationFlow: 'NON_MOTOR',
      }),
    ).resolves.toBeUndefined();
  });
});
