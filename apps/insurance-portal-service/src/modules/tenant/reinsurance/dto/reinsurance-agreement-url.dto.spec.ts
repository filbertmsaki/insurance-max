import { validate } from 'class-validator';

import { CreateTreatyDto } from './reinsurance.dto';

describe('reinsurance agreement document URL validation', () => {
  it('rejects unsafe agreement document URL schemes', async () => {
    const dto = new CreateTreatyDto();
    Object.assign(dto, { agreement_document_url: 'javascript:alert(1)' });

    const errors = await validate(dto, { skipMissingProperties: true });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'agreement_document_url' }),
      ]),
    );
  });

  it('accepts http and https agreement document URLs', async () => {
    const dto = new CreateTreatyDto();
    Object.assign(dto, {
      agreement_document_url: 'https://storage.local/reinsurance/treaty.pdf',
    });

    await expect(
      validate(dto, { skipMissingProperties: true }),
    ).resolves.toHaveLength(0);
  });
});
