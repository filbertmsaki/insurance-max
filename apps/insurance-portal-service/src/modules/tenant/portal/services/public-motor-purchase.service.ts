import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataScopePermissions } from '@insurance-max/contracts';
import { DataSource } from 'typeorm';

import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { Company } from '../../../platform/companies/entities/company.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { InsuranceBusinessLine } from '../../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { PremiumCalculationService } from '../../premium-calculation/premium-calculation.service';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { QuotationType } from '../../quotations/enums/quotation-type.enum';
import { QuotationsService } from '../../quotations/quotations.service';
import { Tax } from '../../taxes/entities/tax.entity';
import { TiramisSalePointEntity } from '../../../tiramis/entities/tiramis-sale-point.entity';
import { VerificationsService } from '../../verifications/verifications.service';
import { MotorVerificationCategory } from '../../verifications/dto/verify.dto';

import {
  PublicMotorQuoteDto,
  PublicMotorSubmitDto,
  PublicMotorVerifyDto,
} from '../dto/public-motor-purchase.dto';

type PricingResult = Awaited<
  ReturnType<PremiumCalculationService['calculateSingleRisk']>
>;

@Injectable()
export class PublicMotorPurchaseService {
  private readonly logger = new Logger(PublicMotorPurchaseService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly verificationsService: VerificationsService,
    private readonly premiumCalculationService: PremiumCalculationService,
    private readonly quotationsService: QuotationsService,
  ) {}

  async options() {
    const companies = await this.companyRepository()
      .createQueryBuilder('company')
      .where('company.deleted_at IS NULL')
      .andWhere('company.status = :status', { status: 'active' })
      .andWhere('company.company_type = :type', {
        type: CompanyType.INSURANCE_COMPANY,
      })
      .orderBy('company.name', 'ASC')
      .getMany();

    const result: Array<{
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      tira_ready: boolean;
      default_branch: {
        id: string;
        name: string;
        sale_point_name: string | null;
      } | null;
      products: Awaited<
        ReturnType<PublicMotorPurchaseService['listCompanyMotorProducts']>
      >;
    }> = [];

    for (const company of companies) {
      const products = await this.listCompanyMotorProducts(company.id);
      if (products.length === 0) continue;

      const defaultContext = await this.resolveDefaultBranchContext(
        company.id,
        false,
      );

      result.push({
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo_url: company.logo_url,
        tira_ready: company.tira_integration_enabled === true,
        default_branch: defaultContext
          ? {
              id: defaultContext.branchId,
              name: defaultContext.branchName,
              sale_point_name: defaultContext.salePointName,
            }
          : null,
        products,
      });
    }

    return { companies: result };
  }

  async verify(dto: PublicMotorVerifyDto) {
    const company = await this.resolvePublicCompany(dto.company_id);
    const registration = this.normalizeRegistration(dto.registration_number);
    const user = this.publicActor(company.id, null);

    const internalCover = await this.findInternalCover(registration);
    if (internalCover.active) {
      return {
        status: 'ACTIVE_COVER',
        active_cover: internalCover.matches[0],
        company_context: this.publicCompany(company),
        vehicle: {
          registration_number: registration,
          owner_name: dto.full_name.trim(),
        },
        message: 'This vehicle already has active insurance.',
      };
    }

    const coverVerification = await this.safeTiramisCall('cover-check', () =>
      this.verificationsService.verifyCoverNote(user, {
        motorRegistrationNumber: registration,
      }),
    );

    if (this.isActiveTiramisCover(coverVerification)) {
      return {
        status: 'ACTIVE_COVER',
        active_cover: this.mapTiramisCover(coverVerification, registration),
        company_context: this.publicCompany(company),
        vehicle: this.mapVehicleDetails(null, registration, dto.full_name),
        message: 'This vehicle already has active insurance.',
      };
    }

    const vehicleVerification = await this.safeTiramisCall(
      'vehicle-verification',
      () =>
        this.verificationsService.verifyMotor(user, {
          motorCategory:
            dto.motor_category ?? MotorVerificationCategory.MOTOR_VEHICLE,
          motorRegistrationNumber: registration,
        }),
      { allowNotFound: true },
    );

    return {
      status: 'NO_ACTIVE_COVER',
      cover_check: this.sanitizeVerification(coverVerification),
      company_context: this.publicCompany(company),
      vehicle: this.mapVehicleDetails(
        vehicleVerification,
        registration,
        dto.full_name,
      ),
      message: 'No active insurance cover was found for this vehicle.',
    };
  }

