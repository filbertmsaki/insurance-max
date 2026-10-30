import {
  BusinessReferenceService,
  renderNumberPrefix,
} from './business-reference.service';

describe('BusinessReferenceService', () => {
  function service(format?: { prefix: string; sequence_length: number }) {
    const query = jest
      .fn()
      .mockResolvedValueOnce(format ? [format] : [])
      .mockResolvedValueOnce([{ current_value: 42 }]);
    return {
      query,
      next: (prefix = 'CLM-2026-', sequenceLength?: number) =>
        new BusinessReferenceService({ manager: { query } } as never).next({
          companyId: 'company-1',
          documentType: 'CLAIM',
          prefix,
          sequenceLength,
        }),
    };
  }

  it('uses the caller prefix when the company has no format', async () => {
    await expect(service().next()).resolves.toBe('CLM202600042');
  });

  it("uses the company's configured prefix and length", async () => {
    const year = String(new Date().getFullYear()).slice(-2);
    await expect(
      service({ prefix: 'AIC/CL/{YY}/', sequence_length: 7 }).next(),
    ).resolves.toBe(`AICCL${year}0000042`);
  });

  it('renders the year and month tokens', () => {
    const date = new Date(2026, 8, 30);
    expect(renderNumberPrefix('C-{YYYY}-{MM}-', date)).toBe('C-2026-09-');
    expect(renderNumberPrefix('C{YY}', date)).toBe('C26');
  });
});
