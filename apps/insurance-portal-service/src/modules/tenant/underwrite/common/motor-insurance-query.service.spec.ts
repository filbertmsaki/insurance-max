import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MOTOR_INSURANCE_PREVIEW_PERMISSION } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { MotorInsuranceQueryService } from './motor-insurance-query.service';
import type { UnderwriteQueryService } from './underwrite-query.service';

function user(permissions: string[]): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    scope: 'company',
    userType: 'COMPANY_USER',
    sessionId: 'session-1',
    accessTokenId: 'token-1',
    companyId: 'company-1',
    companyMembershipId: 'membership-1',
    roles: ['UNDERWRITER'],
    permissions,
  };
}

const PREVIEW = MOTOR_INSURANCE_PREVIEW_PERMISSION;

function setup() {
  const query = {
    listQuotationsForFlows: jest.fn().mockResolvedValue({ items: [] }),
    listPoliciesForLines: jest.fn().mockResolvedValue({ data: [] }),
    getQuotationFlowForUser: jest.fn(),
    getPolicyLineForUser: jest.fn(),
  };
  const service = new MotorInsuranceQueryService(
    query as unknown as UnderwriteQueryService,
  );
  service.cutover = false;
  return { service, query };
}

describe('MotorInsuranceQueryService', () => {
  it('refuses users without the pilot permission, even with line access', () => {
    const { service } = setup();
    expect(() =>
      service.listQuotations(
        user(['underwrite.motor.view', 'underwrite.fleet.view']),
        {},
      ),
    ).toThrow(ForbiddenException);
  });

  it('after cutover, needs no pilot permission but still the line gates', async () => {
    const { service, query } = setup();
    service.cutover = true;

    await service.listQuotations(user(['underwrite.fleet.view']), {});
    expect(query.listQuotationsForFlows).toHaveBeenLastCalledWith(
      expect.anything(),
      ['MOTOR_FLEET'],
      {},
    );
    expect(() => service.listQuotations(user([]), {})).toThrow(
      ForbiddenException,
    );
  });

  it('refuses pilot users who hold neither Motor nor Fleet', () => {
    const { service } = setup();
    expect(() =>
      service.listQuotations(user([PREVIEW, 'underwrite.non_motor.view']), {}),
    ).toThrow(ForbiddenException);
  });

  it('lists both flows only when both line gates are held', async () => {
    const { service, query } = setup();
    await service.listQuotations(
      user([PREVIEW, 'underwrite.motor.view', 'underwrite.fleet.view']),
      {},
    );
    expect(query.listQuotationsForFlows).toHaveBeenCalledWith(
      expect.anything(),
      ['MOTOR_SINGLE', 'MOTOR_FLEET'],
      {},
    );
  });

  it('never includes Fleet for a Motor-only user, even when asked for fleet', async () => {
    const { service, query } = setup();
    const motorOnly = user([PREVIEW, 'underwrite.motor.view']);

    await service.listQuotations(motorOnly, {});
    expect(query.listQuotationsForFlows).toHaveBeenLastCalledWith(
      expect.anything(),
      ['MOTOR_SINGLE'],
      {},
    );

    await service.listQuotations(motorOnly, {}, 'fleet');
    expect(query.listQuotationsForFlows).toHaveBeenLastCalledWith(
      expect.anything(),
      [],
      {},
    );
  });

  it('uses the policies gate for the policy register', async () => {
    const { service, query } = setup();
    expect(() =>
      service.listPolicies(user([PREVIEW, 'underwrite.motor.view']), {}),
    ).toThrow(ForbiddenException);

    await service.listPolicies(
      user([PREVIEW, 'underwrite.fleet.policies.view']),
      {},
    );
    expect(query.listPoliciesForLines).toHaveBeenCalledWith(
      expect.anything(),
      ['FLEET'],
      {},
    );
  });

  it('resolves a quotation line and hides lines the user cannot access', async () => {
    const { service, query } = setup();
    query.getQuotationFlowForUser.mockResolvedValue('MOTOR_FLEET');

    await expect(
      service.resolveQuotationLine(
        user([PREVIEW, 'underwrite.fleet.view']),
        'q-1',
      ),
    ).resolves.toEqual({ id: 'q-1', line: 'FLEET' });

    await expect(
      service.resolveQuotationLine(
        user([PREVIEW, 'underwrite.motor.view']),
        'q-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats non-motor records as not found', async () => {
    const { service, query } = setup();
    query.getPolicyLineForUser.mockResolvedValue('NON_MOTOR');

    await expect(
      service.resolvePolicyLine(
        user([PREVIEW, 'underwrite.motor.policies.view']),
        'p-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
