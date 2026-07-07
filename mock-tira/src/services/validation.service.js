const { CONFIG } = require('../config/mock-config');
const {
  BUSINESS_VALIDATION_RULES,
  DATE_TIME_FIELDS,
  DATE_ONLY_FIELDS,
  NUMERIC_FIELDS,
  THREE_LETTER_CODE_FIELDS,
  YES_NO_FIELDS,
} = require('../constants/validation-rules.constant');
const { RESPONSE_CODES } = require('../constants/response-codes.constant');
const { getTag, hasTag } = require('../utils/xml.util');

function validateDateTime(value) {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(String(value).trim());
}

function validateDateOnly(value) {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim());
}

function validateNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  return /^-?\d+(\.\d+)?$/.test(String(value).trim());
}

function validateBusinessXml(root, xml, endpointDefinition) {
  if (!CONFIG.enableBusinessValidation) {
    return {
      ok: true,
      errors: [],
      skipped: true,
    };
  }

  const rules = BUSINESS_VALIDATION_RULES[root];

  if (!rules) {
    return {
      ok: true,
      errors: [],
      skipped: true,
    };
  }

  const errors = [];

  if (root === 'MotorCoverNoteRefReq') {
    const serviceType = String(endpointDefinition?.serviceType || '').trim().toUpperCase();
    const isFleetEndpoint = serviceType === 'MOTOR_COVER_NOTE_FLEET';
    const isNonFleetEndpoint = serviceType === 'MOTOR_COVER_NOTE_NON_FLEET';

    if (isFleetEndpoint) {
      if (!hasTag(xml, 'FleetId')) {
        errors.push('Missing required tag: FleetId');
      }

      if (!hasTag(xml, 'FleetSize')) {
        errors.push('Missing required tag: FleetSize');
      }
    } else if (isNonFleetEndpoint) {
      if (!hasTag(xml, 'CoverNoteNumber')) {
        errors.push('Missing required tag: CoverNoteNumber');
      }
    } else {
      const hasCoverNoteNumber = hasTag(xml, 'CoverNoteNumber');
      const hasFleetId = hasTag(xml, 'FleetId');
      const hasFleetSize = hasTag(xml, 'FleetSize');

      if (!hasCoverNoteNumber && !(hasFleetId && hasFleetSize)) {
        errors.push('One of these tags is required: CoverNoteNumber, FleetId/FleetSize');
      }
    }
  }

  for (const tagName of rules.required || []) {
    if (!hasTag(xml, tagName)) {
      errors.push(`Missing required tag: ${tagName}`);
    }
  }

  for (const group of rules.anyOf || []) {
    if (root === 'MotorCoverNoteRefReq') {
      const serviceType = String(endpointDefinition?.serviceType || '').trim().toUpperCase();

      if (serviceType === 'MOTOR_COVER_NOTE_NON_FLEET') {
        continue;
      }

      if (serviceType === 'MOTOR_COVER_NOTE_FLEET') {
        const hasFleetId = hasTag(xml, 'FleetId');
        const hasFleetSize = hasTag(xml, 'FleetSize');

        if (!hasFleetId || !hasFleetSize) {
          errors.push('One of these tags is required: FleetId, FleetSize');
        }

        continue;
      }
    }

    const hasAny = group.some((tagName) => hasTag(xml, tagName));

    if (!hasAny) {
      errors.push(`One of these tags is required: ${group.join(', ')}`);
    }
  }

  for (const tagName of DATE_TIME_FIELDS) {
    if (hasTag(xml, tagName)) {
      const value = getTag(xml, tagName);

      if (!validateDateTime(value)) {
        errors.push(`${tagName} must be DateTime format YYYY-MM-DDTHH:mm:ss`);
      }
    }
  }

  for (const tagName of DATE_ONLY_FIELDS) {
    if (hasTag(xml, tagName)) {
      const value = getTag(xml, tagName);

      if (!validateDateOnly(value)) {
        errors.push(`${tagName} must be Date format YYYY-MM-DD`);
      }
    }
  }

  for (const tagName of NUMERIC_FIELDS) {
    if (hasTag(xml, tagName)) {
      const value = getTag(xml, tagName);

      if (!validateNumeric(value)) {
        errors.push(`${tagName} must be numeric`);
      }
    }
  }

  for (const tagName of THREE_LETTER_CODE_FIELDS) {
    if (hasTag(xml, tagName)) {
      const value = getTag(xml, tagName);

      if (!/^[A-Z]{3}$/i.test(String(value || '').trim())) {
        errors.push(`${tagName} must be a 3-letter code`);
      }
    }
  }

  for (const tagName of YES_NO_FIELDS) {
    if (hasTag(xml, tagName)) {
      const value = String(getTag(xml, tagName) || '').trim().toUpperCase();

      if (!['Y', 'N'].includes(value)) {
        errors.push(`${tagName} must be Y or N`);
      }
    }
  }

  if (root === 'ClaimPaymentReq' && hasTag(xml, 'PaymentMode')) {
    const value = String(getTag(xml, 'PaymentMode') || '').trim();

    if (!['1', '2', '3'].includes(value)) {
      errors.push('PaymentMode must be 1, 2, or 3');
    }
  }

  if (root === 'ClaimRejectionReq' && hasTag(xml, 'RejectionReason')) {
    const value = String(getTag(xml, 'RejectionReason') || '');

    if (value.length > 100) {
      errors.push('RejectionReason must not exceed 100 characters');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function buildValidationFailureDescription(errors) {
  if (!errors || errors.length === 0) {
    return RESPONSE_CODES.TIRA005;
  }

  return `${RESPONSE_CODES.TIRA005}: ${errors.join('; ')}`;
}

module.exports = {
  validateBusinessXml,
  buildValidationFailureDescription,
};
