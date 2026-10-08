import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCoverNoteDto } from './create-cover-note.dto';

describe('CreateCoverNoteDto nested collections', () => {
  it('rejects non-array and empty required collections', async () => {
    const dto = plainToInstance(CreateCoverNoteDto, {
      risks: 'not-an-array',
      subjectMatters: [],
      policyHolders: [],
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['risks', 'subjectMatters', 'policyHolders']),
    );
  });

  it('validates nested risk taxes and add-on fields as typed arrays', async () => {
    const dto = plainToInstance(CreateCoverNoteDto, {
      risks: [{ taxes: 'not-an-array' }],
      subjectMatters: [{}],
      policyHolders: [{}],
      addons: [{ taxes: 'not-an-array' }],
    });

    const errors = await validate(dto);
    const riskErrors = errors.find((error) => error.property === 'risks');
    const addonErrors = errors.find((error) => error.property === 'addons');

    expect(
      riskErrors?.children?.[0].children?.map((error) => error.property),
    ).toContain('taxes');
    expect(
      addonErrors?.children?.[0].children?.map((error) => error.property),
    ).toContain('taxes');
  });
});
