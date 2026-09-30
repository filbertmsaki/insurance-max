import { ValidationPipe } from '@nestjs/common';
import {
  PolicyChangeCategory,
  PolicyTransactionChangeType,
} from '@insurance-max/contracts';

import { RecordEndorsementChangeDto } from './record-endorsement-change.dto';

describe('RecordEndorsementChangeDto', () => {
  // Same options as the global pipe in main.ts.
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });
  const validate = (body: Record<string, unknown>) =>
    pipe.transform(body, {
      type: 'body',
      metatype: RecordEndorsementChangeDto,
    }) as Promise<RecordEndorsementChangeDto>;

  const base = {
    category: PolicyChangeCategory.ASSET,
    operation: PolicyTransactionChangeType.MODIFY,
    field_path: 'entries.0.motor.color',
  };

  it('keeps new_value past the whitelist', async () => {
    const dto = await validate({ ...base, new_value: 'Blue' });
    expect(dto.new_value).toBe('Blue');
  });

  it('accepts structured and null new_value', async () => {
    await expect(
      validate({ ...base, new_value: { fleetEntry: 2 } }),
    ).resolves.toMatchObject({ new_value: { fleetEntry: 2 } });
    await expect(
      validate({
        ...base,
        operation: PolicyTransactionChangeType.REMOVE,
        new_value: null,
      }),
    ).resolves.toMatchObject({ new_value: null });
  });

  it('still rejects unknown properties', async () => {
    await expect(
      validate({ ...base, new_value: 'Blue', unexpected: true }),
    ).rejects.toThrow();
  });
});
