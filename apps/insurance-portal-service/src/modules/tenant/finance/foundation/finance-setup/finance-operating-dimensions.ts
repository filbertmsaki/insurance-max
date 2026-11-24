import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { isFinanceDate } from '../finance-configuration/finance-configuration.types';
import { verifyReviewedDimensionMaster } from '../accounting-dimensions/finance-reviewed-dimension-master';

interface OperatingBook {
  tenant_id: string;
  legal_entity_id: string;
  book_id: string;
  company_id: string;
  controls: {
    dimensionReleaseId: string;
    dimensionReleaseHash: string;
    departmentIds: string[];
    costCentres: { code: string }[];
    configurationPins: { id: string; hash: string }[];
  };
}
interface DimensionDefinition {
  code: string;
  valueType: string;
  required: boolean;
}
export async function documentDimensionFields(
  manager: EntityManager,
  company: string,
  selectedBook?: string,
) {
  const [book] = await manager.query(
    `SELECT a.controls,r.payload FROM ${selectedBook ? '(SELECT * FROM finance_operating_setups WHERE company_id=$1 AND book_id=$2 AND withdrawn_at IS NULL)' : 'finance_fin01_primary($1)'} a
    JOIN finance_configuration_releases r ON r.id::text=a.controls->>'dimensionReleaseId' AND r.release_hash=a.controls->>'dimensionReleaseHash'`,
    selectedBook ? [company, selectedBook] : [company],
  );
  const departments = await manager.query(
    "SELECT id AS value,name AS label FROM departments WHERE company_id::text=$1 AND id::text=ANY($2::text[]) AND status='active' AND deleted_at IS NULL ORDER BY name",
    [company, book.controls.departmentIds],
  );
  const master = book.payload.companyMaster;
  const choices: Record<string, { value: string; label: string }[]> = {
    DEPARTMENT: departments,
    COST_CENTRE: book.controls.costCentres.map(
      (c: { code: string; name: string }) => ({ value: c.code, label: c.name }),
    ),
    BRANCH: (master?.branchIds ?? []).map((id: string) => ({
      value: id,
      label:
        master.snapshot.branches?.find((b: { id: string }) => b.id === id)
          ?.code ?? id,
    })),
    PRODUCT: (master?.productIds ?? []).map((id: string) => ({
      value: id,
      label:
        master.snapshot.products?.find((p: { id: string }) => p.id === id)
          ?.product_code ?? id,
    })),
  };
  const system = [
    'TENANT',
    'LEGAL_ENTITY',
    'BOOK',
    'COMPANY',
    'CUSTOMER',
    'CURRENCY',
    'DIMENSION_RELEASE',
    'DIMENSION_HASH',
    'SOURCE_ASSOCIATION',
    'SOURCE_ASSOCIATION_HASH',
  ];
  const definitions = book.payload.definitions.filter(
    (d: { code: string }) => !system.includes(d.code),
  );
  const fields = definitions.map(
    (d: { code: string; label: string; required: boolean }) => ({
      code: d.code,
      label: d.label,
      required: d.required,
      options: choices[d.code],
    }),
  );
  for (const [code, options] of Object.entries(choices)) {
    if (
      options.length &&
      !definitions.some((d: { code: string }) => d.code === code)
    )
      fields.push({
        code,
        label:
          code === 'COST_CENTRE'
            ? 'Cost centre'
            : code.charAt(0) + code.slice(1).toLowerCase(),
        required: false,
        options,
      });
  }
  return fields;
}

