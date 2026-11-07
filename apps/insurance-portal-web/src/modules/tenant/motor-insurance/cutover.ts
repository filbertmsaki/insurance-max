/**
 * MF-7 controlled cutover (approved 2026-11-07).
 *
 * true:  the Motor Insurance module is the Motor/Fleet entry point for every
 *        user with Motor or Fleet access. The old Motor and Fleet sidebar
 *        groups are hidden and their quotation, policy and transaction URLs
 *        redirect into `/apps/motor/...`. Line dashboards, customers, the
 *        vehicle register and the fleet register keep their existing pages.
 * false: rollback. The pilot behaviour returns: old menus and routes as
 *        before, the new module only for holders of the pilot permission.
 *
 * The backend reads the same switch from `MOTOR_INSURANCE_CUTOVER` in
 * `@insurance-max/contracts`; flip both together.
 */
export { MOTOR_INSURANCE_CUTOVER } from '@insurance-max/contracts';
