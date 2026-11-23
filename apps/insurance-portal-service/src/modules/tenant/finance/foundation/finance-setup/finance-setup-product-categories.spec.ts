import { FinanceSetupService } from './finance-setup.service';
import { financeConfigurationHash } from '../finance-configuration/finance-configuration.types';

it('keeps historical legal-scope evidence unchanged when category labels are added to inventory', () => {
  const service = Object.create(FinanceSetupService.prototype) as any;
  const input = { step: 'G04-01' };
  const inventory = {
    company: { id: 'company' },
    products: [{ id: 'product', product_code: 'P1' }],
  };
  const previous = service.sourceSnapshot(input, inventory);
  const current = service.sourceSnapshot(input, {
    ...inventory,
    productCategories: [
      {
        product_id: 'product',
        category_id: 'category',
        category_name: 'Motor',
      },
    ],
  });
  expect(financeConfigurationHash(current)).toBe(
    financeConfigurationHash(previous),
  );
});
