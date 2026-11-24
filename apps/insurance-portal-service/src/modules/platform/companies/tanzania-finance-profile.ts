import { BadRequestException } from '@nestjs/common';
import {
  TANZANIA_PROFILE_FIELDS,
  type TanzaniaFinanceProfile,
} from '@insurance-max/contracts';

export function parseTanzaniaProfilePatch(
  value: unknown,
): TanzaniaFinanceProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException(
      'Supply the company profile fields to update.',
    );
  const clean: TanzaniaFinanceProfile = {};
  for (const [key, raw] of Object.entries(value)) {
    const spec = TANZANIA_PROFILE_FIELDS.find((f) => f.key === key);
    if (!spec)
      throw new BadRequestException('Unknown Tanzania company profile field.');
    if (raw === null || raw === '') {
      clean[key] = null;
      continue;
    }
    if (typeof raw !== 'string')
      throw new BadRequestException('Invalid ' + spec.label);
    const text = raw.trim();
    if (
      !text ||
      text.length > (spec.max ?? 500) ||
      (spec.options && !spec.options.includes(text)) ||
      (spec.max === 2 && !/^[A-Z]{2}$/.test(text)) ||
      (spec.date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(text) ||
          !Number.isFinite(Date.parse(text)) ||
          new Date(text).toISOString().slice(0, 10) !== text))
    )
      throw new BadRequestException('Invalid ' + spec.label);
    clean[key] = text;
  }
  return clean;
}
