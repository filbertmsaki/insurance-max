import { Injectable } from '@nestjs/common';
import { MotorVehicle } from '../entities/motor-vehicle.entity';

export interface TiraVehiclePayload {
  MotorCategory: number | null;
  MotorType: number | null;
  RegistrationNumber: string | null;
  ChassisNumber: string | null;
  Make: string | null;
  Model: string | null;
  ModelNumber: string | null;
  BodyType: string | null;
  Color: string | null;
  EngineNumber: string | null;
  EngineCapacity: string | number | null;
  FuelUsed: string | null;
  NumberOfAxles: number | null;
  AxleDistance: string | null;
  SittingCapacity: number | null;
  YearOfManufacture: number | null;
  TareWeight: string | null;
  GrossWeight: string | null;
  MotorUsage: number | null;
  OwnerName: string | null;
  OwnerCategory: number | null;
  OwnerAddress: string | null;
}

@Injectable()
export class TiraVehicleMapperService {
  mapVehicle(vehicle: MotorVehicle): TiraVehiclePayload {
    return {
      MotorCategory: vehicle.motor_category,
      MotorType: vehicle.motor_type,
      RegistrationNumber: vehicle.registration_no,
      ChassisNumber: vehicle.chassis_no,
      Make: vehicle.make,
      Model: vehicle.model,
      ModelNumber: vehicle.model_no,
      BodyType: vehicle.body_type,
      Color: vehicle.color,
      EngineNumber: vehicle.engine_no,
      EngineCapacity: vehicle.cubic_capacity,
      FuelUsed: vehicle.fuel_type,
      NumberOfAxles: vehicle.number_of_axles,
      AxleDistance: vehicle.axle_distance,
      SittingCapacity: vehicle.seating_capacity,
      YearOfManufacture: vehicle.manufacture_year,
      TareWeight: vehicle.tare_weight,
      GrossWeight: vehicle.gross_weight,
      MotorUsage: vehicle.motor_usage,
      OwnerName: vehicle.owner_name,
      OwnerCategory: vehicle.owner_category,
      OwnerAddress: vehicle.owner_address,
    };
  }
}