  async quote(dto: PublicMotorQuoteDto) {
    const context = await this.resolveQuoteContext(
      dto.company_id,
      dto.product_id,
      dto.risk_id,
    );
    const pricing = await this.calculatePremium(context.company.id, dto);

    return this.buildQuoteResponse(context, dto, pricing);
  }

  async submit(dto: PublicMotorSubmitDto) {
    if (!dto.confirmed) {
      throw new BadRequestException(
        'Please confirm the quote before submitting.',
      );
    }

    const context = await this.resolveQuoteContext(
      dto.company_id,
      dto.product_id,
      dto.risk_id,
    );
    const pricing = await this.calculatePremium(context.company.id, dto);
    const payload = this.buildQuotationPayload(context, dto, pricing);
    const user = this.publicActor(
      context.company.id,
      context.defaultBranch.branchId,
    );

    try {
      return await this.quotationsService.submitCustomerPortalQuotation(
        context.company.id,
        (
          await this.quotationsService.createCustomerPortalDraft(
            context.company.id,
            payload.draft,
            user,
          )
        ).id,
        payload.final as never,
        user,
      );
    } catch (error) {
      this.logger.error(
        `Public motor purchase submission failed for ${dto.vehicle.registration_number}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw this.customerSafeError(error);
    }
  }

  private async resolveQuoteContext(
    companyId: string,
    productId: string,
    riskId: string,
  ) {
    const company = await this.companyRepository().findOne({
      where: {
        id: companyId,
        status: 'active',
        company_type: CompanyType.INSURANCE_COMPANY,
      },
    });

    if (!company) {
      throw new NotFoundException(
        'The selected insurance company is not available.',
      );
    }

    const product = await this.productRepository()
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.current_version', 'currentVersion')
      .where('product.id = :productId', { productId })
      .andWhere('product.company_id = :companyId', { companyId })
      .andWhere('product.deleted_at IS NULL')
      .andWhere('product.is_active = true')
      .andWhere('product.lifecycle_status = :status', { status: 'ACTIVE' })
      .andWhere('product.business_line = :businessLine', {
        businessLine: InsuranceBusinessLine.MOTOR,
      })
      .getOne();

    if (!product) {
      throw new NotFoundException(
        'The selected motor product is not available.',
      );
    }

    const risk = await this.riskRepository().findOne({
      where: {
        id: riskId,
        company_id: companyId,
        product_id: productId,
        is_active: true,
        lifecycle_status: 'ACTIVE',
      },
    });

    if (!risk || risk.deleted_at) {
      throw new NotFoundException('The selected motor cover is not available.');
    }

    const defaultBranch = await this.resolveDefaultBranchContext(
      companyId,
      true,
    );
    const vat = await this.resolveDefaultVat(companyId);

    return { company, product, risk, defaultBranch, vat };
  }

  private async calculatePremium(
    companyId: string,
    dto: PublicMotorQuoteDto,
  ): Promise<PricingResult> {
    const start = dto.cover_start_date ?? this.today();
    const end = dto.cover_end_date ?? this.addDays(start, 364);
    const sumInsured = Number(dto.sum_insured ?? dto.vehicle.gross_weight ?? 0);
    const factors = {
      ...(dto.factors ?? {}),
      sum_insured: sumInsured,
      seat_capacity: dto.vehicle.sitting_capacity,
      sitting_capacity: dto.vehicle.sitting_capacity,
      year_of_manufacture: dto.vehicle.year_of_manufacture,
      gross_weight_tons: dto.vehicle.gross_weight,
      gross_weight: dto.vehicle.gross_weight,
      engine_capacity:
        Number(dto.vehicle.engine_capacity) || dto.vehicle.engine_capacity,
      motor_usage: dto.vehicle.motor_usage,
      motor_type: dto.vehicle.motor_type,
    };
    const vat = await this.resolveDefaultVat(companyId);

    try {
      return await this.premiumCalculationService.calculateSingleRisk(
        companyId,
        {
          risk_id: dto.risk_id,
          sum_insured: sumInsured,
          factors,
          effective_date: start,
          cover_start_date: start,
          cover_end_date: end,
          quotation_type: QuotationType.MOTOR,
          currency_code: 'TZS',
          exchange_rate: 1,
          tax_codes: vat ? [vat.tax_code] : [],
          client_reference: this.normalizeRegistration(
            dto.vehicle.registration_number,
          ),
        },
        null,
        this.publicActor(companyId, null),
      );
    } catch (error) {
      this.logger.warn(
        `Public motor pricing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException(
        'We could not calculate a premium for the selected cover. Please review the vehicle details and try again.',
      );
    }
  }

  private buildQuoteResponse(
    context: Awaited<
      ReturnType<PublicMotorPurchaseService['resolveQuoteContext']>
    >,
    dto: PublicMotorQuoteDto,
    pricing: PricingResult,
  ) {
    const taxes = this.mapTaxes(pricing, context.vat);

    return {
      company: this.publicCompany(context.company),
      product: {
        id: context.product.id,
        name: context.product.product_name,
        product_code: context.product.product_code,
      },
      risk: {
        id: context.risk.id,
        name: context.risk.risk_name,
        risk_code: context.risk.risk_code,
      },
      default_branch: {
        id: context.defaultBranch.branchId,
        name: context.defaultBranch.branchName,
        sale_point_name: context.defaultBranch.salePointName,
      },
      vehicle: dto.vehicle,
      policy_holder: dto.policy_holder,
      cover_period: {
        start_date: dto.cover_start_date ?? this.today(),
        end_date:
          dto.cover_end_date ??
          this.addDays(dto.cover_start_date ?? this.today(), 364),
      },
      premium: {
        pricing_quote_id: pricing.pricing_quote_id,
        basic_premium: pricing.premium_before_discount,
        discount_amount: pricing.discount_amount ?? 0,
        premium_after_discount: pricing.premium_after_discount,
        charges_amount: pricing.total_charge_amount ?? 0,
        taxes,
        vat_amount: taxes.reduce((sum, tax) => sum + tax.tax_amount, 0),
        total_amount_payable: pricing.final_payable_premium,
        currency: 'TZS',
      },
    };
  }

  private buildQuotationPayload(
    context: Awaited<
      ReturnType<PublicMotorPurchaseService['resolveQuoteContext']>
    >,
    dto: PublicMotorSubmitDto,
    pricing: PricingResult,
  ) {
    const coverStart = dto.cover_start_date ?? this.today();
    const coverEnd = dto.cover_end_date ?? this.addDays(coverStart, 364);
    const taxes = this.mapTaxes(pricing, context.vat);
    const riskCode = context.risk.tiramis_risk_code || context.risk.risk_code;
    const productCode =
      context.product.tiramis_product_code || context.product.product_code;
    const coverDescription =
      context.product.current_version?.cover_note_description ||
      context.product.description ||
      context.product.product_name;
    const operativeClause =
      context.product.current_version?.operative_clause ||
      context.product.current_version?.policy_operative_clause ||
      coverDescription;
    const premiumExcludingTax = pricing.premium_excluding_tax_equivalent;
    const premiumIncludingTax = pricing.final_payable_premium;

    const draftPayload = {
      source: 'PUBLIC_MOTOR_PURCHASE',
      valid_from: coverStart,
      valid_until: coverEnd,
      currency: 'TZS',
      exchange_rate: 1,
      basic_premium: premiumExcludingTax,
      total_tax: taxes.reduce((sum, tax) => sum + tax.tax_amount, 0),
      total_premium: premiumIncludingTax,
      payment_mode_tira: '1',
      public_idempotency_key: dto.idempotency_key ?? null,
      motor: dto.vehicle,
      policyholder: dto.policy_holder,
    };

    return {
      draft: {
        insurer_company_id: context.company.id,
        intermediary_company_id: null,
        department_id: null,
        customer_id: null,
        category_id: context.product.category_id,
        product_id: context.product.id,
        sub_class_id: context.risk.sub_class_id,
        quotation_type: QuotationType.MOTOR,
        quotation_flow: QuotationFlow.MOTOR_SINGLE,
        channel_type: ProductChannelType.DIRECT,
        is_fleet: false,
        current_wizard_step: 'public-summary',
        draft_payload: draftPayload,
      },
      final: {
        internal_quotation: {
          insurer_company_id: context.company.id,
          intermediary_company_id: null,
          branch_id: context.defaultBranch.branchId,
          department_id: null,
          category_id: context.product.category_id,
          product_id: context.product.id,
          sub_class_id: context.risk.sub_class_id,
          quotation_type: QuotationType.MOTOR,
          quotation_flow: QuotationFlow.MOTOR_SINGLE,
          channel_type: ProductChannelType.DIRECT,
          is_fleet: false,
        },
        cover_note_hdr: {
          cover_note_type:
            context.product.current_version?.cover_note_type ?? 1,
        },
        cover_note_dtl: {
          sale_point_code: context.defaultBranch.salePointCode,
          cover_note_start_date: `${coverStart}T00:00:00`,
          cover_note_end_date: `${coverEnd}T23:59:59`,
          cover_note_desc: coverDescription,
          operative_clause: operativeClause,
          payment_mode: 1,
          currency_code: 'TZS',
          exchange_rate: 1,
          total_premium_excluding_tax: premiumExcludingTax,
          total_premium_including_tax: premiumIncludingTax,
          commision_paid: 0,
          commision_rate: 0,
          officer_name: 'Public Motor Purchase',
          officer_title: 'Customer Self Service',
          product_code: productCode,
          risks_covered: [
            {
              risk_code: riskCode,
              pricing_quote_id: pricing.pricing_quote_id,
              sum_insured: pricing.sum_insured,
              sum_insured_equivalent: pricing.sum_insured_equivalent,
              premium_rate: pricing.premium_rate,
              premium_before_discount: pricing.premium_before_discount,
              premium_after_discount: pricing.premium_after_discount,
              premium_excluding_tax_equivalent: premiumExcludingTax,
              premium_including_tax: premiumIncludingTax,
              discounts_offered:
                pricing.discount_amount > 0
                  ? [
                      {
                        discount_type: 1,
                        discount_rate: pricing.discount_rate ?? 0,
                        discount_amount: pricing.discount_amount,
                        request_reason_code: null,
                        request_comment: null,
                        approval_required: pricing.discount_approval_required,
                        approval_status: pricing.discount_approval_required
                          ? ('PENDING' as const)
                          : ('NOT_REQUIRED' as const),
                      },
                    ]
                  : [],
              taxes_charged: taxes.map((tax) => ({
                tax_code: tax.tax_code,
                is_tax_exempted: 'N',
                tax_exemption_type: null,
                tax_exemption_reference: null,
                tax_rate: tax.tax_rate,
                tax_amount: tax.tax_amount,
              })),
            },
          ],
          subject_matters_covered: [
            {
              subject_matter_reference: dto.vehicle.registration_number,
              subject_matter_desc:
                `${dto.vehicle.make} ${dto.vehicle.model} ${dto.vehicle.registration_number}`.trim(),
            },
          ],
          cover_note_addons: [],
          policy_holders: [this.cleanPolicyHolder(dto.policy_holder)],
          motor_dtl: {
            motor_category: dto.vehicle.motor_category,
            motor_type: dto.vehicle.motor_type,
            registration_number: dto.vehicle.registration_number,
            chassis_number: dto.vehicle.chassis_number,
            make: dto.vehicle.make,
            model: dto.vehicle.model,
            model_number: dto.vehicle.model_number ?? null,
            body_type: dto.vehicle.body_type,
            color: dto.vehicle.color,
            engine_number: dto.vehicle.engine_number,
            engine_capacity: dto.vehicle.engine_capacity,
            fuel_used: dto.vehicle.fuel_used,
            number_of_axles: dto.vehicle.number_of_axles,
            axle_distance: dto.vehicle.axle_distance,
            sitting_capacity: dto.vehicle.sitting_capacity,
            year_of_manufacture: dto.vehicle.year_of_manufacture,
            tare_weight: dto.vehicle.tare_weight,
            gross_weight: dto.vehicle.gross_weight,
            motor_usage: dto.vehicle.motor_usage,
            owner_name: dto.vehicle.owner_name,
            owner_category: dto.vehicle.owner_category,
            owner_address: dto.vehicle.owner_address,
          },
        },
      },
    };
  }

  private async listCompanyMotorProducts(companyId: string) {
    const products = await this.productRepository()
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.company_id = :companyId', { companyId })
      .andWhere('product.deleted_at IS NULL')
      .andWhere('product.is_active = true')
      .andWhere('product.lifecycle_status = :status', { status: 'ACTIVE' })
      .andWhere('product.business_line = :businessLine', {
        businessLine: InsuranceBusinessLine.MOTOR,
      })
      .orderBy('product.product_name', 'ASC')
      .getMany();

    const risks = await this.riskRepository().find({
      where: {
        company_id: companyId,
        is_active: true,
        lifecycle_status: 'ACTIVE',
      },
      order: { risk_name: 'ASC' },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.product_name,
      description: product.description,
      product_code: product.product_code,
      tiramis_product_code: product.tiramis_product_code,
      category_id: product.category_id,
      category_name: product.category?.name ?? null,
      risks: risks
        .filter((risk) => risk.product_id === product.id && !risk.deleted_at)
        .map((risk) => ({
          id: risk.id,
          name: risk.risk_name,
          description: risk.description,
          risk_code: risk.risk_code,
          tiramis_risk_code: risk.tiramis_risk_code,
          sub_class_id: risk.sub_class_id,
        })),
    }));
  }

