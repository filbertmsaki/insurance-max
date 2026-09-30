import { BadRequestException, ConflictException } from '@nestjs/common';

import { ClaimNumberFormatService } from './claim-number-format.service';

describe('ClaimNumberFormatService', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as never;

  function setup(rows: Array<{ document_type: string; prefix: string }> = []) {
    const query = jest
      .fn()
      .mockImplementation((sql: string) =>
        Promise.resolve(
          sql.trim().startsWith('SELECT')
            ? rows.map((row) => ({ ...row, sequence_length: 5 }))
            : [],
        ),
      );
    const audit = { log: jest.fn() };
    return {
      query,
      audit,
      service: new ClaimNumberFormatService({ query } as never, audit as never),
    };
  }

  it('lists every claim type with its default when nothing is configured', async () => {
    const formats = await setup().service.list('company-1');
    const claim = formats.find((item) => item.document_type === 'CLAIM');
    expect(claim).toMatchObject({ prefix: 'CLM-{YYYY}-', customised: false });
    expect(claim?.example).toBe(`CLM-${new Date().getFullYear()}-00001`);
  });

  it('saves a valid format and audits it', async () => {
    const { service, query, audit } = setup();
    await service.save(user, {
      document_type: 'CLAIM_PAYMENT',
      prefix: 'PAY/{YY}/',
      sequence_length: 6,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO business_document_number_formats'),
      ['company-1', 'CLAIM_PAYMENT', 'PAY/{YY}/', 6, 'user-1'],
    );
    expect(audit.log).toHaveBeenCalled();
  });

  it('refuses characters outside the allowed set', async () => {
    await expect(
      setup().service.save(user, { document_type: 'CLAIM', prefix: 'CLM %' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a prefix another claim document already uses', async () => {
    await expect(
      setup().service.save(user, {
        document_type: 'CLAIM_PAYMENT',
        prefix: 'DV-{YYYY}-',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
