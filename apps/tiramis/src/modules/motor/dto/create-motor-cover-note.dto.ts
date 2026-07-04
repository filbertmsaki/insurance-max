import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  CreateCoverNoteAddonDto,
  CreateCoverNoteDto,
  CreateCoverNoteRiskDto,
  CreateSubjectMatterDto,
} from '../../cover-notes/dto/create-cover-note.dto';

export class CreateMotorDetailDto {
  @ApiPropertyOptional({ nullable: true, example: 1 })
  motorCategory?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  motorType?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'T123ABC' })
  registrationNumber?: string | null;

  @ApiProperty({ example: 'MOCKCHASSIS123456' })
  chassisNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: 'TOYOTA' })
  make?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'IST' })
  model?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'NCP60' })
  modelNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'SALOON' })
  bodyType?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'WHITE' })
  color?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'MOCKENGINE123' })
  engineNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1490' })
  engineCapacity?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'PETROL' })
  fuelUsed?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 2 })
  numberOfAxles?: number | null;

  @ApiPropertyOptional({ nullable: true, example: '2.37' })
  axleDistance?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 5 })
  sittingCapacity?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 2015 })
  yearOfManufacture?: number | null;

  @ApiPropertyOptional({ nullable: true, example: '1100.00' })
  tareWeight?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1500.00' })
  grossWeight?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  motorUsage?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'Mock Policy Holder' })
  ownerName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  ownerCategory?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'P.O. BOX 123, Dar es Salaam',
  })
  ownerAddress?: string | null;
}

export class CreateMotorFleetItemDto {
  @ApiPropertyOptional({ nullable: true, example: '1' })
  fleetEntry?: string | null;

  @ApiProperty({ example: 'MOTOR-CN-LOCAL-001' })
  coverNoteNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  prevCoverNoteReferenceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Fleet motor cover note' })
  coverNoteDesc?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Private motor comprehensive insurance',
  })
  operativeClause?: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  endorsementType?: number | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  endorsementReason?: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  endorsementPremiumEarned?: string | null;

  @ApiPropertyOptional({
    type: () => [CreateCoverNoteRiskDto],
    description:
      'Optional item-specific risks. If not provided, the parent fleet risks will be used.',
  })
  risks?: CreateCoverNoteRiskDto[];

  @ApiPropertyOptional({
    type: () => [CreateSubjectMatterDto],
    description:
      'Optional item-specific subject matters. If not provided, the parent fleet subject matters will be used.',
  })
  subjectMatters?: CreateSubjectMatterDto[];

  @ApiPropertyOptional({
    type: () => [CreateCoverNoteAddonDto],
    description:
      'Optional item-specific add-ons. If not provided, the parent fleet add-ons will be used.',
  })
  addons?: CreateCoverNoteAddonDto[];

  @ApiProperty({ type: () => CreateMotorDetailDto })
  motorDetail!: CreateMotorDetailDto;
}

export class CreateMotorFleetDto {
  @ApiProperty({ example: 'FLEET-001' })
  fleetId!: string;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  fleetType?: number | null;

  @ApiProperty({ example: 2 })
  fleetSize!: number;

  @ApiPropertyOptional({ nullable: true, example: '20000000.00' })
  comprehensiveInsured?: string | null;

  @ApiProperty({ type: () => [CreateMotorFleetItemDto] })
  items!: CreateMotorFleetItemDto[];
}

export class CreateMotorCoverNoteDto extends CreateCoverNoteDto {
  @ApiProperty({ example: false })
  isFleet!: boolean;

  @ApiPropertyOptional({ type: () => CreateMotorDetailDto })
  motorDetail?: CreateMotorDetailDto;

  @ApiPropertyOptional({ type: () => CreateMotorFleetDto })
  fleet?: CreateMotorFleetDto;
}
