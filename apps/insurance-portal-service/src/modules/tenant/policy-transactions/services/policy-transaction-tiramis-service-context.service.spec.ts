import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { PolicyTransactionTiramisServiceContextService } from './policy-transaction-tiramis-service-context.service';

describe('PolicyTransactionTiramisServiceContextService', () => {
  const companyId = 'company-1';

  function makeService(overrides: {
    invoice?: unknown;
    receipt?: unknown;
    commission?: unknown;
    pricingQuote?: unknown;
    rateBook?: unknown;
  } = {}) {
    const queryBuilder = (result: unknown) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(result ?? null),
    });

    const repos: Record<string, { findOne?: jest.Mock; createQueryBuilder?: jest.Mock }> = {
      PricingQuote: { findOne: jest.fn().mockResolvedValue(overrides.pricingQuote ?? null) },
      PricingRateBook: { findOne: jest.fn().mockResolvedValue(overrides.rateBook ?? null) },
      Invoice: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder(overrides.invoice)) },
      Receipt: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder(overrides.receipt)) },
      CommissionTransaction: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder(overrides.commission)) },
    };

    const dataSource = {
      getRepository: (entity: { name: string }) => repos[entity.name],
    };

    const service = new PolicyTransactionTiramisServiceContextService(
      dataSource as any,
      new ProductDefinitionHashService(),
    );

    return service;
  }

  const outboundPayload = {
    policyHolders: [
      {
        policyHolderName: 'Jane Doe',
        policyHolderBirthDate: '1990-01-01',
        policyHolderType: 1,
        policyHolderIdNumber: 'AB-123',
        policyHolderIdType: 1,
        phoneNumber: '255700000000',
        emailAddress: 'jane@example.com',
      },
    ],
    motorDetail: {
      registrationNumber: 'T 123 ABC',
      chassisNumber: 'CH123',
      engineNumber: 'EN123',
      make: 'Toyota',
      model: 'Corolla',
      yearOfManufacture: 2018,
      ownerName: 'Jane Doe',
    },
  };

  function makeQuotation(overrides: Record<string, unknown> = {}) {
    return {
      id: 'quotation-1',
      quotation_no: 'Q-1',
      workflow_revision: 2,
      requires_approval: true,
      requires_payment: true,
      finalization_hash: 'stored-finalization-hash',
      workflow_completed_at: new Date('2026-01-01T00:00:00Z'),
      payment_status_v2: 'PAID',
      product_definition_snapshot: null,
      cover_note: null,
      customer: {
        id: 'customer-1',
        customer_no: 'CUST-1',
        kyc_status: 'VERIFIED',
        kyc_version: 3,
      },
      ...overrides,
    } as any;
  }

  it('asserts the workflow gate as already-satisfied at issuance time, not the quotation live status', async () => {
    const service = makeService();
    const quotation = makeQuotation();

    const context = await service.build(companyId, quotation, outboundPayload);

    expect(context.quotationGate.quotationStage).toBe('COMPLETED');
    expect(context.quotationGate.approvalStatus).toBe('APPROVED');
    expect(context.quotationGate.paymentStatus).toBe('PAID');
    expect(context.quotationGate.finalizationHash).toBe('stored-finalization-hash');
    expect(context.quotationGate.workflowGateHash).toEqual(expect.any(String));
  });

  it('computes insuredData hashes that reproduce apps/tiramis guard normalization (idempotent, order-independent)', async () => {
    const service = makeService();
    const quotation = makeQuotation();

    const context = await service.build(companyId, quotation, outboundPayload);

    expect(context.insuredData.customerId).toBe('customer-1');
    expect(context.insuredData.assetCount).toBe(1);
    expect(context.insuredData.tiramisPolicyHolderHash).toEqual(expect.any(String));
    expect(context.insuredData.assetManifestHash).toEqual(expect.any(String));

    // Re-running against a payload with different key order / whitespace
    // must reproduce the identical hash (mirrors sortValue-based hashing).
    const reordered = {
      policyHolders: [
        {
          emailAddress: '  jane@example.com  ',
          phoneNumber: '255700000000',
          policyHolderIdType: 1,
          policyHolderIdNumber: 'ab-123',
          policyHolderType: 1,
          policyHolderBirthDate: '1990-01-01',
          policyHolderName: '  Jane Doe  ',
        },
      ],
      motorDetail: outboundPayload.motorDetail,
    };
    const contextReordered = await service.build(companyId, quotation, reordered);

    expect(contextReordered.insuredData.tiramisPolicyHolderHash).toBe(
      context.insuredData.tiramisPolicyHolderHash,
    );
  });

  it('rejects when the customer KYC is not verified', async () => {
    const service = makeService();
    const quotation = makeQuotation({
      customer: {
        id: 'customer-1',
        customer_no: 'CUST-1',
        kyc_status: 'PENDING',
      },
    });

    await expect(
      service.build(companyId, quotation, outboundPayload),
    ).rejects.toThrow('Customer KYC must be verified');
  });

  it('rejects when the outbound payload has no policy-holder data', async () => {
    const service = makeService();
    const quotation = makeQuotation();

    await expect(
      service.build(companyId, quotation, { motorDetail: outboundPayload.motorDetail }),
    ).rejects.toThrow('missing policy-holder data');
  });
});
