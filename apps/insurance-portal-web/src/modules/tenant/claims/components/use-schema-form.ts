import { useForm, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';

/** useForm validated by a zod schema whose input and output types match. */
export function useSchemaForm<TValues extends FieldValues>(
  schema: ZodType<TValues, TValues>,
  defaultValues: TValues,
) {
  return useForm<TValues>({
    // zodResolver's overloads need the concrete schema type.
    resolver: zodResolver(schema as never),
    defaultValues: defaultValues as never,
  });
}