  private async resolvePublicCompany(companyId?: string) {
    if (companyId) {
      const company = await this.companyRepository().findOne({
        where: {
          id: companyId,
          status: 'active',
          company_type: CompanyType.INSURANCE_COMPANY,
        },
      });
      if (!company)
        throw new NotFoundException('Insurance company is not available.');
      return company;
    }

    const optionPayload = await this.options();
    const firstCompany = optionPayload.companies[0];
    if (!firstCompany) {
      throw new NotFoundException('No public motor insurer is configured.');
    }

    return this.companyRepository().findOneByOrFail({ id: firstCompany.id });
  }

  private async resolveDefaultBranchContext(
    companyId: string,
    required: true,
  ): Promise<{
    branchId: string;
    branchName: string;
    salePointCode: string;
    salePointName: string | null;
  }>;
  private async resolveDefaultBranchContext(
    companyId: string,
    required: false,
  ): Promise<{
    branchId: string;
    branchName: string;
    salePointCode: string;
    salePointName: string | null;
  } | null>;
  private async resolveDefaultBranchContext(
    companyId: string,
    required: boolean,
  ) {
    const branch = await this.dataSource.getRepository(Branch).findOne({
      where: {
        company_id: companyId,
        is_head_office: true,
        status: 'active',
      },
      order: { created_at: 'ASC' },
    });

    if (!branch || branch.deleted_at) {
      if (!required) return null;
      throw new BadRequestException(
        'The selected insurer has no active default branch configured.',
      );
    }

    const salePoint = await this.dataSource
      .getRepository(TiramisSalePointEntity)
      .findOne({
        where: {
          companyId,
          branchId: branch.id,
          isDefault: true,
          isActive: true,
        },
      });

    if (!salePoint) {
      if (!required) return null;
      throw new BadRequestException(
        'The selected insurer has no default TIRAMIS sales point configured.',
      );
    }

    return {
      branchId: branch.id,
      branchName: branch.name,
      salePointCode: salePoint.salePointCode.trim().toUpperCase(),
      salePointName: salePoint.salePointName,
    };
  }

