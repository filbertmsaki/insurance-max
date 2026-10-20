# Vehicle reference data

## Seeded data

The independently rerunnable portal seeders are registered in `src/database/seeds/index.ts`:

- `016-vehicle-makes-models.seed.ts` imports makes and associated models from `data/vehiclesdb-2026.10.3.json`. The pinned source file contains 934 make entries and 15,068 make/model/category rows, which normalize to 14,459 distinct make/model names; exact normalized model names are coalesced per make, with their distinct vehicle kinds, body types, and source model slugs retained in model metadata. It seeds passenger vehicles, motorcycles, mopeds, vans, trucks, and buses.
- `017-vehicle-fuel-types.seed.ts` creates shared fuel labels. It does not infer fuel choices for model names. Fuel varies with model year, engine, variant, and market. The dataset's picker projection does not contain model/year/variant fuel mappings, so no model-specific fuel rows are asserted.
- `018-vehicle-body-types.seed.ts` seeds body type labels present in the pinned catalog.
- `019-vehicle-colours.seed.ts` seeds a shared generic exterior-colour list. It does not represent manufacturer paint names or codes; there is no universal worldwide vehicle-colour vocabulary.

Each seeder uses the existing normalized unique indexes, a PostgreSQL transaction/advisory lock, and `ON CONFLICT ... DO NOTHING`. Re-running them inserts missing records only: it does not rename, reactivate, deactivate, or overwrite administrator-managed records. Existing duplicate spellings are not guessed together; only exact normalized names coalesce. Model make relationships come from the source make slug and are inserted with the matching platform make ID.

Run only these vehicle reference seeders after migrations with `npm run seed:insurance-vehicle-reference-data`. The general `npm run seed:insurance-portal-service` command also includes them.

## Make/model source, coverage, and license

Source: [VehiclesDB](https://github.com/vehiclesdb/vehiclesdb), release **2026.10.3**, retrieved 2026-10-20 from `https://github.com/vehiclesdb/vehiclesdb/releases/download/v2026.10.3/vehicles.min.json`. The release is described as reconciling official vehicle registers, type-approval data, and government statistics across 14 countries and six kinds (cars, motorcycles, mopeds, vans, trucks, buses). Its rule requires agreement from two independent official sources or one strong official count. The source's headline counts and the compact picker file counts differ; this importer records the exact local file counts rather than claiming the larger headline count.

The country coverage includes European registers (Netherlands, UK, Spain, Finland, Luxembourg, Ireland, Germany, Norway, Switzerland's Thurgau canton, Romania, Ukraine), North American approval/catalog sources (United States and Canada), and registration sources in New Zealand, Malaysia, Thailand, Australia, Israel, and Argentina as listed by the release source notes. Some records are approval-only, some sources are attach-only, Switzerland is one canton, and the dataset itself warns that absence means “not catalogued,” not “does not exist.” It is broader than a single-country list but is not a worldwide registry. Tanzania and much of Africa, the Middle East, and other markets are not directly covered; grey imports/historical models may be absent.

VehiclesDB's `make` taxonomy is imported as the portal's selectable make label. It does not claim that every make is a separate legal manufacturer or corporate owner; manufacturer and brand structures vary by market. The NHTSA manufacturer registry is not merged into makes because that would combine different entity concepts and create false matches.

VehiclesDB data is CC BY 4.0. Required visible credit: **Vehicle data by [VehiclesDB](https://vehiclesdb.com)**. The release also carries upstream notices for the source registers; the complete pinned release attribution and source notes are copied to `src/database/seeds/data/VEHICLESDB-ATTRIBUTION-2026.10.3.md` and `VEHICLESDB-SOURCES-2026.10.3.md`. The seed file is a reduced make/model projection, not the full catalog evidence. Do not remove the attribution files or visible credit when redistributing the seeded data.

The authoritative US [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/Home/Index) is a useful complementary manufacturer-reported source for VIN-related makes/models; NHTSA says its data represents vehicles intended for sale/import in the US and results are limited outside that market. It is therefore documented as a future reconciliation source, not mixed into this seed where name/brand semantics could create false duplicates.

## Fuel types and model associations

Fuel labels are broad application choices informed by the [U.S. DOE Alternative Fuels Data Center](https://afdc.energy.gov/fuels) and [DOE alternative-fuel guidance](https://www.energy.gov/cmei/femp/federal-fleet-requirements-resource-center-alternative-fuel), plus conventional petrol/diesel and compatible labels already used in the portal. These are controlled labels, not fuel codes mandated worldwide. TIRA/TIRAMIS external mappings must be verified separately. Hybrid labels describe a powertrain/fuel combination in the existing free-text field, not a universal fuel taxonomy.

Fuel is **not** attached to make/model by this seed. Neither the compact source file nor the existing vehicle reference schema establishes verified model-year/variant applicability. Do not infer it from model names. If reliable source evidence is added later, model/year/variant and source evidence should be stored explicitly rather than treating a nameplate as having one permanent fuel.

## Colour and body type

The generic colour list is a curated controlled list for forms, not a worldwide standard. It includes common solid colours, metallic-like names, two-tone/multicolour, unpainted, and other. Admins should keep source paint names/codes separately if needed for a market or insurer.

Body-type starter labels come from observed values in VehiclesDB v2026.10.3. Coverage reflects that dataset and is not an international standard. Additional local/TIRA labels can be added by an authorized platform owner.

## Updating

For a refresh, choose a pinned VehiclesDB release (do not silently use `latest`), download its compact picker JSON, review its release notes, source notes, attribution and license notices, validate counts and make/model collisions, update the local snapshot/version in the seeder, and review the diff before running migrations/seeders. New rows are added; existing rows are never automatically renamed, merged, or deactivated. Keep model variants, trims, years and engine specifications out of the model name unless the upstream source treats that exact name as a model.
