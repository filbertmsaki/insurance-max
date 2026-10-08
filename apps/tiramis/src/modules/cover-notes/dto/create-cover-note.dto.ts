import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class CreateCoverNoteTaxDto {
  @ApiProperty({ example: 'VAT-MAINLAND' })
  @IsOptional()
  taxCode!: string;

  @ApiPropertyOptional({ example: 'N' })
  @IsOptional()
  isTaxExempted?: string;

  @ApiPropertyOptional({ nullable: true, example: '1' })
  @IsOptional()
  taxExemptionType?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2334ER232TYU' })
  @IsOptional()
  taxExemptionReference?: string | null;

  @ApiProperty({ example: '0.18' })
  @IsOptional()
  taxRate!: string;

  @ApiProperty({ example: '720.00' })
  @IsOptional()
  taxAmount!: string;
}

export class CreateCoverNoteDiscountDto {
  @ApiPropertyOptional({ nullable: true, example: 2 })
  @IsOptional()
  discountType?: number | null;

  @ApiPropertyOptional({ nullable: true, example: '0.00' })
  @IsOptional()
  discountRate?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1000.00' })
  @IsOptional()
  discountAmount?: string | null;
}

export class CreateCoverNoteRiskDto {
  @ApiProperty({ example: 'SP005001000001' })
  @IsOptional()
  riskCode!: string;

  @ApiProperty({ example: '1000000.00' })
  @IsOptional()
  sumInsured!: string;

  @ApiProperty({ example: '1000000.00' })
  @IsOptional()
  sumInsuredEquivalent!: string;

  @ApiProperty({ example: '0.005' })
  @IsOptional()
  premiumRate!: string;

  @ApiProperty({ example: '5000.00' })
  @IsOptional()
  premiumBeforeDiscount!: string;

  @ApiProperty({ example: '4000.00' })
  @IsOptional()
  premiumAfterDiscount!: string;

  @ApiProperty({ example: '4000.00' })
  @IsOptional()
  premiumExcludingTaxEquivalent!: string;

  @ApiProperty({ example: '4720.00' })
  @IsOptional()
  premiumIncludingTax!: string;

