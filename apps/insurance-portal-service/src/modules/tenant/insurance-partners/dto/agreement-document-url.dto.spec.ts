import { validate } from 'class-validator';

import { CreateInsurancePartnerDto } from './create-insurance-partner.dto';
import { ProposePartnerAmendmentDto } from './propose-partner-amendment.dto';
import { UpdateInsurancePartnerDto } from './update-insurance-partner.dto';

describe('insurance partner agreement document URL validation', () => {
  it.each([
    CreateInsurancePartnerDto,
    UpdateInsurancePartnerDto,
    ProposePartnerAmendmentDto,
  ])('rejects unsafe schemes for %p', async (Dto) => {
    const dto = new Dto();
    Object.assign(dto, { agreement_document_url: 'javascript:alert(1)' });

    const errors = await validate(dto, { skipMissingProperties: true });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'agreement_document_url' }),
      ]),
    );
  });

  it.each([
    CreateInsurancePartnerDto,
    UpdateInsurancePartnerDto,
    ProposePartnerAmendmentDto,
  ])('accepts http and https URLs for %p', async (Dto) => {
    const dto = new Dto();
    Object.assign(dto, {
      agreement_document_url: 'https://storage.local/agreements/doc.pdf',
    });

    await expect(
      validate(dto, { skipMissingProperties: true }),
    ).resolves.toHaveLength(0);
  });
});
