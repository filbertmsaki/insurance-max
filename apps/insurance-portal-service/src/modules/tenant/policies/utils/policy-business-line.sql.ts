/**
 * SQL expression resolving a policy's underwrite line (MOTOR | FLEET | NON_MOTOR).
 *
 * Prefers the stored `business_line`; falls back to the source quotation flow,
 * then the product business line, so policies written before the column
 * existed (or created manually without a quotation) are still classified.
 */
export function policyBusinessLineSql(alias = 'policy'): string {
  return `COALESCE(
    ${alias}.business_line,
    (
      SELECT CASE source_quotation.quotation_flow
        WHEN 'MOTOR_FLEET' THEN 'FLEET'
        WHEN 'MOTOR_SINGLE' THEN 'MOTOR'
        ELSE 'NON_MOTOR'
      END
      FROM quotations source_quotation
      WHERE source_quotation.id = ${alias}.quotation_id
    ),
    (
      SELECT CASE source_product.business_line
        WHEN 'MOTOR' THEN 'MOTOR'
        ELSE 'NON_MOTOR'
      END
      FROM insurance_products source_product
      WHERE source_product.id = ${alias}.product_id
    )
  )`;
}
