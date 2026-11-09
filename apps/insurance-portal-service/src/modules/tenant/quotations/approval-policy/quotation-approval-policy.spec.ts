import {
  approvalScopeViolation,
  autoPaymentRequestSource,
  directApprovalViolation,
  matchAutoApprovalRule,
  normalizeApprovalPolicy,
  type ApprovalFacts,
} from './quotation-approval-policy';

const cashFacts: ApprovalFacts = {
  payment_mode: 1,
  product_id: 'product-1',
  quotation_flow: 'MOTOR_SINGLE',
  branch_id: 'branch-1',
  risk_codes: ['SP014001000007'],
  total_premium: 500_000,
  max_discount_percent: 10,
};

describe('quotation approval policy', () => {
  it('defaults to nothing enabled', () => {
    const policy = normalizeApprovalPolicy(undefined);
    expect(policy.auto_approval.enabled).toBe(false);
    expect(policy.direct_approval.enabled).toBe(false);
    expect(matchAutoApprovalRule(policy, cashFacts)).toBeNull();
    expect(directApprovalViolation(policy, 'user-1', cashFacts)).toMatch(
      /not enabled/,
    );
  });

  it('keeps one entry per approver and drops entries without a user', () => {
    const policy = normalizeApprovalPolicy({
      direct_approval: {
        enabled: true,
        approvers: [
          { user_id: 'user-1', max_total_premium: 100 },
          { user_id: 'user-1', max_total_premium: 999 },
          { user_id: '' },
        ],
      },
    });
    expect(policy.direct_approval.approvers).toHaveLength(1);
    expect(policy.direct_approval.approvers[0].max_total_premium).toBe(100);
  });

  it('checks every configured limit; empty lists mean any', () => {
    const scope = normalizeApprovalPolicy({
      auto_approval: { rules: [{}] },
    }).auto_approval.rules[0];
    expect(approvalScopeViolation(scope, cashFacts)).toBeNull();
    expect(
      approvalScopeViolation({ ...scope, payment_modes: [3] }, cashFacts),
    ).toMatch(/payment method/);
    expect(
      approvalScopeViolation({ ...scope, product_ids: ['other'] }, cashFacts),
    ).toMatch(/product/);
    expect(
      approvalScopeViolation(
        { ...scope, quotation_flows: ['MOTOR_FLEET'] },
        cashFacts,
      ),
    ).toMatch(/quotation type/);
    expect(
      approvalScopeViolation({ ...scope, branch_ids: ['branch-2'] }, cashFacts),
    ).toMatch(/branch/);
    expect(
      approvalScopeViolation(
        { ...scope, max_total_premium: 499_999 },
        cashFacts,
      ),
    ).toMatch(/premium/);
    expect(
      approvalScopeViolation({ ...scope, max_discount_percent: 5 }, cashFacts),
    ).toMatch(/discount/);
  });

  it('auto-approves on the first enabled matching rule only', () => {
    const policy = normalizeApprovalPolicy({
      auto_approval: {
        enabled: true,
        rules: [
          { id: 'off', name: 'Disabled', enabled: false },
          { id: 'eft', name: 'EFT only', payment_modes: [3] },
          {
            id: 'cash',
            name: 'Cash up to 1M',
            payment_modes: [1],
            max_total_premium: 1_000_000,
          },
        ],
      },
    });
    expect(matchAutoApprovalRule(policy, cashFacts)?.id).toBe('cash');
    expect(
      matchAutoApprovalRule(policy, { ...cashFacts, total_premium: 2_000_000 }),
    ).toBeNull();
  });

  it('lets only enabled approvers approve within their own limits', () => {
    const policy = normalizeApprovalPolicy({
      direct_approval: {
        enabled: true,
        approvers: [
          {
            user_id: 'cashier',
            payment_modes: [1],
            max_total_premium: 600_000,
          },
          { user_id: 'paused', enabled: false },
        ],
      },
    });
    expect(directApprovalViolation(policy, 'cashier', cashFacts)).toBeNull();
    expect(
      directApprovalViolation(policy, 'cashier', {
        ...cashFacts,
        payment_mode: 3,
      }),
    ).toMatch(/payment method/);
    expect(directApprovalViolation(policy, 'paused', cashFacts)).toMatch(
      /not authorised/,
    );
    expect(directApprovalViolation(policy, 'stranger', cashFacts)).toMatch(
      /not authorised/,
    );
  });
});

