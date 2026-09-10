import { environment } from '@insurance-max/shared-config';
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import { Tax } from '../../modules/tenant/taxes/entities/tax.entity';

export default class TaxCatalogueSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const company = await dataSource.getRepository(Company).findOneBy({
      tira_company_code: environment.SEED_TARGET_COMPANY_CODE ?? 'ICC110',
    });
    if (!company) throw new Error('Target seed company not found');
    await dataSource
      .getRepository(Tax)
      .createQueryBuilder()
      .insert()
      .values([
        {
          company_id: company.id,
          tax_code: 'VAT-MAINLAND',
          tax_name: 'VAT (Mainland)',
          tax_rate: '0.1800000000',
          is_active: true,
        },
        {
          company_id: company.id,
          tax_code: 'WITHHOLDING',
          tax_name: 'Withholding Tax',
          tax_rate: '0.1000000000',
          is_active: true,
        },
      ])
      .orIgnore()
      .execute();
  }
}
