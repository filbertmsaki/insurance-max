import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { QuotationType } from '../../quotations/enums/quotation-type.enum';
import { PolicyTransactionContextService } from './policy-transaction-context.service';

describe('PolicyTransactionContextService', () => {
  const service = new PolicyTransactionContextService();

  function makePolicy(overrides: Record<string, unknown> = {}) {
    return {
      id: 'policy-1',
      policy_no: 'POL-001',
      company_id: 'company-1',
      insurer_company_id: 'insurer-1',
      intermediary_company_id: 'broker-1',
      branch_id: 'branch-1',
      department_id: 'department-1',
      customer_id: 'customer-1',
      category_id: 'category-1',
      product_id: 'product-1',
      product_version_id: 'product-version-1',
      product_definition_hash: 'product-hash-1',
      sub_class_id: 'sub-class-1',
      channel_type: 'BROKER',
      currency: 'TZS',
      quotation_id: 'quotation-1',
      end_date: '2027-09-15',
      ...overrides,
    } as any;
  }

  function makeVersion(snapshot: Record<string, unknown>) {
    return {
      id: 'version-1',
      version_number: 1,
      policy_snapshot: snapshot,
    } as any;
  }

  function makeSnapshot(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: 2,
      endDate: '2027-09-15',
      source: {
        quotationFlow: QuotationFlow.MOTOR_SINGLE,
        quotationType: QuotationType.MOTOR,
        isFleet: false,
      },
      product: {
        categoryId: 'category-2',
        productId: 'product-2',
        subClassId: 'sub-class-2',
        productVersionId: 'product-version-2',
        productDefinitionHash: 'product-hash-2',
      },
      cover: {
        salePointCode: 'SP001',
        endDate: '2027-09-15',
        paymentMode: 1,
        exchangeRate: '1',
        officerName: 'Asha Underwriter',
        officerTitle: 'Senior Officer',
      },
      customer: {
        customerId: 'customer-1',
        policyHolder: {
          name: 'John Mushi',
          phone: '255700000000',
          email: 'john@example.test',
        },
      },
      policyHolders: [
        {
          name: 'John Mushi',
          idNumber: 'NIDA-123',
          phone: '255700000000',
        },
      ],
      entries: [
        {
          entryId: 'entry-1',
          coverNoteDescription: 'Private motor comprehensive',
          operativeClause: 'Comprehensive cover',
          motor: {
            motorCategory: 1,
            motorType: 1,
            registrationNumber: 'T123ABC',
            chassisNumber: 'CHS-001',
            engineNumber: 'ENG-001',
            make: 'TOYOTA',
            model: 'LAND CRUISER',
            modelNumber: 'GDH201',
            bodyType: 'SUV',
            yearOfManufacture: 2024,
            motorUsage: 1,
            sittingCapacity: 5,
          },
          risks: [
            {
              insuranceRiskId: 'risk-1',
              riskCode: 'MOTOR01',
              sumInsured: '65000000',
            },
          ],
          pricing: {
            risks: [
              {
                insuranceRiskId: 'risk-1',
                riskCode: 'MOTOR01',
                premiumRate: '0.020000',
                premiumBeforeDiscount: '1300000',
              },
            ],
            addons: [{ id: 'addon-1', amount: '25000' }],
          },
        },
      ],
      ...overrides,
    };
  }

  it('builds a renewal draft from the complete current policy snapshot', () => {
    const context = service.buildDraftContext({
      policy: makePolicy(),
      version: makeVersion(makeSnapshot()),
      type: 'RENEWAL',
      effectiveDate: '2027-09-16',
      endDate: '2028-09-15',
      previousCoverNoteReference: 'CN-OLD',
    });

    expect(context.dto).toMatchObject({
      branch_id: 'branch-1',
      intermediary_company_id: 'broker-1',
      category_id: 'category-2',
      product_id: 'product-2',
      sub_class_id: 'sub-class-2',
      quotation_flow: QuotationFlow.MOTOR_SINGLE,
      quotation_type: QuotationType.MOTOR,
    });
    expect(context.branchContext).toMatchObject({
      branchId: 'branch-1',
      salePointCode: 'SP001',
      officer: {
        officer_name: 'Asha Underwriter',
        officer_title: 'Senior Officer',
      },
    });
    expect(context.dto.draft_payload).toMatchObject({
      cover_note_type: '2',
      prev_cover_note_reference: 'CN-OLD',
      valid_from: '2027-09-16',
      valid_until: '2028-09-15',
      policyholder_snapshot: expect.objectContaining({
        name: 'John Mushi',
      }),
      motor: expect.objectContaining({
        registration_no: 'T123ABC',
        chassis_no: 'CHS-001',
        engine_no: 'ENG-001',
        make: 'TOYOTA',
        model: 'LAND CRUISER',
        body_type: 'SUV',
        manufacture_year: 2024,
        motor_usage_code: 1,
        seating_capacity: 5,
      }),
      risks: [
        expect.objectContaining({
          risk_id: 'risk-1',
          risk_code: 'MOTOR01',
          sum_insured: '65000000',
          rate: '0.020000',
          basic_premium: '1300000',
        }),
      ],
    });
  });

  it('does not put nullable policy relationship fields into quotation form payloads', () => {
    const context = service.buildDraftContext({
      policy: makePolicy({
        intermediary_company_id: null,
        branch_id: null,
        department_id: null,
      }),
      version: makeVersion(makeSnapshot()),
      type: 'RENEWAL',
      effectiveDate: '2027-09-16',
      endDate: '2028-09-15',
      previousCoverNoteReference: 'CN-OLD',
    });

    expect(context.dto.draft_payload).toMatchObject({
      intermediary_company_id: '',
      branch_id: '',
      department_id: '',
    });
  });

  it('prefers an endorsement proposed snapshot when creating a transaction draft', () => {
    const sourceSnapshot = makeSnapshot();
    const proposedSnapshot = makeSnapshot({
      entries: [
        {
          ...(sourceSnapshot.entries as Record<string, unknown>[])[0],
          motor: {
            ...((sourceSnapshot.entries as Record<string, unknown>[])[0]
              .motor as Record<string, unknown>),
            chassisNumber: 'CHS-ENDORSED',
          },
          risks: [
            {
              insuranceRiskId: 'risk-1',
              riskCode: 'MOTOR01',
              sumInsured: '80000000',
            },
          ],
        },
      ],
    });

    const context = service.buildDraftContext({
      policy: makePolicy(),
      version: makeVersion(sourceSnapshot),
      transaction: {
        id: 'txn-1',
        transaction_no: 'END-001',
        transaction_type: 'ENDORSEMENT',
        source_policy_version_id: 'version-1',
        source_policy_version_no: 1,
        effective_date: '2026-10-01',
        source_policy_snapshot: sourceSnapshot,
        proposed_policy_snapshot: proposedSnapshot,
        proposed_policy_snapshot_hash: 'proposed-hash',
      } as any,
      type: 'ENDORSEMENT',
      effectiveDate: '2026-10-01',
      endDate: '2027-09-15',
      previousCoverNoteReference: 'CN-OLD',
      endorsementType: 1,
      endorsementReason: 'Increase sum insured',
    });

    expect(context.dto.draft_payload).toMatchObject({
      cover_note_type: '3',
      endorsement_type: '1',
      endorsement_reason: 'Increase sum insured',
      motor: expect.objectContaining({
        chassis_no: 'CHS-ENDORSED',
      }),
      sum_insured: '80000000.00',
      policy_transaction: expect.objectContaining({
        transaction_id: 'txn-1',
        proposed_policy_snapshot_hash: 'proposed-hash',
      }),
    });
  });
});
