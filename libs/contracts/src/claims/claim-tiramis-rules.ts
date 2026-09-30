import { ClaimRegulatoryOperationType } from './claim.enums';

/**
 * Field rules for the TIRAMIS v1.3 claim messages (§9–14), shared by the
 * portal (before a submission is queued) and the gateway (before the XML is
 * signed), so both reject the same payloads with the same messages.
 *
 * Payload keys are the camelCase gateway DTO fields that map 1:1 onto the
 * XML tags. Header fields (codes, callback URL) are resolved server-side and
 * are not checked here. Lengths follow the String(n) sizes in the spec.
 */

type Payload = Record<string, unknown>;

const ID_TYPES = [1, 2, 3, 4, 5, 6, 7];
const YES_NO = ['Y', 'N'];

export function validateClaimTiramisPayload(
  type: ClaimRegulatoryOperationType,
  payload: Payload,
): string[] {
  const rules = new ClaimRules(payload);

  switch (type) {
    case ClaimRegulatoryOperationType.NOTIFICATION:
      // §9.1 ClaimNotificationRefReq
      rules.text('claimNotificationNumber', 50);
      rules.text('coverNoteReferenceNumber', 50);
      rules.dateTime('claimReportDate');
      rules.oneOf('claimFormDullyFilled', YES_NO);
      rules.dateTime('lossDate');
      rules.notAfter('lossDate', 'claimReportDate'); // TIRA079
      rules.text('lossNature', 100);
      rules.text('lossType', 100);
      rules.text('lossLocation', 100);
      rules.text('officerName', 100);
      rules.text('officerTitle', 100);
      break;

    case ClaimRegulatoryOperationType.INTIMATION:
      // §10.1 ClaimIntimationReq
      rules.text('claimIntimationNumber', 50);
      rules.text('claimReferenceNumber', 50);
      rules.text('coverNoteReferenceNumber', 50);
      rules.dateTime('claimIntimationDate');
      rules.money('claimEstimatedAmount');
      rules.money('claimReserveAmount');
      rules.currency();
      rules.text('claimReserveMethod', 100);
      rules.oneOf('lossAssessmentOption', [1, 2]);
      rules.text('assessorName', 100);
      rules.text('assessorIdNumber', 50);
      rules.oneOf('assessorIdType', ID_TYPES);
      rules.claimants('full');
      break;

    case ClaimRegulatoryOperationType.ASSESSMENT:
      // §11.1 ClaimAssessmentReq
      rules.text('claimAssessmentNumber', 50);
      rules.text('claimIntimationNumber', 50);
      rules.text('claimReferenceNumber', 50);
      rules.text('coverNoteReferenceNumber', 50);
      rules.dateTime('assessmentReceivedDate');
      rules.text('assessmentReportSummary', 1000);
      rules.currency();
      rules.money('assessmentAmount');
      rules.money('approvedClaimAmount');
      rules.dateTime('claimApprovalDate');
      rules.notAfter('assessmentReceivedDate', 'claimApprovalDate'); // TIRA065
      rules.text('claimApprovalAuthority', 100);
      rules.oneOf('isReAssessment', YES_NO);
      rules.claimants('identity');
      break;

    case ClaimRegulatoryOperationType.DISCHARGE_VOUCHER:
      // §12.1 DischargeVoucherReq. The voucher is reported once the claimant
      // has responded, so the offer and response fields are always present.
      // Every adjustment and reconciliation tag is mandatory and TIRA rejects
      // empty ones (TIRA005); without either, "no adjustment" of 0 and the
      // offer amount as reconciled are reported.
      rules.text('dischargeVoucherNumber', 50);
      rules.text('claimAssessmentNumber', 50);
      rules.text('claimReferenceNumber', 50);
      rules.text('coverNoteReferenceNumber', 50);
      rules.dateTime('dischargeVoucherDate');
      rules.currency();
      rules.dateTime('claimOfferCommunicationDate');
      rules.money('claimOfferAmount');
      rules.dateTime('claimantResponseDate');
      rules.notAfter('claimOfferCommunicationDate', 'claimantResponseDate'); // TIRA198
      rules.oneOf('offerAccepted', YES_NO);
      rules.dateTime('adjustmentDate');
      rules.text('adjustmentReason', 1000);
      rules.money('adjustmentAmount');
      rules.dateTime('reconciliationDate');
      rules.text('reconciliationSummary', 1000);
      rules.money('reconciledAmount');
      rules.claimants('identity');
      break;

    case ClaimRegulatoryOperationType.PAYMENT:
      // §13.1 ClaimPaymentReq
      rules.text('claimPaymentNumber', 50);
      rules.text('claimReferenceNumber', 50);
      rules.text('claimIntimationNumber', 50);
      rules.text('coverNoteReferenceNumber', 50);
      rules.dateTime('paymentDate');
      rules.money('paidAmount', { positive: true }); // TIRA075
      rules.oneOf('paymentMode', [1, 2, 3]);
      rules.oneOf('partiesNotified', YES_NO);
      rules.money('netPremiumEarned');
      rules.oneOf('claimResultedLitigation', YES_NO);
      // Mandatory and non-empty even without litigation: TIRA refuses an
      // empty or missing tag (TIRA005); "None" is used then (TIRA094).
      rules.text('litigationReason', 1000);
      rules.currency();
      rules.claimants('identity');
      break;

    case ClaimRegulatoryOperationType.REJECTION:
      // §14.1 ClaimRejectionReq
      rules.text('claimRejectionNumber', 50);
      rules.text('claimReferenceNumber', 50);
      rules.text('claimIntimationNumber', 50);
      rules.text('coverNoteReferenceNumber', 50);
      rules.dateTime('rejectionDate');
      rules.text('rejectionReason', 100);
      rules.oneOf('claimResultedLitigation', YES_NO);
      rules.money('claimAmount');
      rules.currency();
      rules.claimants('identity');
      break;
  }

  return rules.errors;
}

