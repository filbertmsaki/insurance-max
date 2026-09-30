import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import {
  createEmptyFleetDetails,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyNonMotorItemRow,
  createEmptyRiskRow,
  type QuotationFormSchemaValues,
} from '@/modules/tenant/quotations/schemas';
import type { UnderwriteLineMeta } from '../lines';

/**
 * Empty wizard form for a line, with the quotation flow pinned to the line.
 * Kept free of store/query imports so it can be unit tested in isolation.
 */
export function defaultValuesForLine(
  line: UnderwriteLineMeta,
): QuotationFormSchemaValues {
  return {
    insurer_company_id: '',
    intermediary_company_id: '',
    branch_id: '',
    department_id: '',
    policyholder_mode: 'existing',
    customer_id: '',
    policyholder: getCustomerDefaultValues(),
    category_id: '',
    product_id: '',
    sub_class_id: '',
    quotation_flow: line.quotationFlow,
    quotation_type: line.line === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR',
    is_fleet: line.line === 'FLEET',
    channel_type: 'DIRECT',
    status: 'DRAFT',
    currency: 'TZS',
    exchange_rate: '1',
    sum_insured: '',
    basic_premium: '',
    total_discount: '',
    total_tax: '',
    total_charges: '',
    total_commission: '',
    total_premium: '',
    net_premium: '',
    valid_from: '',
    valid_until: '',
    rating_version: '',
    rejection_reason: '',
    sale_point_id: '',
    cover_note_number: '',
    cover_note_desc: '',
    operative_clause: '',
    cover_note_type: '1',
    prev_cover_note_reference: '',
    endorsement_type: '',
    endorsement_reason: '',
    endorsement_premium_earned: '',
    commission_paid: '',
    commission_rate: '',
    officer_name: '',
    officer_title: '',
    payment_mode_tira: '1',
    risks: [createEmptyRiskRow()],
    addons: [],
    motor_mode: 'new',
    motor: createEmptyMotorDetails(),
    fleet: createEmptyFleetDetails(),
    nonMotor: {
      ...createEmptyNonMotorDetails(),
      items: [createEmptyNonMotorItemRow()],
    },
  };
}
