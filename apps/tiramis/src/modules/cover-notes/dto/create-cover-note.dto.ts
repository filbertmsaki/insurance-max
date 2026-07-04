import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCoverNoteTaxDto {
  @ApiProperty({ example: 'VAT-MAINLAND' })
  taxCode!: string;

  @ApiPropertyOptional({ example: 'N' })
  isTaxExempted?: string;

  @ApiPropertyOptional({ nullable: true, example: '1' })
  taxExemptionType?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2334ER232TYU' })
  taxExemptionReference?: string | null;

  @ApiProperty({ example: '0.18' })
  taxRate!: string;

  @ApiProperty({ example: '720.00' })
  taxAmount!: string;
}

export class CreateCoverNoteDiscountDto {
  @ApiPropertyOptional({ nullable: true, example: 2 })
  discountType?: number | null;

  @ApiPropertyOptional({ nullable: true, example: '0.00' })
  discountRate?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1000.00' })
  discountAmount?: string | null;
}

export class CreateCoverNoteRiskDto {
  @ApiProperty({ example: 'SP005001000001' })
  riskCode!: string;

  @ApiProperty({ example: '1000000.00' })
  sumInsured!: string;

  @ApiProperty({ example: '1000000.00' })
  sumInsuredEquivalent!: string;

  @ApiProperty({ example: '0.005' })
  premiumRate!: string;

  @ApiProperty({ example: '5000.00' })
  premiumBeforeDiscount!: string;

  @ApiProperty({ example: '4000.00' })
  premiumAfterDiscount!: string;

  @ApiProperty({ example: '4000.00' })
  premiumExcludingTaxEquivalent!: string;

  @ApiProperty({ example: '4720.00' })
  premiumIncludingTax!: string;

  @ApiPropertyOptional({ type: () => [CreateCoverNoteDiscountDto] })
  discounts?: CreateCoverNoteDiscountDto[];

  @ApiPropertyOptional({ type: () => [CreateCoverNoteTaxDto] })
  taxes?: CreateCoverNoteTaxDto[];
}

export class CreateSubjectMatterDto {
  @ApiProperty({ example: 'HSB001' })
  subjectMatterReference!: string;

  @ApiProperty({ example: 'House water systems' })
  subjectMatterDesc!: string;
}

export class CreateCoverNoteAddonDto {
  @ApiProperty({ example: '1' })
  addonReference!: string;

  @ApiProperty({ example: 'Underground Water and Sewer Service Lines' })
  addonDesc!: string;

  @ApiProperty({ example: '2000.00' })
  addonAmount!: string;

  @ApiProperty({ example: '0.02' })
  addonPremiumRate!: string;

  @ApiProperty({ example: '40.00' })
  premiumExcludingTax!: string;

  @ApiProperty({ example: '40.00' })
  premiumExcludingTaxEquivalent!: string;

  @ApiProperty({ example: '47.20' })
  premiumIncludingTax!: string;

  @ApiPropertyOptional({ type: () => [CreateCoverNoteTaxDto] })
  taxes?: CreateCoverNoteTaxDto[];
}

export class CreatePolicyHolderDto {
  @ApiProperty({ example: 'Augustino Aidan Mwageni' })
  policyHolderName!: string;

  @ApiPropertyOptional({ nullable: true, example: '1920-02-05' })
  policyHolderBirthDate?: Date | string | null;

  @ApiProperty({ example: 1 })
  policyHolderType!: number;

  @ApiProperty({ example: '24241241' })
  policyHolderIdNumber!: string;

  @ApiProperty({ example: 1 })
  policyHolderIdType!: number;

  @ApiPropertyOptional({ nullable: true, example: '' })
  gender?: string | null;

  @ApiProperty({ example: 'TZA' })
  countryCode!: string;

  @ApiProperty({ example: 'Region' })
  region!: string;

  @ApiProperty({ example: 'Ilala' })
  district!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  street?: string | null;

  @ApiProperty({ example: '255713525539' })
  phoneNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  fax?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'P.O.BOX 1231, Dar es Salaam',
  })
  postalAddress?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'mimi@email.com' })
  emailAddress?: string | null;
}

export class CreateCoverNoteDto {
  @ApiProperty({
    example: 'ICC999',
    description:
      'TIRA code of the underwriting insurer. This comes from the client/participant setup, not from IDP technical config.',
  })
  insurerCompanyCode!: string;

  @ApiProperty({
    example: 'ICC999',
    description:
      'TIRA code of the company/entity that transacted or sold the cover. For direct insurer sale, this can be the same as insurerCompanyCode.',
  })
  tranCompanyCode!: string;

  @ApiProperty({ example: 1 })
  coverNoteType!: number;

  @ApiProperty({ example: 'NIC00004' })
  coverNoteNumber!: string;

  @ApiPropertyOptional({ nullable: true, example: '' })
  prevCoverNoteReferenceNumber?: string | null;

  @ApiProperty({ example: 'SP500' })
  salePointCode!: string;

  @ApiProperty({ example: '2021-07-04T01:15:22' })
  coverNoteStartDate!: Date | string;

  @ApiProperty({ example: '2022-07-04T23:59:59' })
  coverNoteEndDate!: Date | string;

  @ApiProperty({
    example:
      'CoverNote for Residential House Insurance at Dar es Salaam Magomeni',
  })
  coverNoteDesc!: string;

  @ApiProperty({ example: 'Fire and Allied Perils' })
  operativeClause!: string;

  @ApiProperty({ example: 1 })
  paymentMode!: number;

  @ApiProperty({ example: 'TZS' })
  currencyCode!: string;

  @ApiProperty({ example: '1.00' })
  exchangeRate!: string;

  @ApiProperty({ example: '29060.00' })
  totalPremiumExcludingTax!: string;

  @ApiProperty({ example: '33570.80' })
  totalPremiumIncludingTax!: string;

  @ApiPropertyOptional({ nullable: true, example: '0.00' })
  commissionPaid?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '0.00' })
  commissionRate?: string | null;

  @ApiProperty({ example: 'John Doe' })
  officerName!: string;

  @ApiProperty({ example: 'Underwriter' })
  officerTitle!: string;

  @ApiProperty({ example: 'SP005001000000' })
  productCode!: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  endorsementType?: number | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  endorsementReason?: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  endorsementPremiumEarned?: string | null;

  @ApiProperty({ type: () => [CreateCoverNoteRiskDto] })
  risks!: CreateCoverNoteRiskDto[];

  @ApiPropertyOptional({ type: () => [CreateSubjectMatterDto] })
  subjectMatters?: CreateSubjectMatterDto[];

  @ApiPropertyOptional({ type: () => [CreateCoverNoteAddonDto] })
  addons?: CreateCoverNoteAddonDto[];

  @ApiProperty({ type: () => [CreatePolicyHolderDto] })
  policyHolders!: CreatePolicyHolderDto[];
}
