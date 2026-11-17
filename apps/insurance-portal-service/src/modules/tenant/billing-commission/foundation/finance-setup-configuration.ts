import { BadRequestException } from '@nestjs/common';
import {
  FinanceConfigurationInput,
  canonicalFinanceJson,
} from './finance-configuration.types';
import { setupObject, setupText, setupUuid } from './finance-setup.types';

/** Additional contracts for the four historically generic JSON configuration families. */
export function validateSetupConfiguration(input: FinanceConfigurationInput) {
  const p = input?.payload;
  function fail(message: string): never {
    throw new BadRequestException(message);
  }
  if (
    !input ||
    !['DIMENSIONS', 'POSTING_RULES', 'CURRENCY_RULES', 'TAX_RULES'].includes(
      input.kind,
    )
  )
    return;
  if (!setupObject(p)) fail('Explicit typed configuration is required.');
  if (Buffer.byteLength(canonicalFinanceJson(p)) > 200000)
    fail('Configuration exceeds the supported size.');
  if (p.schema !== `FINANCE_${input.kind}_V1`)
    fail('The configuration family requires its explicit versioned schema.');
  if (p.activationAuthorized !== false)
    fail('Setup configuration never authorizes activation.');
  if (input.kind === 'DIMENSIONS') {
    if (
      !Array.isArray(p.definitions) ||
      !p.definitions.length ||
      p.definitions.length > 100
    )
      fail('Specify dimension definitions.');
    const codes = new Set<string>();
    for (const d of p.definitions) {
      if (
        !setupObject(d) ||
        !setupText(d.code, 64) ||
        !/^[A-Z][A-Z0-9_]+$/.test(d.code) ||
        codes.has(d.code) ||
        !setupText(d.label, 120) ||
        !['ID', 'TEXT', 'DATE', 'CURRENCY'].includes(String(d.valueType)) ||
        typeof d.required !== 'boolean' ||
        !setupText(d.source, 200)
      )
        fail(
          'Dimension definitions need unique codes, labels, types, required flags and governed source references.',
        );
      codes.add(d.code);
      if (
        ['TENANT', 'LEGAL_ENTITY', 'BOOK'].includes(d.code) &&
        (d.valueType !== 'ID' || !d.required)
      )
        fail(
          'Tenant, legal entity and book dimensions must be mandatory governed IDs.',
        );
    }
    if (!['TENANT', 'LEGAL_ENTITY', 'BOOK'].every((code) => codes.has(code)))
      fail('Tenant, legal entity and book isolation dimensions are required.');
  }
  if (input.kind === 'POSTING_RULES') {
    if (!Array.isArray(p.rules) || !p.rules.length || p.rules.length > 500)
      fail('Specify the posting rule inventory.');
    const effects = new Set<string>();
    for (const rule of p.rules) {
      if (
        !setupObject(rule) ||
        !setupText(rule.economicEffectKey, 100) ||
        effects.has(rule.economicEffectKey) ||
        !setupText(rule.sourceEvent, 200) ||
        ![
          'OPERATIONAL',
          'BILLING_MEMORANDUM',
          'IFRS17_MEASUREMENT',
          'IFRS9',
          'IAS21',
        ].includes(String(rule.layer)) ||
        rule.postingAuthority !== 'FINANCE' ||
        typeof rule.enabled !== 'boolean' ||
        !Array.isArray(rule.policyReferences) ||
        !rule.policyReferences.length ||
        rule.policyReferences.some(
          (v: unknown) => typeof v !== 'string' || !/^AP-\d{2}\.\d{2}$/.test(v),
        ) ||
        !Array.isArray(rule.unresolvedDecisions) ||
        rule.unresolvedDecisions.some((v: unknown) => !setupText(v, 64))
      )
        fail(
          'Posting rules require unique economic effects, exact source/layer, Finance authority and explicit policy dependencies.',
        );
      effects.add(rule.economicEffectKey);
      if (rule.enabled)
        fail(
          'Setup posting rules must remain disabled; enablement needs a separate reviewed deployment configuration.',
        );
      if (rule.enabled && rule.unresolvedDecisions.length)
        fail('A rule with unresolved decisions must remain disabled.');
      if (
        rule.layer === 'BILLING_MEMORANDUM' &&
        rule.financialPosting !== false
      )
        fail('Billing memorandum events cannot create a financial journal.');
      if (
        rule.layer === 'IFRS17_MEASUREMENT' &&
        rule.measurementSource !== 'IFRS17_ENGINE'
      )
        fail(
          'Measurement movements must identify the independent approved measurement source.',
        );
      if (
        rule.financialPosting === true &&
        (!Array.isArray(rule.debitRoles) ||
          !rule.debitRoles.length ||
          !Array.isArray(rule.creditRoles) ||
          !rule.creditRoles.length)
      )
        fail('Postable rules need explicit debit and credit role vectors.');
      if (typeof rule.financialPosting !== 'boolean')
        fail('Specify whether each rule has a financial posting.');
    }
  }
  if (input.kind === 'TAX_RULES') {
    if (
      !['LEGACY_TAXES', 'PRODUCT_TAX_RULES'].includes(
        String(p.sourceTaxCatalogue),
      ) ||
      p.calculationOwner !== 'EXISTING_SOURCE_TAX_ENGINE' ||
      p.missingBreakdownTreatment !== 'BLOCK_POSTING' ||
      p.preserveCustomerPayable !== true ||
      !Array.isArray(p.sourceTaxRuleIds) ||
      !p.sourceTaxRuleIds.length ||
      p.sourceTaxRuleIds.some((v: unknown) => !setupUuid(v)) ||
      new Set(p.sourceTaxRuleIds).size !== p.sourceTaxRuleIds.length
    )
      fail(
        'Tax configuration must reference existing tax rules, preserve payable and block missing breakdowns.',
      );
    if ('rate' in p || 'rates' in p)
      fail(
        'Reuse configured source tax rules; do not create a second rate schedule.',
      );
  }
  if (input.kind === 'CURRENCY_RULES') {
    if (
      !setupText(p.assessmentReference, 200) ||
      typeof p.functionalCurrency !== 'string' ||
      !/^[A-Z]{3}$/.test(p.functionalCurrency) ||
      !Array.isArray(p.presentationCurrencies) ||
      !p.presentationCurrencies.length ||
      !Array.isArray(p.transactionCurrencies) ||
      !p.transactionCurrencies.length ||
      ![...p.presentationCurrencies, ...p.transactionCurrencies].every(
        (v) => typeof v === 'string' && /^[A-Z]{3}$/.test(v),
      ) ||
      !setupObject(p.currencyScales) ||
      !Array.isArray(p.rateSources) ||
      !p.rateSources.length ||
      p.rateSources.some((v: unknown) => !setupText(v, 100)) ||
      !Number.isSafeInteger(p.maximumRateAgeDays) ||
      Number(p.maximumRateAgeDays) < 0 ||
      !['REJECT_IMBALANCED', 'LARGEST_REMAINDER_HALF_UP'].includes(
        String(p.roundingMode),
      )
    )
      fail(
        'Currency configuration needs assessed currencies, exact precision, rate sources, age and rounding.',
      );
    const scales = p.currencyScales;
    for (const c of [
      p.functionalCurrency,
      ...p.presentationCurrencies,
      ...p.transactionCurrencies,
    ])
      if (
        !Number.isSafeInteger(scales[c]) ||
        Number(scales[c]) < 0 ||
        Number(scales[c]) > 12
      )
        fail(
          'Every configured currency needs an explicit supported decimal scale.',
        );
    if (p.fxOwnership !== 'ONE_OWNER_PER_EXPOSURE')
      fail('Assign FX ownership once per exposure and measurement component.');
  }
}
