import axios, { type AxiosInstance } from 'axios';

import {
  createMotorFleetQuotationPayload,
  createMotorSingleQuotationPayload,
  createNonMotorQuotationPayload,
} from '../apps/insurance-portal-service/src/modules/tenant/quotations/testing/quotation-payload.fixture';

type BranchRecord = {
  id: string;
  name?: string;
  code?: string;
  status?: string;
};

type SalePointRecord = {
  id: string;
  salePointCode?: string;
  sale_point_code?: string;
  salePointName?: string;
  sale_point_name?: string;
  isDefault?: boolean;
  is_default?: boolean;
};

type CategoryRecord = {
  id: string;
  name?: string;
  code?: string;
  business_line?: 'MOTOR' | 'NON_MOTOR';
};

type ProductRecord = {
  id: string;
  product_name?: string;
  product_code?: string;
  tiramis_product_code?: string | null;
  business_line?: 'MOTOR' | 'NON_MOTOR';
  supports_fleet?: boolean;
};

type RiskRecord = {
  id: string;
  risk_name?: string;
  risk_code?: string;
};

type LoginResponse = {
  access_token?: string;
  company?: {
    id: string;
    name?: string;
    slug?: string;
  } | null;
};

type QuotationCreateResponse = {
  id: string;
  quotation_no: string;
  status: string;
  quotation_flow?: string;
};

function readArray<T = Record<string, unknown>>(payload: any): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (Array.isArray(payload?.data)) {
    return payload.data as T[];
  }

  if (Array.isArray(payload?.items)) {
    return payload.items as T[];
  }

  if (Array.isArray(payload?.data?.items)) {
    return payload.data.items as T[];
  }

  return [];
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );

    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function toDateParts(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function buildCoverWindow() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  end.setUTCHours(23, 59, 59, 0);

  return {
    startDateTime: `${toDateParts(start)}T00:00:00`,
    endDateTime: `${toDateParts(end)}T23:59:59`,
  };
}

