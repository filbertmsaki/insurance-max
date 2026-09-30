import type { PolicyLookupRisk } from '../types';

export function riskTitle(risk: PolicyLookupRisk) {
  if (risk.vehicle) {
    return [risk.vehicle.registration_no, risk.vehicle.make, risk.vehicle.model]
      .filter(Boolean)
      .join(' · ');
  }
  return risk.subject_matter?.description ?? risk.risk_name ?? 'Insured risk';
}

export function riskMeta(risk: PolicyLookupRisk) {
  if (risk.vehicle) {
    return [
      risk.vehicle.chassis_no && `Chassis ${risk.vehicle.chassis_no}`,
      risk.vehicle.body_type,
      risk.vehicle.manufacture_year,
      risk.risk_name,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return [risk.risk_name, risk.risk_code].filter(Boolean).join(' · ');
}

/** True when the loss falls outside the policy's period of cover (EAT dates). */
export function outsideCover(
  lossDate: string,
  start?: string | null,
  end?: string | null,
) {
  const loss = new Date(lossDate).getTime();
  if (!Number.isFinite(loss) || !start || !end) return false;
  const from = new Date(`${start.slice(0, 10)}T00:00:00+03:00`).getTime();
  const to = new Date(`${end.slice(0, 10)}T23:59:59+03:00`).getTime();
  return loss < from || loss > to;
}
