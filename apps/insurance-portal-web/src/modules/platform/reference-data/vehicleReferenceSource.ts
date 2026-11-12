import { createContext, useContext } from 'react';

/**
 * Where vehicle pick lists load from. Staff screens use the signed-in
 * reference-data API; the customer portal and public website have no staff
 * login and use the public, read-only, active-only endpoint.
 */
export type VehicleReferenceSource = 'staff' | 'public';

export const VehicleReferenceSourceContext =
  createContext<VehicleReferenceSource>('staff');

export const VehicleReferenceSourceProvider =
  VehicleReferenceSourceContext.Provider;

export function useVehicleReferenceSource(): VehicleReferenceSource {
  return useContext(VehicleReferenceSourceContext);
}
