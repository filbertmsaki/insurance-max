import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Accepts a non-negative number or numeric string (money fields on these DTOs
 * are typed `number | string | null` since services normalize either shape).
 * `null`/`undefined` pass through — pair with @IsOptional() for optional fields.
 */
export function IsNonNegativeMoney(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNonNegativeMoney',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined) {
            return true;
          }
          if (typeof value !== 'number' && typeof value !== 'string') {
            return false;
          }
          const numeric = Number(value);
          return !Number.isNaN(numeric) && numeric >= 0;
        },
        defaultMessage() {
          return '$property must be a non-negative number';
        },
      },
    });
  };
}
