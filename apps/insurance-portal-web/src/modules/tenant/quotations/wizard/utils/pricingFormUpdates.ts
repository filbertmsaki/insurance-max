import type { FieldPath, FieldPathValue, UseFormReturn } from 'react-hook-form';
import type { QuotationFormSchemaValues } from '../../schemas';
import { isEqualNormalizingNumbers } from './premiumAggregation';

/** Update computed cells without replacing field-array rows. Replacing an
 * array makes React Hook Form generate new row IDs and unmount open selects. */
export function setPricingFormValue<
  TName extends FieldPath<QuotationFormSchemaValues>,
>(
  form: UseFormReturn<QuotationFormSchemaValues>,
  name: TName,
  value: FieldPathValue<QuotationFormSchemaValues, TName>,
): void {
  const current = form.getValues(name);
  if (isEqualNormalizingNumbers(current, value)) return;
  if (
    Array.isArray(current) &&
    Array.isArray(value) &&
    current.length === value.length
  ) {
    value.forEach((row: unknown, index: number) => {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        for (const [key, cell] of Object.entries(row)) {
          const cellPath =
            `${name}.${index}.${key}` as FieldPath<QuotationFormSchemaValues>;
          setPricingFormValue(
            form,
            cellPath,
            cell as FieldPathValue<QuotationFormSchemaValues, typeof cellPath>,
          );
        }
      }
    });
    return;
  }
  form.setValue(name, value);
}
