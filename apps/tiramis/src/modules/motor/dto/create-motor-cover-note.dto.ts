import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

import {
  CreateCoverNoteAddonDto,
  CreateCoverNoteDto,
  CreateCoverNoteRiskDto,
  CreateSubjectMatterDto,
} from '../../cover-notes/dto/create-cover-note.dto';

export class CreateMotorDetailDto {
  @ApiPropertyOptional({ nullable: true, example: 1 })
  @IsOptional()
  motorCategory?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  @IsOptional()
  motorType?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'T123ABC' })
  @IsOptional()
  registrationNumber?: string | null;

  @ApiProperty({ example: 'MOCKCHASSIS123456' })
  @IsOptional()
  chassisNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: 'TOYOTA' })
  @IsOptional()
  make?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'IST' })
  @IsOptional()
  model?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'NCP60' })
  @IsOptional()
  modelNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'SALOON' })
  @IsOptional()
  bodyType?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'WHITE' })
  @IsOptional()
  color?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'MOCKENGINE123' })
  @IsOptional()
  engineNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1490' })
  @IsOptional()
  engineCapacity?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'PETROL' })
  @IsOptional()
  fuelUsed?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 2 })
  @IsOptional()
  numberOfAxles?: number | null;

  @ApiPropertyOptional({ nullable: true, example: '2.37' })
  @IsOptional()
  axleDistance?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 5 })
  @IsOptional()
  sittingCapacity?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 2015 })
  @IsOptional()
  yearOfManufacture?: number | null;

  @ApiPropertyOptional({ nullable: true, example: '1100.00' })
  @IsOptional()
  tareWeight?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1500.00' })
  @IsOptional()
  grossWeight?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  @IsOptional()
  motorUsage?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'Mock Policy Holder' })
  @IsOptional()
  ownerName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  @IsOptional()
  ownerCategory?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'P.O. BOX 123, Dar es Salaam',
  })
  @IsOptional()
  ownerAddress?: string | null;
}

export class CreateMotorFleetItemDto {
  @ApiPropertyOptional({ nullable: true, example: '1' })
  @IsOptional()
  fleetEntry?: string | null;

  @ApiProperty({ example: 'MOTOR-CN-LOCAL-001' })
  @IsOptional()
  coverNoteNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  @IsOptional()
  prevCoverNoteReferenceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Fleet motor cover note' })
  @IsOptional()
  coverNoteDesc?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Private motor comprehensive insurance',
  })
  @IsOptional()
  operativeClause?: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  @IsOptional()
  endorsementType?: number | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  @IsOptional()
  endorsementReason?: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  @IsOptional()
  endorsementPremiumEarned?: string | null;

  @ApiPropertyOptional({
    type: () => [CreateCoverNoteRiskDto],
    description:
      'Optional item-specific risks. If not provided, the parent fleet risks will be used.',
  })
  @IsOptional()
  risks?: CreateCoverNoteRiskDto[];

  @ApiPropertyOptional({
    type: () => [CreateSubjectMatterDto],
    description:
      'Optional item-specific subject matters. If not provided, the parent fleet subject matters will be used.',
  })
  @IsOptional()
  subjectMatters?: CreateSubjectMatterDto[];

  @ApiPropertyOptional({
    type: () => [CreateCoverNoteAddonDto],
    description:
      'Optional item-specific add-ons. If not provided, the parent fleet add-ons will be used.',
  })
  @IsOptional()
  addons?: CreateCoverNoteAddonDto[];

  @ApiProperty({ type: () => CreateMotorDetailDto })
  @IsOptional()
  motorDetail!: CreateMotorDetailDto;
}

export class CreateMotorFleetDto {
  @ApiProperty({ example: 'FLEET-001' })
  @IsOptional()
  fleetId!: string;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  @IsOptional()
  fleetType?: number | null;

  @ApiProperty({ example: 2 })
  @IsOptional()
  fleetSize!: number;

  @ApiPropertyOptional({ nullable: true, example: '20000000.00' })
  @IsOptional()
  comprehensiveInsured?: string | null;

  @ApiProperty({ type: () => [CreateMotorFleetItemDto] })
  @IsOptional()
  items!: CreateMotorFleetItemDto[];
}

export class CreateMotorCoverNoteDto extends CreateCoverNoteDto {
  @ApiProperty({ example: false })
  @IsOptional()
  isFleet!: boolean;

  @ApiPropertyOptional({ type: () => CreateMotorDetailDto })
  @IsOptional()
  motorDetail?: CreateMotorDetailDto;

  @ApiPropertyOptional({ type: () => CreateMotorFleetDto })
  @IsOptional()
  fleet?: CreateMotorFleetDto;
}
