import { IssuanceService } from './issuance.service';

describe('IssuanceService Policy V1 snapshots', () => {
  function createService() {
    return new IssuanceService(
      {} as any,
      {
        hashDefinition: jest.fn(() => 'hash'),
      } as any,
      {} as any,
    );
  }

  it('preserves complete motor details in the asset snapshot', () => {
    const service = createService();
    const quotation = {
      risk_assets: [],
    } as any;
    const entry = {
      id: 'entry-1',
      entry_number: 1,
      entry_type: 'STANDARD',
      fleet_entry: null,
      cover_note_number: 'CN-LOCAL-1',
      prev_cover_note_reference_number: null,
      cover_note_desc: 'Motor Comprehensive',
      operative_clause: 'Standard Motor Cover',
      endorsement_type: null,
      endorsement_reason: null,
      endorsement_premium_earned: null,
      subject_matters: [],
      risks: [],
      motor_detail: {
        id: 'motor-1',
        motor_category: 1,
        motor_type: 1,
        registration_number: 'T123ABC',
        chassis_number: 'CHASSIS123',
        make: 'Toyota',
        model: 'Harrier',
        model_number: 'ZSU60',
        body_type: 'SUV',
        color: 'Black',
        engine_number: 'ENG123',
        engine_capacity: '2000',
        fuel_used: 'PETROL',
        number_of_axles: 2,
        axle_distance: '2.70',
        sitting_capacity: 5,
        year_of_manufacture: 2022,
        tare_weight: '1600',
        gross_weight: '2200',
        motor_usage: 1,
        owner_name: 'John Mushi',
        owner_category: 1,
        owner_address: 'Dar es Salaam',
      },
    } as any;

    const snapshot = (service as any).buildAssetSnapshot(entry, quotation);

    expect(snapshot.motor.registrationNumber).toBe('T123ABC');
    expect(snapshot.motor.engineNumber).toBe('ENG123');
    expect(snapshot.motor.yearOfManufacture).toBe(2022);
    expect(snapshot.motor.ownerName).toBe('John Mushi');
  });

  it('keeps root premium fields required by endorsement pricing', () => {
    const service = createService();
    const policy = {
      id: 'policy-1',
      policy_no: 'POL-001',
      policy_status: 'COVER_NOTE_ISSUED',
      policy_reference_number: null,
      cover_note_no: 'CN-001',
      issue_date: '2026-08-13',
      start_date: '2026-08-13',
      end_date: '2027-08-12',
      currency: 'TZS',
      sum_insured: '50000000',
      basic_premium: '1000000',
      total_discount: '0',
      total_tax: '180000',
      total_charges: '0',
      total_commission: '0',
      total_premium: '1180000',
      net_premium: '1180000',
      tira_portal_transaction_id: 'submission-1',
      tiramis_transaction_id: 'TX-1',
      tiramis_request_id: 'REQ-1',
      tiramis_service_type: 'MOTOR',
      tiramis_root_element: 'MotorCoverNoteResponse',
      tiramis_final_response_id: 'RESP-1',
      tiramis_final_response_status_code: '0',
      tiramis_final_response_status_desc: 'SUCCESS',
      regulatory_response_hash: 'response-hash',
    } as any;
    const quotation = {
      id: 'quotation-1',
      quotation_no: 'QT-001',
      quotation_type: 'MOTOR',
      quotation_flow: 'MOTOR_SINGLE',
      is_fleet: false,
      workflow_revision: 1,
      finalization_hash: 'final-hash',
      finalization_snapshot: {},
      customer_snapshot_hash: 'customer-hash',
      workflow_gate_hash: 'gate-hash',
      category_id: 'category-1',
      product_id: 'product-1',
      sub_class_id: null,
      product_version_id: 'product-version-1',
      product_definition_hash: 'product-hash',
      product_definition_snapshot: {},
      intermediary_company_id: null,
      channel_type: 'DIRECT',
      customer: null,
      customer_id: 'customer-1',
      policy_holders: [],
      risk_assets: [],
      cover_note: {
        cover_note_type: 1,
        sale_point_code: 'SP001',
        cover_note_start_date: new Date('2026-08-13'),
        cover_note_end_date: new Date('2027-08-12'),
        payment_mode: 1,
        currency_code: 'TZS',
        exchange_rate: '1',
        exchange_rate_snapshot: null,
        total_premium_excluding_tax: '1000000',
        total_premium_including_tax: '1180000',
        commission_paid: '0',
        commission_rate: '0',
        officer_name: 'Officer',
        officer_title: 'Underwriter',
        product_code: 'MOTOR',
        entries: [],
      },
    } as any;

    const snapshot = (service as any).buildPolicyContractSnapshot(
      policy,
      quotation,
      [],
      {
        id: 'tracking-1',
      } as any,
    );

    expect(snapshot.startDate).toBe('2026-08-13');
    expect(snapshot.endDate).toBe('2027-08-12');
    expect(snapshot.totals.totalPremium).toBe('1180000');
    expect(snapshot.schemaVersion).toBe(2);
  });
});