  private async resolveDefaultVat(companyId: string) {
    return this.dataSource.getRepository(Tax).findOne({
      where: {
        company_id: companyId,
        tax_code: 'VAT-MAINLAND',
        is_active: true,
      },
    });
  }

  private async findInternalCover(registration: string) {
    const rows = await this.dataSource.query(
      `
      SELECT
        company.name AS insurance_company,
        detail.cover_type,
        policy.start_date,
        policy.end_date,
        vehicle.registration_no,
        vehicle.chassis_no,
        vehicle.make,
        vehicle.model
      FROM motor_vehicles vehicle
      INNER JOIN motor_policy_details detail
        ON detail.motor_vehicle_id = vehicle.id
       AND detail.deleted_at IS NULL
      INNER JOIN policies policy
        ON policy.id = detail.policy_id
       AND policy.deleted_at IS NULL
      INNER JOIN companies company
        ON company.id = policy.company_id
      WHERE vehicle.deleted_at IS NULL
        AND vehicle.registration_no_normalized = $1
        AND policy.policy_status NOT IN ('CANCELLED', 'VOID', 'EXPIRED')
        AND policy.end_date >= (timezone('Africa/Dar_es_Salaam', now()))::date
      ORDER BY policy.end_date DESC
      LIMIT 1
      `,
      [registration],
    );

    return {
      active: rows.length > 0,
      matches: rows.map((row: Record<string, unknown>) => ({
        vehicle_registration_number: row.registration_no,
        cover_type: row.cover_type,
        insurance_company: row.insurance_company,
        cover_start_date: row.start_date,
        cover_end_date: row.end_date,
        vehicle: {
          chassis_number: row.chassis_no,
          make: row.make,
          model: row.model,
        },
      })),
    };
  }