function uniqueSuffix() {
  return `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

function uniqueRegistration(prefix: string, index = 0) {
  const seed = uniqueSuffix();
  const base = `${prefix}${seed}${index}`;
  return base.slice(0, 8).toUpperCase();
}

function uniqueText(prefix: string, maxLength = 20) {
  return `${prefix}${uniqueSuffix()}`.slice(0, maxLength).toUpperCase();
}

function uniqueCoverNoteNumber(prefix: string) {
  return `${prefix}${uniqueSuffix()}`.toUpperCase();
}

function sumAmounts(
  items: Array<Record<string, any>> | undefined,
  field: string,
) {
  return roundMoney(
    (items ?? []).reduce((sum, item) => sum + Number(item?.[field] ?? 0), 0),
  );
}

function normalizeRiskAmounts(risk: Record<string, any>) {
  const totalDiscount = sumAmounts(risk.discounts_offered, 'discount_amount');
  risk.premium_after_discount = roundMoney(
    Number(risk.premium_before_discount ?? 0) - totalDiscount,
  );
  risk.premium_excluding_tax_equivalent = risk.premium_after_discount;
  risk.premium_including_tax = roundMoney(
    risk.premium_excluding_tax_equivalent +
      sumAmounts(risk.taxes_charged, 'tax_amount'),
  );
  risk.sum_insured_equivalent = risk.sum_insured;
}

function normalizeAddonAmounts(addon: Record<string, any>) {
  addon.premium_excluding_tax_equivalent = Number(
    addon.premium_excluding_tax ?? 0,
  );
  addon.premium_including_tax = roundMoney(
    addon.premium_excluding_tax_equivalent +
      sumAmounts(addon.taxes_charged, 'tax_amount'),
  );
}

function normalizeStandardCoverNote(detail: Record<string, any>) {
  (detail.risks_covered ?? []).forEach(normalizeRiskAmounts);
  (detail.cover_note_addons ?? []).forEach(normalizeAddonAmounts);

  detail.total_premium_excluding_tax = roundMoney(
    sumAmounts(detail.risks_covered, 'premium_after_discount') +
      sumAmounts(detail.cover_note_addons, 'premium_excluding_tax'),
  );
  detail.total_premium_including_tax = roundMoney(
    sumAmounts(detail.risks_covered, 'premium_including_tax') +
      sumAmounts(detail.cover_note_addons, 'premium_including_tax'),
  );
}

function normalizeFleetCoverNote(detail: Record<string, any>) {
  const fleetDetails = detail.fleet_dtls ?? [];

  fleetDetails.forEach((entry: Record<string, any>) => {
    (entry.risks_covered ?? []).forEach(normalizeRiskAmounts);
    (entry.cover_note_addons ?? []).forEach(normalizeAddonAmounts);
  });

  detail.fleet_hdr.fleet_size = fleetDetails.length;
  detail.fleet_hdr.comprehensive_insured = fleetDetails.length;
  detail.fleet_hdr.total_premium_excluding_tax = roundMoney(
    fleetDetails.reduce(
      (sum: number, entry: Record<string, any>) =>
        sum +
        sumAmounts(entry.risks_covered, 'premium_after_discount') +
        sumAmounts(entry.cover_note_addons, 'premium_excluding_tax'),
      0,
    ),
  );
  detail.fleet_hdr.total_premium_including_tax = roundMoney(
    fleetDetails.reduce(
      (sum: number, entry: Record<string, any>) =>
        sum +
        sumAmounts(entry.risks_covered, 'premium_including_tax') +
        sumAmounts(entry.cover_note_addons, 'premium_including_tax'),
      0,
    ),
  );
}

async function login(client: AxiosInstance, email: string, password: string) {
  const response = await client.post<LoginResponse>('/auth/login', {
    email,
    password,
  });

  const accessToken = response.data.access_token;
  if (!accessToken) {
    throw new Error('Login succeeded but access_token was missing');
  }

  const jwtPayload = decodeJwtPayload(accessToken);
  const companyId =
    response.data.company?.id ||
    String(jwtPayload?.companyId || jwtPayload?.company_id || '');

  if (!companyId) {
    throw new Error('Could not resolve active company id from login response');
  }

  return {
    accessToken,
    companyId,
    companyName:
      response.data.company?.name || String(jwtPayload?.companyName || ''),
  };
}

async function fetchBranchWithSalePoint(client: AxiosInstance) {
  const branchesResponse = await client.get('/branches', {
    params: {
      limit: 100,
    },
  });
  const branches = readArray<BranchRecord>(branchesResponse.data).filter(
    (branch) => !branch.status || branch.status === 'active',
  );

  if (branches.length === 0) {
    throw new Error('No active branches were returned by /branches');
  }

  for (const branch of branches) {
    const salePointsResponse = await client.get(
      '/tenant/tiramis-submissions/sale-points',
      {
        params: {
          branch_id: branch.id,
        },
      },
    );

    const salePoints = readArray<SalePointRecord>(salePointsResponse.data);
    if (salePoints.length === 0) {
      continue;
    }

    const salePoint =
      salePoints.find((item) => item.isDefault || item.is_default) ||
      salePoints[0];

    const salePointCode =
      salePoint.salePointCode || salePoint.sale_point_code || '';

    if (!salePointCode) {
      continue;
    }

    return {
      branch,
      salePoint,
      salePointCode,
    };
  }

  throw new Error('No branch with an active TIRA sale point was found');
}

async function fetchCategory(
  client: AxiosInstance,
  businessLine: 'MOTOR' | 'NON_MOTOR',
) {
  const response = await client.get('/insurance-categories', {
    params: {
      limit: 100,
      is_active: true,
      business_line: businessLine,
    },
  });
  const categories = readArray<CategoryRecord>(response.data);
  const category = categories[0];

  if (!category) {
    throw new Error(`No active ${businessLine} category was returned`);
  }

  return category;
}

async function fetchProduct(
  client: AxiosInstance,
  categoryId: string,
  businessLine: 'MOTOR' | 'NON_MOTOR',
  options?: {
    supportsFleet?: boolean;
  },
) {
  const response = await client.get('/insurance-products', {
    params: {
      limit: 100,
      is_active: true,
      category_id: categoryId,
      business_line: businessLine,
      ...(options?.supportsFleet !== undefined
        ? { supports_fleet: options.supportsFleet }
        : {}),
    },
  });

  const products = readArray<ProductRecord>(response.data);
  const product =
    products.find((item) =>
      options?.supportsFleet === undefined
        ? true
        : Boolean(item.supports_fleet) === options.supportsFleet,
    ) || products[0];

  if (!product) {
    throw new Error(
      `No active ${businessLine} product was returned for category ${categoryId}`,
    );
  }

  return product;
}

async function fetchRisk(client: AxiosInstance, productId: string) {
  const response = await client.get('/insurance-risks', {
    params: {
      limit: 100,
      is_active: true,
      product_id: productId,
    },
  });

  const risks = readArray<RiskRecord>(response.data);
  const risk = risks[0];

  if (!risk?.risk_code) {
    throw new Error(
      `No active risk with risk_code was returned for product ${productId}`,
    );
  }

  return risk;
}

async function createQuotation(
  client: AxiosInstance,
  label: string,
  payload: Record<string, any>,
) {
  const response = await client.post<QuotationCreateResponse>(
    '/tenant/quotations',
    payload,
  );

  console.log(
    `[OK] ${label}: ${response.data.quotation_no} (${response.data.id}) status=${response.data.status}`,
  );

  return response.data;
}

async function main() {
  const baseUrl =
    process.env.QUOTATION_TEST_BASE_URL || 'http://localhost:9090/api/v1';
  const email = process.env.QUOTATION_TEST_EMAIL || 'inocent@alliance.co.tz';
  const password = process.env.QUOTATION_TEST_PASSWORD || 'Admin123!';

  const anonymousClient = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  console.log(`[info] Logging in to ${baseUrl} as ${email}`);
  const session = await login(anonymousClient, email, password);

  const client = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  const branchContext = await fetchBranchWithSalePoint(client);
  const nonMotorCategory = await fetchCategory(client, 'NON_MOTOR');
  const motorCategory = await fetchCategory(client, 'MOTOR');
  const nonMotorProduct = await fetchProduct(
    client,
    nonMotorCategory.id,
    'NON_MOTOR',
  );
  const motorProduct = await fetchProduct(client, motorCategory.id, 'MOTOR');
  const fleetProduct = await fetchProduct(client, motorCategory.id, 'MOTOR', {
    supportsFleet: true,
  });
  const nonMotorRisk = await fetchRisk(client, nonMotorProduct.id);
  const motorRisk = await fetchRisk(client, motorProduct.id);
  const fleetRisk = await fetchRisk(client, fleetProduct.id);
  const coverWindow = buildCoverWindow();

  console.log(
    `[info] Active company: ${session.companyName || session.companyId}`,
  );
  console.log(
    `[info] Using branch=${branchContext.branch.name || branchContext.branch.id}, salePoint=${branchContext.salePointCode}`,
  );

  const nonMotorPayload = createNonMotorQuotationPayload() as Record<
    string,
    any
  >;
  delete nonMotorPayload.internal_quotation.branch_id;
  delete nonMotorPayload.cover_note_dtl.sale_point_code;
  nonMotorPayload.internal_quotation.insurer_company_id = session.companyId;
  nonMotorPayload.internal_quotation.category_id = nonMotorCategory.id;
  nonMotorPayload.internal_quotation.product_id = nonMotorProduct.id;
  nonMotorPayload.cover_note_dtl.cover_note_start_date =
    coverWindow.startDateTime;
  nonMotorPayload.cover_note_dtl.cover_note_end_date = coverWindow.endDateTime;
  nonMotorPayload.cover_note_dtl.cover_note_number =
    uniqueCoverNoteNumber('AICL-NM-');
  nonMotorPayload.cover_note_dtl.product_code =
    nonMotorProduct.tiramis_product_code ||
    nonMotorProduct.product_code ||
    nonMotorPayload.cover_note_dtl.product_code;
  nonMotorPayload.cover_note_dtl.risks_covered[0].risk_code =
    nonMotorRisk.risk_code;
  nonMotorPayload.cover_note_dtl.subject_matters_covered[0].subject_matter_reference =
    uniqueText('PROP-', 14);
  normalizeStandardCoverNote(nonMotorPayload.cover_note_dtl);

  const motorPayload = createMotorSingleQuotationPayload() as Record<
    string,
    any
  >;
  delete motorPayload.internal_quotation.branch_id;
  delete motorPayload.cover_note_dtl.sale_point_code;
  motorPayload.internal_quotation.insurer_company_id = session.companyId;
  motorPayload.internal_quotation.category_id = motorCategory.id;
  motorPayload.internal_quotation.product_id = motorProduct.id;
  motorPayload.cover_note_dtl.cover_note_start_date = coverWindow.startDateTime;
  motorPayload.cover_note_dtl.cover_note_end_date = coverWindow.endDateTime;
  motorPayload.cover_note_dtl.cover_note_number =
    uniqueCoverNoteNumber('AICL-MTR-');
  motorPayload.cover_note_dtl.product_code =
    motorProduct.tiramis_product_code ||
    motorProduct.product_code ||
    motorPayload.cover_note_dtl.product_code;
  motorPayload.cover_note_dtl.risks_covered[0].risk_code = motorRisk.risk_code;
  motorPayload.cover_note_dtl.subject_matters_covered[0].subject_matter_reference =
    uniqueText('VEH-', 14);
  motorPayload.cover_note_dtl.motor_dtl.registration_number =
    uniqueRegistration('T');
  motorPayload.cover_note_dtl.motor_dtl.chassis_number = uniqueText(
    'CHASSIS',
    17,
  );
  motorPayload.cover_note_dtl.motor_dtl.engine_number = uniqueText(
    'ENGINE',
    15,
  );
  normalizeStandardCoverNote(motorPayload.cover_note_dtl);

  const fleetPayload = createMotorFleetQuotationPayload() as Record<
    string,
    any
  >;
  delete fleetPayload.internal_quotation.branch_id;
  delete fleetPayload.cover_note_dtl.fleet_hdr.sale_point_code;
  fleetPayload.internal_quotation.insurer_company_id = session.companyId;
  fleetPayload.internal_quotation.category_id = motorCategory.id;
  fleetPayload.internal_quotation.product_id = fleetProduct.id;
  fleetPayload.cover_note_dtl.fleet_hdr.cover_note_start_date =
    coverWindow.startDateTime;
  fleetPayload.cover_note_dtl.fleet_hdr.cover_note_end_date =
    coverWindow.endDateTime;
  fleetPayload.cover_note_dtl.fleet_hdr.product_code =
    fleetProduct.tiramis_product_code ||
    fleetProduct.product_code ||
    fleetPayload.cover_note_dtl.fleet_hdr.product_code;
  fleetPayload.cover_note_dtl.fleet_hdr.fleet_id = uniqueText('FLEET-', 18);

  fleetPayload.cover_note_dtl.fleet_dtls.forEach(
    (entry: Record<string, any>, index: number) => {
      entry.cover_note_number = uniqueCoverNoteNumber(`AICL-FLT${index + 1}-`);
      entry.risks_covered[0].risk_code = fleetRisk.risk_code;
      entry.subject_matters_covered[0].subject_matter_reference = uniqueText(
        `FVEH${index + 1}-`,
        16,
      );
      entry.motor_dtl.registration_number = uniqueRegistration(
        `F${index + 1}`,
        index,
      );
      entry.motor_dtl.chassis_number = uniqueText(`FCHASSIS${index + 1}`, 17);
      entry.motor_dtl.engine_number = uniqueText(`FENGINE${index + 1}`, 15);
    },
  );
  normalizeFleetCoverNote(fleetPayload.cover_note_dtl);

  console.log('[info] Creating quotations...');
  await createQuotation(client, 'NON_MOTOR', nonMotorPayload);
  await createQuotation(client, 'MOTOR_SINGLE', motorPayload);
  await createQuotation(client, 'MOTOR_FLEET', fleetPayload);
}

main().catch((error: any) => {
  const status = error?.response?.status;
  const data = error?.response?.data;

  console.error('[error] Quotation smoke test failed');
  if (status) {
    console.error(`status=${status}`);
  }
  if (data) {
    console.error(JSON.stringify(data, null, 2));
  } else {
    console.error(error?.message || error);
  }

  process.exit(1);
});