class ClaimRules {
  readonly errors: string[] = [];
  private readonly payload: Payload;

  // No parameter property: the web app compiles contracts with
  // `erasableSyntaxOnly`.
  constructor(payload: Payload) {
    this.payload = payload;
  }

  text(
    field: string,
    max: number,
    source: Payload = this.payload,
    path = field,
  ) {
    const value = source[field];

    if (isBlank(value)) {
      this.errors.push(`${path} is required`);
      return;
    }

    if (String(value).length > max) {
      this.errors.push(`${path} must not exceed ${max} characters`);
    }
  }

  maxLength(
    field: string,
    max: number,
    source: Payload = this.payload,
    path = field,
  ) {
    const value = source[field];

    if (!isBlank(value) && String(value).length > max) {
      this.errors.push(`${path} must not exceed ${max} characters`);
    }
  }

  oneOf(
    field: string,
    allowed: Array<string | number>,
    source: Payload = this.payload,
    path = field,
  ) {
    const value = source[field];

    if (isBlank(value)) {
      this.errors.push(`${path} is required`);
      return;
    }

    const normalized = String(value).trim().toUpperCase();

    if (!allowed.some((option) => String(option) === normalized)) {
      this.errors.push(`${path} must be one of ${allowed.join(', ')}`);
    }
  }

  dateTime(field: string, source: Payload = this.payload, path = field) {
    const value = source[field];

    if (isBlank(value)) {
      this.errors.push(`${path} is required`);
      return;
    }

    if (parseDate(value) === null) {
      this.errors.push(`${path} must be a valid date`);
    }
  }

  /** Both dates optional here; presence is checked by dateTime(). */
  notAfter(earlierField: string, laterField: string) {
    const earlier = parseDate(this.payload[earlierField]);
    const later = parseDate(this.payload[laterField]);

    if (earlier !== null && later !== null && earlier > later) {
      this.errors.push(`${earlierField} must not be after ${laterField}`);
    }
  }

