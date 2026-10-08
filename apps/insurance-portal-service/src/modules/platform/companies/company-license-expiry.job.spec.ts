import { CompanyLicenseExpiryJob } from './company-license-expiry.job';

describe('CompanyLicenseExpiryJob', () => {
  it('reports active licenses expiring within 30 days without changing organization status', async () => {
    const today = new Date('2026-10-08T00:00:00.000Z');
    const company = {
      id: 'company-1',
      name: 'Example Insurer',
      company_type: 'INSURANCE_COMPANY',
      tira_license_number: 'LIC-1',
      license_expires_at: new Date('2026-10-20T00:00:00.000Z'),
    };
    const query = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([company]),
    };
    const companyRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    const job = new CompanyLicenseExpiryJob(companyRepository as any);
    const logger = (job as any).logger;
    const warn = jest.spyOn(logger, 'warn').mockImplementation();

    await expect(job.reportUpcomingExpiries(today)).resolves.toBe(1);

    expect(query.andWhere).toHaveBeenCalledWith(
      'company.license_expires_at IS NOT NULL',
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"days_remaining":12'),
    );
    expect(companyRepository).not.toHaveProperty('save');
  });
});
