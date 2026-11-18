import { ExecutionContext, GoneException } from '@nestjs/common';

import { LegacyBillingReadOnlyGuard } from './legacy-billing-read-only.guard';

describe('LegacyBillingReadOnlyGuard', () => {
  const guard = new LegacyBillingReadOnlyGuard();
  const contextFor = (method: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ method }) }),
    }) as unknown as ExecutionContext;

  it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s', (method) => {
    expect(guard.canActivate(contextFor(method))).toBe(true);
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('rejects %s', (method) => {
    expect(() => guard.canActivate(contextFor(method))).toThrow(GoneException);
  });
});