  @ApiPropertyOptional({ type: () => [CreateCoverNoteDiscountDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCoverNoteDiscountDto)
  discounts?: CreateCoverNoteDiscountDto[];

  @ApiProperty({ type: () => [CreateCoverNoteTaxDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCoverNoteTaxDto)
  taxes!: CreateCoverNoteTaxDto[];
}

export class CreateSubjectMatterDto {
  @ApiProperty({ example: 'HSB001' })
  @IsOptional()
  subjectMatterReference!: string;

  @ApiProperty({ example: 'House water systems' })
  @IsOptional()
  subjectMatterDesc!: string;
}

export class CreateCoverNoteAddonDto {
  @ApiProperty({ example: '1' })
  @IsOptional()
  addonReference!: string;

  @ApiProperty({ example: 'Underground Water and Sewer Service Lines' })
  @IsOptional()
  addonDesc!: string;

  @ApiProperty({ example: '2000.00' })
  @IsOptional()
  addonAmount!: string;

  @ApiProperty({ example: '0.02' })
  @IsOptional()
  addonPremiumRate!: string;

  @ApiProperty({ example: '40.00' })
  @IsOptional()
  premiumExcludingTax!: string;

  @ApiProperty({ example: '40.00' })
  @IsOptional()
  premiumExcludingTaxEquivalent!: string;

  @ApiProperty({ example: '47.20' })
  @IsOptional()
  premiumIncludingTax!: string;

  @ApiProperty({ type: () => [CreateCoverNoteTaxDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCoverNoteTaxDto)
  taxes!: CreateCoverNoteTaxDto[];
}

export class CreatePolicyHolderDto {
  @ApiProperty({ example: 'Augustino Aidan Mwageni' })
  @IsOptional()
  policyHolderName!: string;

  @ApiPropertyOptional({ nullable: true, example: '1920-02-05' })
  @IsOptional()
  policyHolderBirthDate?: Date | string | null;

  @ApiProperty({ example: 1 })
  @IsOptional()
  policyHolderType!: number;

  @ApiProperty({ example: '24241241' })
  @IsOptional()
  policyHolderIdNumber!: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  policyHolderIdType!: number;

  @ApiPropertyOptional({ nullable: true, example: '' })
  @IsOptional()
  gender?: string | null;

  @ApiProperty({ example: 'TZA' })
  @IsOptional()
  countryCode!: string;

  @ApiProperty({ example: 'Region' })
  @IsOptional()
  region!: string;

  @ApiProperty({ example: 'Ilala' })
  @IsOptional()
  district!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  @IsOptional()
  street?: string | null;

  @ApiProperty({ example: '255713525539' })
  @IsOptional()
  phoneNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  @IsOptional()
  fax?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'P.O.BOX 1231, Dar es Salaam',
  })
  @IsOptional()
  postalAddress?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'mimi@email.com' })
  @IsOptional()
  emailAddress?: string | null;
}

export class CreateCoverNoteDto {
  @ApiProperty({
    example: 'ICC999',
    description:
      'TIRA code of the underwriting insurer. This comes from the client/participant setup, not from IDP technical config.',
  })
  @IsOptional()
  insurerCompanyCode!: string;

  @ApiProperty({
    example: 'ICC999',
    description:
      'TIRA code of the company/entity that transacted or sold the cover. For direct insurer sale, this can be the same as insurerCompanyCode.',
  })
  @IsOptional()
  tranCompanyCode!: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  coverNoteType!: number;

  @ApiProperty({ example: 'NIC00004' })
  @IsOptional()
  coverNoteNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  @IsOptional()
  prevCoverNoteReferenceNumber?: string | null;

  @ApiProperty({ example: 'SP500' })
  @IsOptional()
  salePointCode!: string;

  @ApiProperty({ example: '2021-07-04T01:15:22' })
  @IsOptional()
  coverNoteStartDate!: Date | string;

  @ApiProperty({ example: '2022-07-04T23:59:59' })
  @IsOptional()
  coverNoteEndDate!: Date | string;

  @ApiProperty({
    example:
      'CoverNote for Residential House Insurance at Dar es Salaam Magomeni',
  })
  @IsOptional()
  coverNoteDesc!: string;

  @ApiProperty({ example: 'Fire and Allied Perils' })
  @IsOptional()
  operativeClause!: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  paymentMode!: number;

  @ApiProperty({ example: 'TZS' })
  @IsOptional()
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  @IsOptional()
  exchangeRate!: string;

  @ApiProperty({ example: '29060.00' })
  @IsOptional()
  totalPremiumExcludingTax!: string;

  @ApiProperty({ example: '33570.80' })
  @IsOptional()
  totalPremiumIncludingTax!: string;

  @ApiPropertyOptional({ nullable: true, example: '0.00' })
  @IsOptional()
  commissionPaid?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '0.00' })
  @IsOptional()
  commissionRate?: string | null;

  @ApiProperty({ example: 'John Doe' })
  @IsOptional()
  officerName!: string;

  @ApiProperty({ example: 'Underwriter' })
  @IsOptional()
  officerTitle!: string;

  @ApiProperty({ example: 'SP005001000000' })
  @IsOptional()
  productCode!: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  @IsOptional()
  endorsementType?: number | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  @IsOptional()
  endorsementReason?: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  @IsOptional()
  endorsementPremiumEarned?: string | null;

  @ApiProperty({ type: () => [CreateCoverNoteRiskDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCoverNoteRiskDto)
  risks!: CreateCoverNoteRiskDto[];

  @ApiProperty({ type: () => [CreateSubjectMatterDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSubjectMatterDto)
  subjectMatters!: CreateSubjectMatterDto[];

  @ApiPropertyOptional({ type: () => [CreateCoverNoteAddonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCoverNoteAddonDto)
  addons?: CreateCoverNoteAddonDto[];

  @ApiProperty({ type: () => [CreatePolicyHolderDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyHolderDto)
  policyHolders!: CreatePolicyHolderDto[];
}
