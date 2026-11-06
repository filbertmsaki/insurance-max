import { DateTime } from 'luxon';

/** Expiry is exclusive: midnight after the 180th local calendar day. */
export function quotationOfferExpiry(finalizedAt: Date): Date {
  const finalized = DateTime.fromJSDate(finalizedAt, {
    zone: 'Africa/Dar_es_Salaam',
  });
  if (!finalized.isValid)
    throw new Error('Invalid quotation finalization date');
  return finalized.startOf('day').plus({ days: 180 }).toUTC().toJSDate();
}
