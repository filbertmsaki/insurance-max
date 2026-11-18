import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  setupInput,
  setupAnswerIssues,
  type FinanceSetupInput,
} from './finance-setup.types';
import { validateSetupConfiguration } from './finance-setup-configuration';
import { FINANCE_SETUP_CATALOG } from './finance-setup.catalog';
import type { FinanceConfigurationInput } from '../finance-configuration/finance-configuration.types';

const draft = (): FinanceSetupInput => ({
  purpose: 'COMPANY_SETUP',
  step: 'G04-01',
  version: 1,
  effectiveFrom: null,
  effectiveTo: null,
  answers: {},
  dependencies: [],
  evidence: [],
});
const evidence = () => ({
  id: randomUUID(),
  documentId: randomUUID(),
  hash: 'a'.repeat(64),
  purpose: 'LICENCE',
});
describe('Company setup input and completion boundaries', () => {
  it('preserves an incomplete draft without inventing dates, identities or accounting decisions', () => {
    const d = setupInput(draft());
    expect(d.effectiveFrom).toBeNull();
    expect(d.answers).toEqual({});
    expect(setupAnswerIssues(d)).toEqual(
      expect.arrayContaining([
        'Choose the actual effective date.',
        'Attach owned, available document-version evidence.',
      ]),
    );
  });
  it.each([
    { ...draft(), step: 'G04-11' },
    { ...draft(), version: 0 },
    { ...draft(), version: 1.2 },
    { ...draft(), effectiveFrom: '2026-02-30' },
    { ...draft(), effectiveFrom: '2026-11-16', effectiveTo: '2026-11-16' },
    { ...draft(), tenantId: randomUUID() },
    { ...draft(), purpose: 'APPROVED_COMPANY' },
    { ...draft(), dependencies: [{ id: randomUUID(), hash: 'unknown' }] },
    { ...draft(), evidence: [{ ...evidence(), documentId: null }] },
  ])('rejects malformed inputs rather than coercing them', (v) =>
    expect(() => setupInput(v)).toThrow(BadRequestException),
  );
  it('rejects duplicate dependency pins', () => {
    const pin = { id: randomUUID(), hash: 'b'.repeat(64) };
    expect(() => setupInput({ ...draft(), dependencies: [pin, pin] })).toThrow(
      BadRequestException,
    );
  });
  it('allows the same combined legal document for distinct purposes but not duplicate purpose entries', () => {
    const e = evidence();
    expect(
      setupInput({ ...draft(), evidence: [e, { ...e, purpose: 'TIN' }] })
        .evidence,
    ).toHaveLength(2);
    expect(() => setupInput({ ...draft(), evidence: [e, e] })).toThrow(
      BadRequestException,
    );
  });
  it('bounds payload size and depth before canonicalizing untrusted input', () => {
    expect(() =>
      setupInput({ ...draft(), answers: { oversize: 'x'.repeat(250000) } }),
    ).toThrow(BadRequestException);
    let nested: unknown = {};
    for (let i = 0; i < 20; i++) nested = { nested };
    expect(() => setupInput({ ...draft(), answers: { nested } })).toThrow(
      BadRequestException,
    );
  });
  it('rejects missing currencies and precision instead of treating the application currency as an assessment', () => {
    const issues = setupAnswerIssues({
      ...draft(),
      step: 'G04-03',
      answers: { accountingBasis: 'IFRS', functionalCurrency: 'TZS' },
    });
    expect(issues).toContain('Provide the functional currency assessment.');
    expect(issues).toContain('Specify precision for every selected currency.');
  });
  it.each(
    [
      [
        { code: 'P1', from: '2026-01-01', to: '2026-02-01' },
        { code: 'P2', from: '2026-01-31', to: '2026-03-01' },
      ],
      [
        { code: 'P1', from: '2026-01-01', to: '2026-02-01' },
        { code: 'P2', from: '2026-02-02', to: '2026-03-01' },
      ],
      [
        { code: 'P1', from: '2026-01-01', to: '2026-02-01' },
        { code: 'P1', from: '2026-02-01', to: '2026-03-01' },
      ],
    ].map((periods) => [periods]),
  )('rejects overlapping, gapped or duplicate financial periods', (periods) =>
    expect(
      setupAnswerIssues({ ...draft(), step: 'G04-04', answers: { periods } }),
    ).toContain(
      'Calendar periods require unique codes and contiguous, nonoverlapping exclusive-end intervals.',
    ),
  );
  it('does not accept activation as setup completion', () =>
    expect(
      setupAnswerIssues({
        ...draft(),
        step: 'G04-10',
        answers: { acceptedScope: 'LIVE', activationAuthorized: true },
      }),
    ).toContain(
      'Completion applies only to inactive setup review, without activation authority.',
    ));
  it('keeps the complete 33-module policy and decision baseline', () => {
    expect(FINANCE_SETUP_CATALOG.policies).toHaveLength(70);
    expect(FINANCE_SETUP_CATALOG.decisions).toHaveLength(126);
    expect(
      new Set(FINANCE_SETUP_CATALOG.policies.map((p) => p.module)).size,
    ).toBe(33);
    expect(new Set(FINANCE_SETUP_CATALOG.decisions.map((d) => d.id)).size).toBe(
      126,
    );
  });
});
describe('Typed inactive configuration semantics', () => {
  const input = (
    kind: FinanceConfigurationInput['kind'],
    payload: Record<string, unknown>,
  ) => ({ kind, payload }) as FinanceConfigurationInput;
  const rule = () => ({
    economicEffectKey: 'DEMO-EFFECT',
    sourceEvent: 'demo.invoice.v1',
    layer: 'OPERATIONAL',
    postingAuthority: 'FINANCE',
    enabled: false,
    financialPosting: false,
    policyReferences: ['AP-07.01'],
    unresolvedDecisions: ['DEC-01'],
  });
  it('rejects generic JSON as posting-rule evidence', () =>
    expect(() =>
      validateSetupConfiguration(input('POSTING_RULES', { schemaVersion: 1 })),
    ).toThrow(BadRequestException));
  it('prevents enabled rules with unresolved decisions', () =>
    expect(() =>
      validateSetupConfiguration(
        input('POSTING_RULES', {
          schema: 'FINANCE_POSTING_RULES_V1',
          activationAuthorized: false,
          rules: [{ ...rule(), enabled: true }],
        }),
      ),
    ).toThrow(BadRequestException));
  it('prevents duplicate economic effects across operational and measurement layers', () =>
    expect(() =>
      validateSetupConfiguration(
        input('POSTING_RULES', {
          schema: 'FINANCE_POSTING_RULES_V1',
          activationAuthorized: false,
          rules: [
            rule(),
            {
              ...rule(),
              layer: 'IFRS17_MEASUREMENT',
              measurementSource: 'IFRS17_ENGINE',
            },
          ],
        }),
      ),
    ).toThrow(BadRequestException));
  it('rejects a billing memorandum that attempts a financial posting', () =>
    expect(() =>
      validateSetupConfiguration(
        input('POSTING_RULES', {
          schema: 'FINANCE_POSTING_RULES_V1',
          activationAuthorized: false,
          rules: [
            { ...rule(), layer: 'BILLING_MEMORANDUM', financialPosting: true },
          ],
        }),
      ),
    ).toThrow(BadRequestException));
  it('preserves a disabled unresolved proposal without granting posting authority', () =>
    expect(() =>
      validateSetupConfiguration(
        input('POSTING_RULES', {
          schema: 'FINANCE_POSTING_RULES_V1',
          activationAuthorized: false,
          rules: [rule()],
        }),
      ),
    ).not.toThrow());
  it('requires mandatory tenant/entity/book dimension isolation', () =>
    expect(() =>
      validateSetupConfiguration(
        input('DIMENSIONS', {
          schema: 'FINANCE_DIMENSIONS_V1',
          activationAuthorized: false,
          definitions: [
            {
              code: 'BRANCH',
              label: 'Branch',
              valueType: 'ID',
              required: true,
              source: 'SOURCE_BRANCH',
            },
          ],
        }),
      ),
    ).toThrow(BadRequestException));
  it('rejects duplicated source tax rules and duplicated rate schedules', () => {
    const id = randomUUID(),
      tax = {
        schema: 'FINANCE_TAX_RULES_V1',
        activationAuthorized: false,
        sourceTaxCatalogue: 'LEGACY_TAXES',
        calculationOwner: 'EXISTING_SOURCE_TAX_ENGINE',
        missingBreakdownTreatment: 'BLOCK_POSTING',
        preserveCustomerPayable: true,
        sourceTaxRuleIds: [id],
      };
    expect(() =>
      validateSetupConfiguration(input('TAX_RULES', tax)),
    ).not.toThrow();
    expect(() =>
      validateSetupConfiguration(
        input('TAX_RULES', { ...tax, sourceTaxRuleIds: [id, id] }),
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validateSetupConfiguration(input('TAX_RULES', { ...tax, rate: '0.18' })),
    ).toThrow(BadRequestException);
  });
});
