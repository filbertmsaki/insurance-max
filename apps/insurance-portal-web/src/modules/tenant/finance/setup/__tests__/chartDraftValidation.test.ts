import { describe, expect, it } from 'vitest';
import { chartDraftIssue } from '../chartDraftValidation';

describe('chart draft validation', () => {
  const heading = {
    code: '1000',
    type: 'ASSET',
    posting: false,
    control: false,
    parentCode: null,
  };
  const cash = {
    code: '1100',
    type: 'ASSET',
    posting: true,
    control: false,
    parentCode: '1000',
  };
  const bank = {
    code: 'BANK',
    accountCode: '1100',
    accountType: 'ASSET',
    dimensionsText: 'BRANCH, CURRENCY',
    dependenciesText: 'DEC-01, DEC-05',
  };

  it('accepts an explicit heading, account and role', () => {
    expect(chartDraftIssue([heading, cash], [bank])).toBeNull();
  });
  it('rejects a removed parent or a cycle', () => {
    expect(chartDraftIssue([cash], [bank])).toContain(
      'existing, nonposting parent',
    );
    expect(
      chartDraftIssue([{ ...heading, parentCode: '1000' }, cash], [bank]),
    ).toContain('without a cycle');
  });
  it('rejects stale role references and duplicate account or dimension codes', () => {
    expect(
      chartDraftIssue([heading, cash], [{ ...bank, accountCode: '1200' }]),
    ).toContain('current posting account');
    expect(chartDraftIssue([heading, cash, cash], [bank])).toContain(
      'unique uppercase',
    );
    expect(
      chartDraftIssue(
        [heading, cash],
        [{ ...bank, dimensionsText: 'CURRENCY,CURRENCY' }],
      ),
    ).toContain('unique, valid');
  });
  it('holds unresolved tax roles rather than allowing assignment', () => {
    expect(
      chartDraftIssue(
        [heading, cash],
        [{ ...bank, code: 'NEW-VAT-WH-CREDIT' }],
      ),
    ).toContain('remain unassigned');
  });
});
