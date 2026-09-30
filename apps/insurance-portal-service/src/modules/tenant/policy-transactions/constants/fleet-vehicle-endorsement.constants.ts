/** Endorsement types that add or remove whole fleet vehicles. */
export const FLEET_ADD_VEHICLE_CODE = 'FLEET_ADD_VEHICLE';
export const FLEET_REMOVE_VEHICLE_CODE = 'FLEET_REMOVE_VEHICLE';

export const FLEET_VEHICLE_ENDORSEMENT_CODES: readonly string[] = [
  FLEET_ADD_VEHICLE_CODE,
  FLEET_REMOVE_VEHICLE_CODE,
];

/** Snapshot `entries.N.status` values set by those endorsements. */
export const FLEET_ENTRY_ADDED = 'ADDED';
export const FLEET_ENTRY_REMOVED = 'REMOVED';
/**
 * Applied policy snapshots: an added vehicle becomes a normal active entry,
 * a removed one stays in `entries` as CANCELLED (off cover from
 * `removedEffectiveDate`), so later endorsements keep stable indices.
 */
export const FLEET_ENTRY_CANCELLED = 'CANCELLED';

/** Entry statuses that carry no cover for the remaining period. */
export const FLEET_OFF_COVER_STATUSES: readonly string[] = [
  FLEET_ENTRY_REMOVED,
  FLEET_ENTRY_CANCELLED,
];

/** Default minimum active vehicles after a removal (design decision D4). */
export const FLEET_MINIMUM_ACTIVE_VEHICLES = 2;

/** TIRAMIS FleetDtl.FleetEntry is Numeric(3). */
export const FLEET_MAXIMUM_ENTRY = 999;