describe('risk filter', () => {
  const shortTermOnly = normalizeApprovalPolicy({
    auto_approval: {
      enabled: true,
      rules: [{ id: 'st', name: 'Short-Term', risk_codes: ['sp014001000007'] }],
    },
  });
  const facts: ApprovalFacts = {
    payment_mode: 1,
    product_id: 'product-1',
    quotation_flow: 'MOTOR_FLEET',
    branch_id: null,
    risk_codes: ['SP014001000007'],
    total_premium: 47_200,
    max_discount_percent: 0,
  };

  it('matches when every risk is listed (case-insensitive)', () => {
    expect(matchAutoApprovalRule(shortTermOnly, facts)?.id).toBe('st');
  });

  it('does not match when any vehicle carries another risk', () => {
    expect(
      matchAutoApprovalRule(shortTermOnly, {
        ...facts,
        risk_codes: ['SP014001000007', 'SP014001000004'],
      }),
    ).toBeNull();
    expect(
      matchAutoApprovalRule(shortTermOnly, { ...facts, risk_codes: [] }),
    ).toBeNull();
  });
});

describe('Short-Term quotation type', () => {
  const policy = normalizeApprovalPolicy({
    auto_approval: {
      enabled: true,
      rules: [
        { id: 'st', name: 'Short-Term', quotation_flows: ['SHORT_TERM'] },
      ],
    },
  });
  const base: ApprovalFacts = {
    payment_mode: 1,
    product_id: 'product-1',
    quotation_flow: 'MOTOR_SINGLE',
    branch_id: null,
    risk_codes: ['SP014001000007'],
    total_premium: 23_600,
    max_discount_percent: 0,
  };

  it('matches single and fleet short-term quotations', () => {
    expect(matchAutoApprovalRule(policy, base)?.id).toBe('st');
    expect(
      matchAutoApprovalRule(policy, { ...base, quotation_flow: 'MOTOR_FLEET' })
        ?.id,
    ).toBe('st');
  });

  it('does not match ordinary motor quotations', () => {
    expect(
      matchAutoApprovalRule(policy, {
        ...base,
        risk_codes: ['SP014001000004'],
      }),
    ).toBeNull();
  });
});

describe('automatic payment request', () => {
  const cash: ApprovalFacts = {
    payment_mode: 1,
    product_id: 'product-1',
    quotation_flow: 'MOTOR_SINGLE',
    branch_id: null,
    risk_codes: ['SP014001000007'],
    total_premium: 23_600,
    max_discount_percent: 0,
  };

  it('uses a matching rule that has the option on', () => {
    const policy = normalizeApprovalPolicy({
      auto_approval: {
        enabled: true,
        rules: [
          { id: 'no', name: 'Approve only', payment_modes: [1] },
          {
            id: 'cash',
            name: 'Cash invoice',
            payment_modes: [1],
            auto_request_payment: true,
          },
        ],
      },
    });
    expect(autoPaymentRequestSource(policy, 'u', cash)).toMatchObject({
      source: 'RULE',
      rule: expect.objectContaining({ id: 'cash' }),
    });
    expect(
      autoPaymentRequestSource(policy, 'u', { ...cash, payment_mode: 3 }),
    ).toBeNull();
  });

  it('lets selected users skip it for their own quotations', () => {
    const policy = normalizeApprovalPolicy({
      direct_approval: {
        enabled: true,
        approvers: [
          { user_id: 'cashier', auto_request_payment: true },
          { user_id: 'other' },
        ],
      },
    });
    expect(autoPaymentRequestSource(policy, 'cashier', cash)).toMatchObject({
      source: 'USER',
    });
    expect(autoPaymentRequestSource(policy, 'other', cash)).toBeNull();
  });
});

describe('mark cash as paid', () => {
  const facts: ApprovalFacts = {
    payment_mode: 1,
    product_id: 'product-1',
    quotation_flow: 'MOTOR_SINGLE',
    branch_id: null,
    risk_codes: ['SP014001000007'],
    total_premium: 23_600,
    max_discount_percent: 0,
  };
  const policy = normalizeApprovalPolicy({
    auto_approval: {
      enabled: true,
      rules: [{ id: 'cash', name: 'Cash', auto_record_cash_payment: true }],
    },
  });

  it('implies the invoice and records cash only for cash quotations', () => {
    expect(policy.auto_approval.rules[0].auto_request_payment).toBe(true);
    expect(autoPaymentRequestSource(policy, 'u', facts)?.recordCash).toBe(true);
    expect(
      autoPaymentRequestSource(policy, 'u', { ...facts, payment_mode: 3 })
        ?.recordCash,
    ).toBe(false);
  });
});