  private async safeTiramisCall<T>(
    label: string,
    callback: () => Promise<T>,
    options: { allowNotFound?: boolean } = {},
  ): Promise<T | null> {
    try {
      const result = await callback();
      if (options.allowNotFound && this.isNotFoundTiramisResponse(result)) {
        return result;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Public ${label} failed: ${message}`);
      if (options.allowNotFound && this.isNotFoundTiramisResponse(error)) {
        return null;
      }
      throw new BadGatewayException(
        'We could not complete the vehicle verification right now. Please try again shortly.',
      );
    }
  }

  private isActiveTiramisCover(result: unknown): boolean {
    const response = result as Record<string, unknown> | null;
    if (!response || this.isNotFoundTiramisResponse(response)) return false;
    return (
      response['success'] === true &&
      String(response['responseCode'] ?? '').toUpperCase() === 'TIRA001'
    );
  }

  private isNotFoundTiramisResponse(value: unknown): boolean {
    const serialized = JSON.stringify(value ?? {}).toLowerCase();
    return (
      serialized.includes('tira007') ||
      serialized.includes('requested data could not be found')
    );
  }

  private mapTiramisCover(result: unknown, registration: string) {
    const response = result as Record<string, unknown>;
    const details = this.verificationDetails(response['verifiedRecordDetails']);

    return {
      vehicle_registration_number:
        this.firstText(details, [
          'motorRegistrationNumber',
          'MotorRegistrationNumber',
          'registrationNumber',
          'RegistrationNumber',
        ]) ?? registration,
      cover_type: this.firstText(details, [
        'coverType',
        'cover_note_type',
        'CoverNoteTypeDesc',
        'CoverNoteType',
        'ProductName',
      ]),
      insurance_company: this.firstText(details, [
        'insuranceCompany',
        'insurerName',
        'companyName',
        'InsurerCompanyName',
        'TransactionCompanyName',
        'InsurerCompanyCode',
      ]),
      cover_start_date: this.firstText(details, [
        'coverNoteStartDate',
        'CoverNoteStartDate',
        'coverStartDate',
        'CoverStartDate',
        'startDate',
        'StartDate',
      ]),
      cover_end_date: this.firstText(details, [
        'coverNoteEndDate',
        'CoverNoteEndDate',
        'coverEndDate',
        'CoverEndDate',
        'expiryDate',
        'ExpiryDate',
        'endDate',
        'EndDate',
      ]),
    };
  }

  private mapVehicleDetails(
    verification: unknown,
    registration: string,
    ownerName: string,
  ) {
    const response = verification as Record<string, unknown> | null;
    const details = this.verificationDetails(
      response?.['verifiedRecordDetails'],
    );

    return {
      motor_category: MotorVerificationCategory.MOTOR_VEHICLE,
      motor_type:
        this.firstNumber(details, ['motorType', 'MotorType', 'motor_type']) ??
        1,
      registration_number:
        this.firstText(details, [
          'motorRegistrationNumber',
          'MotorRegistrationNumber',
          'registrationNumber',
          'RegistrationNumber',
          'registration_no',
        ]) ?? registration,
      chassis_number:
        this.firstText(details, [
          'chassisNumber',
          'ChassisNumber',
          'chassis_no',
        ]) ?? '',
      make: this.firstText(details, ['make', 'Make', 'motorMake']) ?? '',
      model: this.firstText(details, ['model', 'Model', 'motorModel']) ?? '',
      model_number:
        this.firstText(details, ['modelNumber', 'ModelNumber', 'model_no']) ??
        '',
      body_type:
        this.firstText(details, ['bodyType', 'BodyType', 'body_type']) ?? '',
      color: this.firstText(details, ['color', 'Color', 'colour']) ?? '',
      engine_number:
        this.firstText(details, [
          'engineNumber',
          'EngineNumber',
          'engine_no',
        ]) ?? '',
      engine_capacity:
        this.firstText(details, [
          'engineCapacity',
          'EngineCapacity',
          'cubicCapacity',
        ]) ?? '',
      fuel_used:
        this.firstText(details, ['fuelUsed', 'FuelUsed', 'fuelType']) ?? '',
      number_of_axles:
        this.firstNumber(details, [
          'numberOfAxles',
          'NumberOfAxles',
          'number_of_axles',
        ]) ?? 2,
      axle_distance:
        this.firstNumber(details, [
          'axleDistance',
          'AxleDistance',
          'axle_distance',
        ]) ?? 0,
      sitting_capacity:
        this.firstNumber(details, [
          'sittingCapacity',
          'SittingCapacity',
          'seatingCapacity',
        ]) ?? 1,
      year_of_manufacture:
        this.firstNumber(details, [
          'yearOfManufacture',
          'YearOfManufacture',
          'manufactureYear',
          'manufacture_year',
        ]) ?? new Date().getFullYear(),
      tare_weight:
        this.firstNumber(details, [
          'tareWeight',
          'TareWeight',
          'tare_weight',
        ]) ?? 0,
      gross_weight:
        this.firstNumber(details, [
          'grossWeight',
          'GrossWeight',
          'gross_weight',
        ]) ?? 0,
      motor_usage:
        this.firstNumber(details, [
          'motorUsage',
          'MotorUsage',
          'motor_usage',
        ]) ?? 1,
      owner_name:
        this.firstText(details, [
          'ownerName',
          'OwnerName',
          'registeredOwnerName',
        ]) ?? ownerName,
      owner_category:
        this.firstNumber(details, [
          'ownerCategory',
          'OwnerCategory',
          'owner_category',
        ]) ?? 1,
      owner_address:
        this.firstText(details, [
          'ownerAddress',
          'OwnerAddress',
          'registeredOwnerAddress',
        ]) ?? '',
    };
  }

  private mapTaxes(pricing: PricingResult, vat: Tax | null) {
    const taxCharges = (pricing.charges ?? [])
      .filter(
        (charge) => String(charge.charge_category).toUpperCase() === 'TAX',
      )
      .map((charge) => ({
        tax_code: charge.charge_code,
        tax_name: charge.charge_name,
        tax_rate: charge.rate ?? (vat ? Number(vat.tax_rate) : 0),
        tax_amount: charge.computed_amount,
      }));

    if (taxCharges.length > 0) return taxCharges;
    if (!vat || pricing.total_tax_amount <= 0) return [];

    return [
      {
        tax_code: vat.tax_code,
        tax_name: vat.tax_name,
        tax_rate: Number(vat.tax_rate),
        tax_amount: pricing.total_tax_amount,
      },
    ];
  }

  private cleanPolicyHolder(
    holder: PublicMotorQuoteDto['policy_holder'],
  ): PublicMotorQuoteDto['policy_holder'] {
    return {
      ...holder,
      gender: holder.gender || null,
      street: holder.street || null,
      policy_holder_fax: holder.policy_holder_fax || null,
      postal_address: holder.postal_address || null,
      email_address: holder.email_address || null,
    };
  }

  private publicActor(
    companyId: string,
    branchId: string | null,
  ): AuthenticatedUser {
    return {
      id: null as unknown as string,
      email: 'public-motor-purchase@system.local',
      sessionId: 'public-motor-purchase',
      accessTokenId: 'public-motor-purchase',
      authorizationVersion: 1,
      username: 'public-motor-purchase',
      userType: 'COMPANY_USER',
      scope: 'company',
      companyId,
      companyType: CompanyType.INSURANCE_COMPANY,
      companyMembershipId: `public-motor-purchase:${companyId}`,
      activeBranchId: branchId,
      assignedBranchIds: branchId ? [branchId] : [],
      permissions: [
        DataScopePermissions.COMPANY_ALL,
        'pricing.calculate',
        'quotations:complete',
        'quotations:submit-tiramis',
      ],
      roles: [],
    } as AuthenticatedUser;
  }

  private publicCompany(company: Company) {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      logo_url: company.logo_url,
    };
  }

  private sanitizeVerification(verification: unknown) {
    const response = verification as Record<string, unknown> | null;
    if (!response) return null;
    return {
      success: response['success'] ?? false,
      status: response['status'] ?? null,
      responseCode: response['responseCode'] ?? null,
      responseMessage: response['responseMessage'] ?? null,
      requestId: response['requestId'] ?? null,
      transactionId: response['transactionId'] ?? null,
    };
  }

  private customerSafeError(error: unknown) {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      return error;
    }
    return new BadGatewayException(
      'We could not submit the motor insurance purchase right now. Please try again shortly.',
    );
  }

  private normalizeRegistration(value: string): string {
    const normalized = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!normalized) {
      throw new BadRequestException('Vehicle registration number is required.');
    }
    return normalized;
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private addDays(date: string, days: number) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private verificationDetails(value: unknown): Record<string, unknown> {
    const record = this.asRecord(value);
    const responseDetails = this.asRecord(record['responseDetails']);
    const details = this.asRecord(record['details']);

    return {
      ...record,
      ...responseDetails,
      ...details,
    };
  }

  private firstText(
    source: Record<string, unknown>,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
    return null;
  }

  private firstNumber(
    source: Record<string, unknown>,
    keys: string[],
  ): number | null {
    for (const key of keys) {
      const value = source[key];
      const parsed = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private companyRepository() {
    return this.dataSource.getRepository(Company);
  }

  private productRepository() {
    return this.dataSource.getRepository(InsuranceProduct);
  }

  private riskRepository() {
    return this.dataSource.getRepository(InsuranceRisk);
  }
}
