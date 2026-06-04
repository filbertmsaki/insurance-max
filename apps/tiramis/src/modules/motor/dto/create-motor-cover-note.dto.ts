import type { CreateCoverNoteDto } from '../../cover-notes/dto/create-cover-note.dto';

export interface CreateMotorDetailDto {
  motorCategory?: number | null;
  motorType?: number | null;
  registrationNumber?: string | null;
  chassisNumber: string;
  make?: string | null;
  model?: string | null;
  modelNumber?: string | null;
  bodyType?: string | null;
  color?: string | null;
  engineNumber?: string | null;
  engineCapacity?: string | null;
  fuelUsed?: string | null;
  numberOfAxles?: number | null;
  axleDistance?: string | null;
  sittingCapacity?: number | null;
  yearOfManufacture?: number | null;
  tareWeight?: string | null;
  grossWeight?: string | null;
  motorUsage?: number | null;
  ownerName?: string | null;
  ownerCategory?: number | null;
  ownerAddress?: string | null;
}

export interface CreateMotorFleetItemDto {
  fleetEntry?: string | null;
  coverNoteNumber: string;
  prevCoverNoteReferenceNumber?: string | null;
  coverNoteDesc?: string | null;
  operativeClause?: string | null;
  endorsementType?: number | null;
  endorsementReason?: string | null;
  endorsementPremiumEarned?: string | null;
  motorDetail: CreateMotorDetailDto;
}

export interface CreateMotorFleetDto {
  fleetId: string;
  fleetType?: number | null;
  fleetSize: number;
  comprehensiveInsured?: string | null;
  items: CreateMotorFleetItemDto[];
}

export interface CreateMotorCoverNoteDto extends CreateCoverNoteDto {
  isFleet: boolean;
  motorDetail?: CreateMotorDetailDto;
  fleet?: CreateMotorFleetDto;
}
