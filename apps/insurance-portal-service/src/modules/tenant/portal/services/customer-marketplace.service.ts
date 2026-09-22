import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';

import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceBusinessLine } from '../../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';

import {
  CustomerCompanyProductQueryDto,
  CustomerCompanyRiskQueryDto,
  CustomerCoverCheckDto,
} from '../dto/customer-marketplace.dto';
import { PortalActorType } from '../enums/portal.enums';
import { PortalAccountsService } from './portal-accounts.service';

@Injectable()
export class CustomerMarketplaceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly portalAccountsService: PortalAccountsService,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,
    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,
  ) {}

  async listEligibleCompanies(user: AuthenticatedUser) {
    this.assertAuthenticatedSession(user);

    const companies = await this.companyRepository.find({
      where: {
        status: 'active',
        company_type: CompanyType.INSURANCE_COMPANY,
      },
      order: { name: 'ASC' },
    });

    return companies
      .filter((company) => this.isCustomerPortalCompany(company))
      .map((company) => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo_url: company.logo_url,
        contact_email: company.contact_email,
        contact_phone: company.contact_phone,
        website: company.website,
        description: this.publicDescription(company),
        tira_ready: company.tira_integration_enabled === true,
      }));
  }

  async getEligibleCompany(companyId: string) {
    const company = await this.companyRepository.findOne({
      where: {
        id: companyId,
        status: 'active',
        company_type: CompanyType.INSURANCE_COMPANY,
      },
    });

    if (!company || !this.isCustomerPortalCompany(company)) {
      throw new NotFoundException('Insurance company is not available');
    }

    return company;
  }

  async listProducts(
    user: AuthenticatedUser,
    companyId: string,
    query: CustomerCompanyProductQueryDto,
  ) {
    this.assertAuthenticatedSession(user);
    await this.getEligibleCompany(companyId);

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.company_id = :companyId', { companyId })
      .andWhere('product.deleted_at IS NULL')
      .andWhere('product.is_active = true')
      .andWhere('product.lifecycle_status = :active', { active: 'ACTIVE' });

    if (query.motor_only ?? true) {
      qb.andWhere('product.business_line = :motor', {
        motor: InsuranceBusinessLine.MOTOR,
      });
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('product.product_name ILIKE :search', { search })
            .orWhere('product.description ILIKE :search')
            .orWhere('category.name ILIKE :search');
        }),
      );
    }

    const products = await qb.orderBy('product.product_name', 'ASC').getMany();

    return products.map((product) => ({
      id: product.id,
      name: product.product_name,
      description: product.description,
      business_line: product.business_line,
      supports_fleet: product.supports_fleet,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
          }
        : null,
    }));
  }

  async listRisks(
    user: AuthenticatedUser,
    companyId: string,
    productId: string,
    query: CustomerCompanyRiskQueryDto,
  ) {
    this.assertAuthenticatedSession(user);
    await this.getEligibleCompany(companyId);
    await this.assertProductBelongsToCompany(companyId, productId);

    const qb = this.riskRepository
      .createQueryBuilder('risk')
      .where('risk.company_id = :companyId', { companyId })
      .andWhere('risk.product_id = :productId', { productId })
      .andWhere('risk.deleted_at IS NULL')
      .andWhere('risk.is_active = true')
      .andWhere('risk.lifecycle_status = :active', { active: 'ACTIVE' });

    if (query.sub_class_id) {
      qb.andWhere('risk.sub_class_id = :subClassId', {
        subClassId: query.sub_class_id,
      });
    }

    const risks = await qb.orderBy('risk.risk_name', 'ASC').getMany();

    return risks.map((risk) => ({
      id: risk.id,
      name: risk.risk_name,
      description: risk.description,
      product_id: risk.product_id,
    }));
  }

  async ensureCompanyCustomerContext(
    user: AuthenticatedUser,
    companyId: string,
  ) {
    this.assertAuthenticatedSession(user);
    await this.getEligibleCompany(companyId);
    const account =
      await this.portalAccountsService.ensureCustomerAccountForCompany(
        user,
        companyId,
      );

    return {
      company_id: account.company_id,
      customer_id: account.customer_id,
      portal_account_id: account.id,
    };
  }

  async listMyVehicles(user: AuthenticatedUser) {
    this.assertAuthenticatedSession(user);

    const rows = await this.dataSource.query(
      `
      SELECT
        vehicle.id,
        vehicle.company_id,
        company.name AS company_name,
        vehicle.registration_no,
        vehicle.chassis_no,
        vehicle.make,
        vehicle.model,
        vehicle.color,
        vehicle.manufacture_year,
        vehicle.status,
        MAX(policy.end_date) AS latest_policy_expiry,
        MAX(policy.policy_status) AS latest_policy_status
      FROM portal_accounts account
      INNER JOIN motor_vehicles vehicle
        ON vehicle.company_id = account.company_id
       AND vehicle.customer_id = account.customer_id
       AND vehicle.deleted_at IS NULL
      INNER JOIN companies company
        ON company.id = vehicle.company_id
      LEFT JOIN motor_policy_details detail
        ON detail.motor_vehicle_id = vehicle.id
       AND detail.deleted_at IS NULL
      LEFT JOIN policies policy
        ON policy.id = detail.policy_id
       AND policy.deleted_at IS NULL
      WHERE account.user_id = $1
        AND account.actor_type = $2
        AND account.status = 'ACTIVE'
        AND account.customer_id IS NOT NULL
        AND account.deleted_at IS NULL
      GROUP BY
        vehicle.id,
        vehicle.company_id,
        company.name,
        vehicle.registration_no,
        vehicle.chassis_no,
        vehicle.make,
        vehicle.model,
        vehicle.color,
        vehicle.manufacture_year,
        vehicle.status
      ORDER BY COALESCE(MAX(policy.end_date), vehicle.updated_at::date) DESC
      `,
      [user.id, PortalActorType.CUSTOMER],
    );

    return rows;
  }

  async checkVehicleCover(user: AuthenticatedUser, dto: CustomerCoverCheckDto) {
    this.assertAuthenticatedSession(user);

    const registration = this.normalizeIdentifier(dto.registration_number);
    const chassis = this.normalizeIdentifier(dto.chassis_number);

    if (!registration && !chassis) {
      throw new BadRequestException(
        'Registration number or chassis number is required',
      );
    }

    const rows = await this.dataSource.query(
      `
      SELECT
        policy.id AS policy_id,
        policy.company_id,
        company.name AS insurance_company,
        policy.policy_status,
        policy.start_date,
        policy.end_date,
        vehicle.registration_no,
        vehicle.chassis_no,
        vehicle.make,
        vehicle.model,
        detail.cover_type
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
        AND (
          ($1::text IS NOT NULL AND vehicle.registration_no_normalized = $1)
          OR ($2::text IS NOT NULL AND vehicle.chassis_no_normalized = $2)
        )
        AND policy.policy_status NOT IN ('CANCELLED', 'VOID', 'EXPIRED')
        AND policy.end_date >= (timezone('Africa/Dar_es_Salaam', now()))::date
      ORDER BY policy.end_date DESC
      LIMIT 10
      `,
      [registration, chassis],
    );

    return {
      active: rows.length > 0,
      matches: rows.map((row: Record<string, unknown>) => ({
        insurance_company: row.insurance_company,
        cover_type: row.cover_type,
        effective_date: row.start_date,
        expiry_date: row.end_date,
        vehicle: {
          registration_no: row.registration_no,
          chassis_no: row.chassis_no,
          make: row.make,
          model: row.model,
        },
        status: 'ACTIVE',
      })),
    };
  }

  private async assertProductBelongsToCompany(
    companyId: string,
    productId: string,
  ) {
    const product = await this.productRepository.findOne({
      where: {
        id: productId,
        company_id: companyId,
        is_active: true,
      },
    });

    if (!product || product.lifecycle_status !== 'ACTIVE') {
      throw new NotFoundException('Insurance product is not available');
    }

    return product;
  }

  private assertAuthenticatedSession(user: AuthenticatedUser): void {
    if (!user.id) {
      throw new ForbiddenException(
        'Authenticated customer portal access is required',
      );
    }
  }

  private isCustomerPortalCompany(company: Company): boolean {
    const settings = company.settings ?? {};
    const metadata = company.metadata ?? {};

    const enabled =
      settings.allow_self_registration === true ||
      settings['customer_portal_enabled'] === true ||
      settings['allow_customer_portal_sales'] === true ||
      settings['enable_customer_portal_sales'] === true ||
      metadata['customer_portal_enabled'] === true ||
      metadata['allow_customer_portal_sales'] === true;

    return (
      enabled &&
      company.status === 'active' &&
      company.company_type === CompanyType.INSURANCE_COMPANY &&
      company.tira_integration_enabled === true
    );
  }

  private publicDescription(company: Company): string | null {
    const settings = company.settings ?? {};
    const metadata = company.metadata ?? {};
    const value =
      settings['customer_portal_description'] ??
      metadata['customer_portal_description'] ??
      metadata['public_description'];

    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private normalizeIdentifier(value?: string | null): string | null {
    const normalized = String(value ?? '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .trim();

    return normalized || null;
  }
}
