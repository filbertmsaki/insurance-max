import { BadRequestException } from '@nestjs/common';
import {
  validateFinanceChart,
  type FinanceChartProposal,
} from './finance-chart.types';

const dependencies = ['DEC-01', 'DEC-05', 'DEC-06', 'DEC-12', 'DEC-15'];
const chart = (): FinanceChartProposal => ({
  schema: 'FINANCE_CHART_V1',
  chartCode: 'TEST',
  supportedProfiles: ['GENERAL_INSURER'],
  accounts: [
    {
      code: '100000',
      name: 'Asset heading',
      type: 'ASSET',
      normalBalance: 'DR',
      posting: false,
      control: false,
      parentCode: null,
    },
    {
      code: '110110',
      name: 'Draft bank',
      type: 'ASSET',
      normalBalance: 'DR',
      posting: true,
      control: false,
      parentCode: '100000',
    },
    {
      code: '120190',
      name: 'Draft contra asset',
      type: 'ASSET',
      normalBalance: 'CR',
      posting: true,
      control: false,
      parentCode: '100000',
    },
  ],
  roles: [
    {
      code: 'BANK_OPERATING',
      accountCode: '110110',
      accountType: 'ASSET',
      requiredDimensions: ['CURRENCY', 'BANK_ACCOUNT'],
      dependencyRefs: ['DEC-05'],
    },
    {
      code: 'LOSS_ALLOWANCE',
      accountCode: '120190',
      accountType: 'ASSET',
      requiredDimensions: ['COUNTERPARTY'],
      dependencyRefs: ['DEC-15'],
    },
    {
      code: 'NEW-VAT-WH-AP',
      accountCode: null,
      accountType: 'LIABILITY',
      requiredDimensions: [],
      dependencyRefs: ['DEC-06'],
    },
  ],
  legacy: { mode: 'UNBOUND', reason: 'Actual source records not supplied' },
});

describe('Typed inactive chart proposal', () => {
  it('retains contra-account normal balance and unassigned roles without treating missing source data as zero', () => {
    const result = validateFinanceChart(
      chart(),
      'GENERAL_INSURER',
      dependencies,
    );
    expect(
      result.accounts.find((a) => a.code === '120190')?.normalBalance,
    ).toBe('CR');
    expect(
      result.roles.find((r) => r.code === 'NEW-VAT-WH-AP')?.accountCode,
    ).toBeNull();
    expect(result.legacy).toEqual({
      mode: 'UNBOUND',
      reason: 'Actual source records not supplied',
    });
  });

  it.each([
    [
      'duplicate account',
      (p: FinanceChartProposal) => p.accounts.push({ ...p.accounts[0] }),
    ],
    [
      'missing parent',
      (p: FinanceChartProposal) => {
        p.accounts[1].parentCode = 'UNKNOWN';
      },
    ],
    [
      'cycle',
      (p: FinanceChartProposal) => {
        p.accounts[0].parentCode = '100000';
      },
    ],
    [
      'posting parent',
      (p: FinanceChartProposal) => {
        p.accounts[2].parentCode = '110110';
      },
    ],
    [
      'heading role',
      (p: FinanceChartProposal) => {
        p.roles[0].accountCode = '100000';
      },
    ],
    [
      'wrong target type',
      (p: FinanceChartProposal) => {
        p.roles[0].accountType = 'LIABILITY';
      },
    ],
    [
      'duplicate role',
      (p: FinanceChartProposal) => p.roles.push({ ...p.roles[0] }),
    ],
    [
      'undeclared dependency',
      (p: FinanceChartProposal) => p.roles[0].dependencyRefs.push('DEC-19'),
    ],
    [
      'duplicate dimension',
      (p: FinanceChartProposal) =>
        p.roles[0].requiredDimensions.push('CURRENCY'),
    ],
    [
      'control heading',
      (p: FinanceChartProposal) => {
        p.accounts[0].control = true;
      },
    ],
    [
      'blank name',
      (p: FinanceChartProposal) => {
        p.accounts[0].name = ' ';
      },
    ],
    [
      'unknown schema',
      (p: FinanceChartProposal) => {
        (p as unknown as { schema: string }).schema = 'UNKNOWN';
      },
    ],
    [
      'unsupported profile',
      (p: FinanceChartProposal) => {
        p.supportedProfiles = ['BROKER'];
      },
    ],
    [
      'unjustified unbound source',
      (p: FinanceChartProposal) => {
        p.legacy = { mode: 'UNBOUND', reason: '' };
      },
    ],
  ])('rejects %s before a chart can be reviewed', (_name, mutate) => {
    const proposal = chart();
    mutate(proposal);
    expect(() =>
      validateFinanceChart(proposal, 'GENERAL_INSURER', dependencies),
    ).toThrow(BadRequestException);
  });

  it('requires the original recognition, tax and legacy-adoption gates', () => {
    expect(() =>
      validateFinanceChart(chart(), 'GENERAL_INSURER', ['DEC-05', 'DEC-15']),
    ).toThrow(BadRequestException);
  });

  it.each(['NEW-VAT-WH-AP', 'NEW-VAT-WH-CREDIT', 'NEW-LEVY-CREDIT'])(
    'keeps unresolved tax role %s unassigned',
    (roleCode) => {
      const proposal = chart();
      proposal.roles[2] = {
        ...proposal.roles[2],
        code: roleCode,
        accountType: 'ASSET',
        accountCode: '110110',
      };
      expect(() =>
        validateFinanceChart(proposal, 'GENERAL_INSURER', dependencies),
      ).toThrow(BadRequestException);
    },
  );

  it('rejects duplicate source IDs even when case differs', () => {
    const proposal = chart(),
      id = 'abcdef12-0000-4000-8000-000000000001';
    proposal.legacy = {
      mode: 'SCOPED_INVENTORY',
      sourceMapId: id,
      emptyInventoryReason: null,
      dispositions: [
        {
          sourceAccountId: id,
          state: 'HELD',
          roleCode: null,
          reason: 'held one',
        },
        {
          sourceAccountId: id.toUpperCase(),
          state: 'HELD',
          roleCode: null,
          reason: 'held two',
        },
      ],
    };
    expect(() =>
      validateFinanceChart(proposal, 'GENERAL_INSURER', dependencies),
    ).toThrow(BadRequestException);
  });

  it('does not accept a pre-captured snapshot as a caller chart proposal', () => {
    expect(() =>
      validateFinanceChart(
        {
          schema: 'FINANCE_CHART_SNAPSHOT_V1',
          proposal: chart(),
          legacyObservation: {},
        },
        'GENERAL_INSURER',
        dependencies,
      ),
    ).toThrow(BadRequestException);
  });
});