  money(field: string, options: { positive?: boolean } = {}) {
    const value = this.payload[field];

    if (isBlank(value)) {
      this.errors.push(`${field} is required`);
      return;
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
      this.errors.push(`${field} must be a non-negative amount`);
    } else if (options.positive && amount <= 0) {
      this.errors.push(`${field} must be greater than zero`);
    }
  }

  currency() {
    const code = this.payload.currencyCode;

    if (isBlank(code)) {
      this.errors.push('currencyCode is required');
    } else if (!/^[A-Z]{3}$/.test(String(code))) {
      this.errors.push('currencyCode must be a 3-letter ISO 4217 code');
    }

    const rate = this.payload.exchangeRate;

    if (isBlank(rate)) {
      this.errors.push('exchangeRate is required');
    } else if (!(Number(rate) > 0)) {
      this.errors.push('exchangeRate must be greater than zero'); // TIRA028
    }
  }

  /** Runs the checks only when at least one of the fields is filled. */
  allOrNone(checks: Array<() => void>, fields: string[]) {
    if (fields.some((field) => !isBlank(this.payload[field]))) {
      checks.forEach((check) => check());
    }
  }

  upper(field: string): string {
    return String(this.payload[field] ?? '')
      .trim()
      .toUpperCase();
  }

  claimants(form: 'full' | 'identity') {
    const claimants = this.payload.claimants;

    if (!Array.isArray(claimants) || claimants.length === 0) {
      this.errors.push('claimants must contain at least one claimant');
      return;
    }

    claimants.forEach((raw, index) => {
      const claimant = (raw ?? {}) as Payload;
      const path = (field: string) => `claimants[${index}].${field}`;

      this.oneOf(
        'claimantCategory',
        [1, 2],
        claimant,
        path('claimantCategory'),
      );
      this.oneOf('claimantType', [1, 2], claimant, path('claimantType'));
      this.text('claimantIdNumber', 50, claimant, path('claimantIdNumber'));
      this.oneOf('claimantIdType', ID_TYPES, claimant, path('claimantIdType'));

      if (form === 'identity') {
        return;
      }

      // §10.1 full claimant record.
      this.text('claimantName', 100, claimant, path('claimantName'));

      if (
        !isBlank(claimant.claimantBirthDate) &&
        parseDate(claimant.claimantBirthDate) === null
      ) {
        this.errors.push(`${path('claimantBirthDate')} must be a valid date`);
      }

      // Gender is mandatory for individuals and optional for corporates.
      if (String(claimant.claimantType) === '1' || !isBlank(claimant.gender)) {
        this.oneOf('gender', ['M', 'F'], claimant, path('gender'));
      }

      if (isBlank(claimant.countryCode)) {
        this.errors.push(`${path('countryCode')} is required`);
      } else if (!/^[A-Z]{3}$/.test(String(claimant.countryCode))) {
        this.errors.push(
          `${path('countryCode')} must be an ISO 3166 alpha-3 code`,
        );
      }

      this.maxLength('region', 50, claimant, path('region'));
      this.text('district', 100, claimant, path('district'));
      this.maxLength('street', 100, claimant, path('street'));
      this.text(
        'claimantPhoneNumber',
        50,
        claimant,
        path('claimantPhoneNumber'),
      );
      this.maxLength('claimantFax', 50, claimant, path('claimantFax'));
      this.maxLength('postalAddress', 50, claimant, path('postalAddress'));
      this.maxLength('emailAddress', 50, claimant, path('emailAddress'));
    });
  }
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function parseDate(value: unknown): number | null {
  if (isBlank(value)) {
    return null;
  }

  const time = new Date(value as string).getTime();

  return Number.isNaN(time) ? null : time;
}
