import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

export const POLICY_NUMBERING_KEY = 'policy_numbering';
export interface PolicyNumberingConfiguration {
  prefix: string;
  scope: 'INSURER';
  branch_start: number;
  product_start: number;
  category_start: number;
}
export const DEFAULT_POLICY_NUMBERING: Readonly<PolicyNumberingConfiguration> =
  {
    prefix: 'P11',
    scope: 'INSURER',
    branch_start: 100,
    product_start: 1001,
    category_start: 10,
  };

export function validatePolicyNumbering(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(
      'Policy numbering configuration must be an object',
    );
  }
  const config = { ...DEFAULT_POLICY_NUMBERING, ...value };
  if (
    Object.keys(value).some(
      (key) => !Object.hasOwn(DEFAULT_POLICY_NUMBERING, key),
    ) ||
    typeof config.prefix !== 'string' ||
    !/^[A-Z0-9]{1,12}$/.test(config.prefix) ||
    config.scope !== 'INSURER'
  ) {
    throw new BadRequestException(
      'Use an uppercase alphanumeric prefix (1–12 characters) and INSURER scope',
    );
  }
  for (const key of [
    'branch_start',
    'product_start',
    'category_start',
  ] as const) {
    if (
      !Number.isSafeInteger(config[key]) ||
      config[key] < 1 ||
      config[key] > 999999999999
    ) {
      throw new BadRequestException(
        `${key} must be a positive integer of at most 12 digits`,
      );
    }
  }
  return config;
}

export function policySequenceName(insurerId: string): string {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      insurerId,
    )
  ) {
    throw new BadRequestException('Invalid insurer ID');
  }
  return `policy_lifetime_${insurerId.replace(/-/g, '').toLowerCase()}`;
}

/** Called under the quotation lock, after checking for an existing issued policy. */
export async function nextPolicyNo(
  manager: EntityManager,
  context: {
    companyId: string;
    insurerId: string;
    branchId: string | null;
    productId: string;
    categoryId: string;
    riskIds: string[];
  },
  issuedAt = new Date(),
) {
  if (
    !context.branchId ||
    !context.riskIds.length ||
    !Number.isFinite(issuedAt.getTime())
  ) {
    throw new BadRequestException(
      'Issuance requires a branch, risks and a valid issue date',
    );
  }
  const [codes] = await manager.query(
    `
    SELECT c.operating_timezone, b.policy_numbering_code AS branch_code,
           p.policy_numbering_code AS product_code, k.policy_numbering_code AS category_code,
           cfg.config_value AS configuration
      FROM companies c
      JOIN companies owner ON owner.id = $2::uuid AND owner.status = 'active' AND owner.deleted_at IS NULL
      JOIN branches b ON b.id = $3 AND b.company_id = $2::uuid
        AND b.status = 'active' AND b.deleted_at IS NULL
      JOIN insurance_products p ON p.id = $4 AND p.company_id = c.id
        AND p.is_active AND p.deleted_at IS NULL
      JOIN insurance_categories k ON k.id = $5 AND k.id = p.category_id
        AND k.company_id = c.id AND k.is_active AND k.deleted_at IS NULL
      LEFT JOIN company_configs cfg ON cfg.company_id = c.id
        AND cfg.config_key = 'policy_numbering' AND cfg.is_active
     WHERE c.id = $1 AND c.status = 'active' AND c.deleted_at IS NULL
       AND c.company_type = 'INSURANCE_COMPANY'
       AND NOT EXISTS (
         SELECT 1 FROM unnest($6::uuid[]) selected(id)
         WHERE NOT EXISTS (SELECT 1 FROM insurance_risks r
           WHERE r.id = selected.id AND r.company_id = c.id
             AND r.product_id = p.id AND r.is_active
             AND r.lifecycle_status = 'ACTIVE' AND r.deleted_at IS NULL))
     FOR SHARE OF c, owner, b, p, k
  `,
    [
      context.insurerId,
      context.companyId,
      context.branchId,
      context.productId,
      context.categoryId,
      context.riskIds,
    ],
  );
  if (
    !codes ||
    [codes.branch_code, codes.product_code, codes.category_code].some(
      (code) => typeof code !== 'string' || !/^[0-9]{1,12}$/.test(code),
    )
  ) {
    throw new BadRequestException(
      'Active insurer, issuing branch, product, category, risks and numbering codes are required',
    );
  }
  const stored =
    typeof codes.configuration === 'string'
      ? JSON.parse(codes.configuration)
      : codes.configuration;
  const config = validatePolicyNumbering(stored ?? DEFAULT_POLICY_NUMBERING);
  let issueDate: string;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: codes.operating_timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(issuedAt);
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    issueDate = `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    throw new BadRequestException('The insurer business timezone is invalid');
  }
  // Provisioned before issuance: rollback of a first allocation must never recreate it.
  const [row] = await manager.query(
    'SELECT nextval($1::regclass)::text AS sequence',
    [`public.${policySequenceName(context.insurerId)}`],
  );
  const sequence = String(row?.sequence);
  if (!/^[1-9][0-9]*$/.test(sequence))
    throw new Error('Invalid policy sequence allocation');
  const policyNo = [
    config.prefix,
    issueDate.slice(0, 4),
    codes.branch_code,
    codes.product_code,
    codes.category_code,
    sequence.padStart(8, '0'),
  ].join('/');
  return {
    policyNo,
    sequence,
    issueDate,
    snapshot: {
      scope: 'INSURER',
      insurerId: context.insurerId,
      prefix: config.prefix,
      branchId: context.branchId,
      branchCode: codes.branch_code,
      productId: context.productId,
      productCode: codes.product_code,
      categoryId: context.categoryId,
      categoryCode: codes.category_code,
      sequence,
      issuedAt: issuedAt.toISOString(),
      timezone: codes.operating_timezone,
    },
  };
}