export async function operatingDimensions(
  manager: EntityManager,
  book: OperatingBook,
  date: string,
  currency: string,
  customer: string | null,
  branch: string | null,
  entered: Record<string, string> = {},
) {
  const ids = [book.tenant_id, book.legal_entity_id, book.book_id];
  const [release] = await manager.query(
    "SELECT payload FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND release_hash=$5 AND kind='DIMENSIONS' AND state='REVIEWED_INACTIVE' FOR SHARE",
    [
      ...ids,
      book.controls.dimensionReleaseId,
      book.controls.dimensionReleaseHash,
    ],
  );
  if (!release)
    throw new ConflictException(
      'Review the dimension definitions for this book.',
    );
  const definitions: DimensionDefinition[] = release.payload.definitions;
  const values: Record<string, string> = {
    TENANT: ids[0],
    LEGAL_ENTITY: ids[1],
    BOOK: ids[2],
    CURRENCY: currency,
  };
  if (customer) values.CUSTOMER = customer;
  const reserved = [
    'TENANT',
    'LEGAL_ENTITY',
    'BOOK',
    'CURRENCY',
    'CUSTOMER',
    'COMPANY',
    'DIMENSION_RELEASE',
    'DIMENSION_HASH',
    'SOURCE_ASSOCIATION',
    'SOURCE_ASSOCIATION_HASH',
  ];
  for (const [key, value] of Object.entries(entered)) {
    if (
      reserved.includes(key) ||
      (!['BRANCH', 'PRODUCT', 'DEPARTMENT', 'COST_CENTRE'].includes(key) &&
        !definitions.some((d) => d.code === key)) ||
      typeof value !== 'string' ||
      value.trim() !== value ||
      !value ||
      value.length > 200
    )
      throw new ConflictException(
        'Enter a value for an approved business dimension: ' + key + '.',
      );
    values[key] = value;
  }
  if (
    branch &&
    (release.payload.companyMaster ||
      definitions.some((d) => d.code === 'BRANCH') ||
      values.BRANCH)
  ) {
    if (values.BRANCH && values.BRANCH !== branch)
      throw new ConflictException(
        'The branch must match the originating document.',
      );
    values.BRANCH = branch;
  }
  if (values.DEPARTMENT) {
    const [department] = await manager.query(
      "SELECT id FROM departments WHERE id::text=$1 AND company_id=$2 AND status='active' AND deleted_at IS NULL FOR SHARE",
      [values.DEPARTMENT, book.company_id],
    );
    if (!department || !book.controls.departmentIds.includes(values.DEPARTMENT))
      throw new ConflictException(
        'Select an active department approved for this book.',
      );
  }
  if (
    values.COST_CENTRE &&
    !book.controls.costCentres.some((v) => v.code === values.COST_CENTRE)
  )
    throw new ConflictException('Select a cost centre approved for this book.');
  if (
    values.BRANCH ||
    values.PRODUCT ||
    definitions.some((d) => d.code === 'COMPANY' && d.required)
  ) {
    const [association] = await manager.query(
      `SELECT r.id,r.release_hash FROM jsonb_array_elements($4::jsonb) pin
      JOIN finance_configuration_releases r ON r.id::text=pin->>'id' AND r.release_hash=pin->>'hash'
      WHERE r.tenant_id=$1 AND r.legal_entity_id=$2 AND r.book_id=$3 AND r.kind='SOURCE_ASSOCIATIONS'`,
      [...ids, JSON.stringify(book.controls.configurationPins)],
    );
    if (!association)
      throw new ConflictException(
        'Review the source association for the company dimensions.',
      );
    Object.assign(values, {
      COMPANY: book.company_id,
      DIMENSION_RELEASE: book.controls.dimensionReleaseId,
      DIMENSION_HASH: book.controls.dimensionReleaseHash,
      SOURCE_ASSOCIATION: association.id,
      SOURCE_ASSOCIATION_HASH: association.release_hash,
    });
    await verifyReviewedDimensionMaster(manager, ids, {
      economicOrigin: 'INSURANCE_PORTAL_FINANCE',
      accountingDate: date,
      lines: [
        {
          lineKey: 'DOCUMENT',
          roleCode: 'DOCUMENT',
          debit: '0',
          credit: '0',
          dimensions: values,
        },
      ],
    });
  }
  for (const d of definitions) {
    const v = values[d.code];
    if (d.required && !v)
      throw new ConflictException(
        'Enter the required dimension ' + d.code + '.',
      );
    if (
      v &&
      ((d.valueType === 'DATE' && !isFinanceDate(v)) ||
        (d.valueType === 'CURRENCY' && !/^[A-Z]{3}$/.test(v)))
    )
      throw new ConflictException(
        'Invalid value for dimension ' + d.code + '.',
      );
  }
  return values;
}
