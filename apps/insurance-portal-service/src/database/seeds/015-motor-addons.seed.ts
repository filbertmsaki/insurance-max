import { environment } from '@insurance-max/shared-config';
import { AddonPricingType } from '@insurance-max/contracts';
import { DataSource, In } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import { InsuranceProduct } from '../../modules/tenant/insurance-products/entities/insurance-product.entity';
import { InsuranceProductVersion } from '../../modules/tenant/insurance-products/entities/insurance-product-version.entity';
import { ProductAddonDefinition } from '../../modules/tenant/insurance-products/entities/product-addon-definition.entity';
import { ProductAddonRateRule } from '../../modules/tenant/pricing/entities/product-addon-rate-rule.entity';
import {
  MOTOR_PRODUCT_CODES,
  MOTOR_RATE_BOOK_VERSION,
  resolveMotorRateBookCode,
} from '../../modules/tenant/pricing/domain/motor-rating.config';
import { PricingRateBook } from '../../modules/tenant/pricing-rate-books/entities/pricing-rate-book.entity';

const ADDONS = [
  {
    code: 'WINDSCREEN',
    tiramis_addon_code: 'WINDSCREEN',
    name: 'Windscreen Cover',
    description:
      'Optional cover for accidental damage to the vehicle windscreen.',
    allows_separate_sum_insured: true,
    pricing_type: AddonPricingType.PERCENTAGE,
    percentage_rate: '0.05',
    minimum_amount: null,
    maximum_amount: null,
    sort_order: 10,
  },
  {
    code: 'AUDIO_EQUIPMENT',
    tiramis_addon_code: 'AUDIO',
    name: 'Radio and Audio Equipment',
    description: 'Optional cover for installed radio and audio equipment.',
    allows_separate_sum_insured: true,
    pricing_type: AddonPricingType.PERCENTAGE,
    percentage_rate: '0.05',
    minimum_amount: null,
    maximum_amount: null,
    sort_order: 20,
  },
  {
    code: 'ROADSIDE_ASSISTANCE',
    tiramis_addon_code: 'ROADSIDE',
    name: 'Roadside Assistance',
    description: 'Optional roadside assistance cover per insured vehicle.',
    allows_separate_sum_insured: false,
    pricing_type: AddonPricingType.FIXED,
    fixed_amount: '30000',
    minimum_amount: null,
    maximum_amount: null,
    sort_order: 30,
  },
] as const;

/** Seeds three illustrative add-ons and their rates on the demo motor tariff. */
export default class MotorAddonsSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<void> {
    void factoryManager;
    const manager = dataSource.manager;
    const companyCode = environment.SEED_TARGET_COMPANY_CODE ?? 'ICC739';
    const company = await manager.getRepository(Company).findOne({
      where: { tira_company_code: companyCode },
    });
    if (!company) {
      console.warn(
        `[MotorAddonsSeeder] Company ${companyCode} not found; skipping.`,
      );
      return;
    }

    const products = await manager.getRepository(InsuranceProduct).find({
      where: {
        company_id: company.id,
        product_code: In([...MOTOR_PRODUCT_CODES]),
      },
    });
    const versions = await manager.getRepository(InsuranceProductVersion).find({
      where: {
        company_id: company.id,
        product_id: In(products.map((product) => product.id)),
      },
      order: { version_number: 'DESC' },
    });
    const addonRepo = manager.getRepository(ProductAddonDefinition);
    const ruleRepo = manager.getRepository(ProductAddonRateRule);
    const rateBookRepo = manager.getRepository(PricingRateBook);
    let seeded = 0;

    for (const product of products) {
      const version = versions.find((item) => item.product_id === product.id);
      const rateBook = await rateBookRepo.findOne({
        where: {
          company_id: company.id,
          code: resolveMotorRateBookCode(product.product_code),
          version: MOTOR_RATE_BOOK_VERSION,
        },
      });
      if (!version || !rateBook) continue;

      for (const [index, seed] of ADDONS.entries()) {
        let definition = await addonRepo.findOne({
          where: { product_version_id: version.id, code: seed.code },
        });
        if (!definition) {
          definition = addonRepo.create({
            company_id: company.id,
            product_version_id: version.id,
            code: seed.code,
            tiramis_addon_code: seed.tiramis_addon_code,
            name: seed.name,
            description: seed.description,
            is_optional: true,
            is_default_selected: false,
            allows_separate_sum_insured: seed.allows_separate_sum_insured,
            maximum_quantity: 1,
            sort_order: seed.sort_order,
          });
          definition = await addonRepo.save(definition);
        }

        const ruleCode = `SAMPLE_${seed.code}`;
        let rule = await ruleRepo.findOne({
          where: { rate_book_id: rateBook.id, rule_code: ruleCode },
        });
        if (!rule) {
          const pricingFields =
            seed.pricing_type === AddonPricingType.PERCENTAGE
              ? { percentage_rate: seed.percentage_rate, fixed_amount: null }
              : { percentage_rate: null, fixed_amount: seed.fixed_amount };
          rule = ruleRepo.create({
            company_id: company.id,
            rate_book_id: rateBook.id,
            product_version_id: version.id,
            addon_definition_id: definition.id,
            rule_code: ruleCode,
            pricing_type: seed.pricing_type,
            ...pricingFields,
            per_unit_amount: null,
            per_unit_factor_code: null,
            minimum_amount: seed.minimum_amount,
            maximum_amount: seed.maximum_amount,
            effective_from: '2026-01-01',
            effective_to: null,
            priority: 100 + index,
            is_active: true,
            addon_snapshot: {
              code: seed.code,
              name: seed.name,
              description: seed.description,
              pricingType: seed.pricing_type,
              percentageRate:
                'percentage_rate' in seed ? seed.percentage_rate : null,
              fixedAmount: 'fixed_amount' in seed ? seed.fixed_amount : null,
              sample: true,
            },
          });
          await ruleRepo.save(rule);
        }
        seeded += 1;
      }
    }

    console.log(
      `[MotorAddonsSeeder] Ensured ${seeded} sample add-ons for ${company.name}.`,
    );
  }
}
