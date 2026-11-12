import { PublicVehicleReferenceController } from './public-vehicle-reference.controller';
import type { ReferenceDataService } from './reference-data.service';

describe('PublicVehicleReferenceController', () => {
  const service = {
    listVehicleMakes: jest.fn(),
    listVehicleModels: jest.fn(),
    listVehicleAttributes: jest.fn(),
  };
  const controller = new PublicVehicleReferenceController(
    service as unknown as ReferenceDataService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('only ever returns active entries, even if asked for inactive ones', () => {
    controller.listMakes({ is_active: false, search: 'toy' });
    controller.listModels({ is_active: false, make_id: 'm1' });
    controller.listAttributes('fuel_type', { is_active: false });

    expect(service.listVehicleMakes).toHaveBeenCalledWith({
      is_active: true,
      search: 'toy',
    });
    expect(service.listVehicleModels).toHaveBeenCalledWith({
      is_active: true,
      make_id: 'm1',
    });
    expect(service.listVehicleAttributes).toHaveBeenCalledWith('fuel_type', {
      is_active: true,
    });
  });
});
