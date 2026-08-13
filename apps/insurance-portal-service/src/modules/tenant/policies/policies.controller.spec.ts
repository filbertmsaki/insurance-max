import { ConflictException } from '@nestjs/common';

import { PoliciesController } from './policies.controller';

describe('PoliciesController - policy origination', () => {
  it('rejects normal manual policy creation', () => {
    const controller = new PoliciesController({} as any);

    expect(() => controller.create()).toThrow(ConflictException);
    expect(() => controller.create()).toThrow(
      'Manual policy creation is disabled',
    );
  });
});
