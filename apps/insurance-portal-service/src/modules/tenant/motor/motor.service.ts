import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationEntryRisk } from '../quotations/entities/structured/quotation-entry-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { User } from '../users/entities/user.entity';
import { CreateMotorFleetDto } from './dto/create-motor-fleet.dto';
import { CreateMotorFleetItemDto } from './dto/create-motor-fleet-item.dto';
import { CreateMotorPolicyDetailDto } from './dto/create-motor-policy-detail.dto';
import { CreateMotorVehicleDto } from './dto/create-motor-vehicle.dto';
import { FilterMotorDto } from './dto/filter-motor.dto';
import { UpdateMotorFleetDto } from './dto/update-motor-fleet.dto';
import { UpdateMotorFleetItemDto } from './dto/update-motor-fleet-item.dto';
import { UpdateMotorPolicyDetailDto } from './dto/update-motor-policy-detail.dto';
import { UpdateMotorVehicleDto } from './dto/update-motor-vehicle.dto';
import { MotorFleet } from './entities/motor-fleet.entity';
import { MotorFleetItem } from './entities/motor-fleet-item.entity';
import { MotorPolicyDetail } from './entities/motor-policy-detail.entity';
import { MotorVehicle } from './entities/motor-vehicle.entity';

type NumericLike = number | string | null | undefined;

@Injectable()
export class MotorService {
  constructor(
    @InjectRepository(MotorVehicle)
    private readonly motorVehicleRepository: Repository<MotorVehicle>,

    @InjectRepository(MotorFleet)
    private readonly motorFleetRepository: Repository<MotorFleet>,

    @InjectRepository(MotorFleetItem)
    private readonly motorFleetItemRepository: Repository<MotorFleetItem>,

    @InjectRepository(MotorPolicyDetail)
    private readonly motorPolicyDetailRepository: Repository<MotorPolicyDetail>,

    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,

    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,

    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,

    @InjectRepository(QuotationEntryRisk)
    private readonly quotationEntryRiskRepository: Repository<QuotationEntryRisk>,

    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,

    @InjectRepository(PolicyRisk)
    private readonly policyRiskRepository: Repository<PolicyRisk>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string | number } }
    ).driverError;
    return (
      driverError?.code === '23505' ||
      String(driverError?.code ?? '') === '1062'
    );
  }

  private normalizeText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized.length ? normalized : null;
  }

  private normalizeMoney(value: NumericLike): string {
    const num =
      value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(num))
      throw new BadRequestException('Invalid numeric value');
    return String(Math.round(num * 100) / 100);
  }

  private async ensureCompany(companyId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) throw new BadRequestException('Company not found');
    return company;
  }

  private async ensureCustomer(
    companyId: string,
    customerId: string,
  ): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId, company_id: companyId },
    });
    if (!customer)
      throw new BadRequestException('Customer not found for this company');
    return customer;
  }

  private async ensureQuotation(
    companyId: string,
    quotationId: string,
  ): Promise<Quotation> {
    const quotation = await this.quotationRepository.findOne({
      where: { id: quotationId, company_id: companyId },
    });
    if (!quotation)
      throw new BadRequestException('Quotation not found for this company');
    return quotation;
  }

  private async ensureQuotationEntryRisk(
    companyId: string,
    quotationEntryRiskId: string,
  ): Promise<QuotationEntryRisk> {
    const risk = await this.quotationEntryRiskRepository.findOne({
      where: { id: quotationEntryRiskId },
      relations: {
        entry: {
          cover_note: {
            quotation: true,
          },
        },
      },
    });
    if (!risk || risk.entry.cover_note.quotation.company_id !== companyId) {
      throw new BadRequestException(
        'Quotation entry risk not found for this company',
      );
    }
    return risk;
  }

  private async ensureMotorVehicle(
    companyId: string,
    motorVehicleId: string,
  ): Promise<MotorVehicle> {
    const vehicle = await this.motorVehicleRepository.findOne({
      where: { id: motorVehicleId, company_id: companyId },
    });
    if (!vehicle)
      throw new BadRequestException('Motor vehicle not found for this company');
    return vehicle;
  }

  private async ensurePolicy(
    companyId: string,
    policyId: string,
  ): Promise<Policy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, company_id: companyId },
    });
    if (!policy)
      throw new BadRequestException('Policy not found for this company');
    return policy;
  }

  private async ensurePolicyRisk(
    companyId: string,
    policyRiskId: string,
  ): Promise<PolicyRisk> {
    const risk = await this.policyRiskRepository.findOne({
      where: { id: policyRiskId },
      relations: { policy: true },
    });
    if (!risk || risk.policy.company_id !== companyId) {
      throw new BadRequestException('Policy risk not found for this company');
    }
    return risk;
  }

  private async ensureFleet(
    companyId: string,
    fleetId: string,
  ): Promise<MotorFleet> {
    const fleet = await this.motorFleetRepository.findOne({
      where: { id: fleetId, company_id: companyId },
    });
    if (!fleet)
      throw new BadRequestException('Motor fleet not found for this company');
    return fleet;
  }

  private async listWithPagination<T>(
    qb: any,
    query: FilterMotorDto,
    allowedSortFields: string[],
    defaultSortBy: string,
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = defaultSortBy,
      sortOrder = SortDirection.DESC,
    } = query;
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : defaultSortBy;
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    qb.orderBy(qb.alias + '.' + safeSortBy, direction);

    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async createVehicle(
    companyId: string,
    dto: CreateMotorVehicleDto,
    userId: string,
  ) {
    await this.ensureCompany(companyId);
    await this.ensureCustomer(companyId, dto.customer_id);

    const vehicle = this.motorVehicleRepository.create({
      company_id: companyId,
      customer_id: dto.customer_id,
      registration_no: this.normalizeText(dto.registration_no),
      chassis_no: this.normalizeText(dto.chassis_no),
      engine_no: this.normalizeText(dto.engine_no),
      make: this.normalizeText(dto.make),
      model: this.normalizeText(dto.model),
      body_type: this.normalizeText(dto.body_type),
      color: this.normalizeText(dto.color),
      manufacture_year: dto.manufacture_year ?? null,
      usage_type: this.normalizeText(dto.usage_type),
      vehicle_category: this.normalizeText(dto.vehicle_category),
      seating_capacity: dto.seating_capacity ?? null,
      tonnage:
        dto.tonnage !== undefined && dto.tonnage !== null
          ? this.normalizeMoney(dto.tonnage)
          : null,
      cubic_capacity: dto.cubic_capacity ?? null,
      fuel_type: this.normalizeText(dto.fuel_type),
      model_no: this.normalizeText(dto.model_no),
      number_of_axles: dto.number_of_axles ?? null,
      axle_distance:
        dto.axle_distance !== undefined && dto.axle_distance !== null
          ? this.normalizeMoney(dto.axle_distance)
          : null,
      tare_weight:
        dto.tare_weight !== undefined && dto.tare_weight !== null
          ? this.normalizeMoney(dto.tare_weight)
          : null,
      gross_weight:
        dto.gross_weight !== undefined && dto.gross_weight !== null
          ? this.normalizeMoney(dto.gross_weight)
          : null,
      motor_category: dto.motor_category ?? null,
      motor_type: dto.motor_type ?? null,
      motor_usage: dto.motor_usage ?? null,
      owner_name: this.normalizeText(dto.owner_name),
      owner_category: dto.owner_category ?? null,
      owner_address: this.normalizeText(dto.owner_address),
      vehicle_value: this.normalizeMoney(dto.vehicle_value),
      currency: dto.currency?.trim().toUpperCase() ?? 'TZS',
      status: dto.status?.trim().toUpperCase() ?? 'ACTIVE',
      metadata: dto.metadata ?? null,
      created_by: userId,
      updated_by: userId,
    });

    try {
      return await this.motorVehicleRepository.save(vehicle);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A motor vehicle with the same identifier already exists in this company',
        );
      }
      throw error;
    }
  }

  async listVehicles(companyId: string, query: FilterMotorDto) {
    const qb = this.motorVehicleRepository
      .createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.customer', 'customer')
      .where('vehicle.company_id = :companyId', { companyId });

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(vehicle.registration_no ILIKE :term OR vehicle.chassis_no ILIKE :term OR vehicle.engine_no ILIKE :term OR vehicle.make ILIKE :term OR vehicle.model ILIKE :term)',
        { term },
      );
    }

    return this.listWithPagination(
      qb,
      query,
      ['registration_no', 'make', 'model', 'created_at', 'updated_at'],
      'created_at',
    );
  }

  async findVehicle(companyId: string, id: string) {
    const vehicle = await this.motorVehicleRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        customer: true,
        company: true,
        creator: true,
        updater: true,
      },
    });
    if (!vehicle) throw new NotFoundException('Motor vehicle not found');
    return vehicle;
  }

  async updateVehicle(
    companyId: string,
    id: string,
    dto: UpdateMotorVehicleDto,
    userId: string,
  ) {
    const vehicle = await this.findVehicle(companyId, id);
    if (dto.customer_id !== undefined) {
      await this.ensureCustomer(companyId, dto.customer_id);
      vehicle.customer_id = dto.customer_id;
    }
    if (dto.registration_no !== undefined)
      vehicle.registration_no = this.normalizeText(dto.registration_no);
    if (dto.chassis_no !== undefined)
      vehicle.chassis_no = this.normalizeText(dto.chassis_no);
    if (dto.engine_no !== undefined)
      vehicle.engine_no = this.normalizeText(dto.engine_no);
    if (dto.make !== undefined) vehicle.make = this.normalizeText(dto.make);
    if (dto.model !== undefined) vehicle.model = this.normalizeText(dto.model);
    if (dto.body_type !== undefined)
      vehicle.body_type = this.normalizeText(dto.body_type);
    if (dto.color !== undefined) vehicle.color = this.normalizeText(dto.color);
    if (dto.manufacture_year !== undefined)
      vehicle.manufacture_year = dto.manufacture_year ?? null;
    if (dto.usage_type !== undefined)
      vehicle.usage_type = this.normalizeText(dto.usage_type);
    if (dto.vehicle_category !== undefined)
      vehicle.vehicle_category = this.normalizeText(dto.vehicle_category);
    if (dto.seating_capacity !== undefined)
      vehicle.seating_capacity = dto.seating_capacity ?? null;
    if (dto.tonnage !== undefined)
      vehicle.tonnage =
        dto.tonnage === null ? null : this.normalizeMoney(dto.tonnage);
    if (dto.cubic_capacity !== undefined)
      vehicle.cubic_capacity = dto.cubic_capacity ?? null;
    if (dto.model_no !== undefined)
      vehicle.model_no = this.normalizeText(dto.model_no);
    if (dto.number_of_axles !== undefined)
      vehicle.number_of_axles = dto.number_of_axles ?? null;
    if (dto.axle_distance !== undefined)
      vehicle.axle_distance =
        dto.axle_distance === null
          ? null
          : this.normalizeMoney(dto.axle_distance);
    if (dto.tare_weight !== undefined)
      vehicle.tare_weight =
        dto.tare_weight === null ? null : this.normalizeMoney(dto.tare_weight);
    if (dto.gross_weight !== undefined)
      vehicle.gross_weight =
        dto.gross_weight === null
          ? null
          : this.normalizeMoney(dto.gross_weight);
    if (dto.motor_category !== undefined)
      vehicle.motor_category = dto.motor_category ?? null;
    if (dto.motor_type !== undefined)
      vehicle.motor_type = dto.motor_type ?? null;
    if (dto.motor_usage !== undefined)
      vehicle.motor_usage = dto.motor_usage ?? null;
    if (dto.owner_name !== undefined)
      vehicle.owner_name = this.normalizeText(dto.owner_name);
    if (dto.owner_category !== undefined)
      vehicle.owner_category = dto.owner_category ?? null;
    if (dto.owner_address !== undefined)
      vehicle.owner_address = this.normalizeText(dto.owner_address);
    if (dto.fuel_type !== undefined)
      vehicle.fuel_type = this.normalizeText(dto.fuel_type);
    if (dto.vehicle_value !== undefined)
      vehicle.vehicle_value = this.normalizeMoney(dto.vehicle_value);
    if (dto.currency !== undefined)
      vehicle.currency = dto.currency.trim().toUpperCase();
    if (dto.status !== undefined)
      vehicle.status = dto.status.trim().toUpperCase();
    if (dto.metadata !== undefined) vehicle.metadata = dto.metadata ?? null;
    vehicle.updated_by = userId;

    try {
      return await this.motorVehicleRepository.save(vehicle);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A motor vehicle with the same identifier already exists in this company',
        );
      }
      throw error;
    }
  }

  async removeVehicle(companyId: string, id: string): Promise<void> {
    const vehicle = await this.findVehicle(companyId, id);
    await this.motorVehicleRepository.softDelete(vehicle.id);
  }

  async createFleet(companyId: string, dto: CreateMotorFleetDto) {
    await this.ensureCompany(companyId);
    await this.ensureCustomer(companyId, dto.customer_id);
    if (dto.quotation_id)
      await this.ensureQuotation(companyId, dto.quotation_id);
    if (dto.policy_id) await this.ensurePolicy(companyId, dto.policy_id);

    const fleet = this.motorFleetRepository.create({
      company_id: companyId,
      customer_id: dto.customer_id,
      quotation_id: dto.quotation_id ?? null,
      policy_id: dto.policy_id ?? null,
      fleet_no: dto.fleet_no.trim(),
      fleet_name: this.normalizeText(dto.fleet_name),
      total_vehicles: dto.total_vehicles ?? 0,
      total_sum_insured: this.normalizeMoney(dto.total_sum_insured),
      total_premium: this.normalizeMoney(dto.total_premium),
      status: dto.status?.trim().toUpperCase() ?? 'ACTIVE',
    });

    try {
      return await this.motorFleetRepository.save(fleet);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A motor fleet with the same fleet number already exists in this company',
        );
      }
      throw error;
    }
  }

  async listFleets(companyId: string, query: FilterMotorDto) {
    const qb = this.motorFleetRepository
      .createQueryBuilder('fleet')
      .leftJoinAndSelect('fleet.customer', 'customer')
      .leftJoinAndSelect('fleet.quotation', 'quotation')
      .where('fleet.company_id = :companyId', { companyId });

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(fleet.fleet_no ILIKE :term OR fleet.fleet_name ILIKE :term)',
        { term },
      );
    }

    return this.listWithPagination(
      qb,
      query,
      ['fleet_no', 'fleet_name', 'created_at', 'updated_at'],
      'created_at',
    );
  }

  async findFleet(companyId: string, id: string) {
    const fleet = await this.motorFleetRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        customer: true,
        quotation: true,
        company: true,
        items: true,
      },
    });
    if (!fleet) throw new NotFoundException('Motor fleet not found');
    return fleet;
  }

  async updateFleet(companyId: string, id: string, dto: UpdateMotorFleetDto) {
    const fleet = await this.findFleet(companyId, id);
    if (dto.customer_id !== undefined) {
      await this.ensureCustomer(companyId, dto.customer_id);
      fleet.customer_id = dto.customer_id;
    }
    if (dto.quotation_id !== undefined) {
      if (dto.quotation_id)
        await this.ensureQuotation(companyId, dto.quotation_id);
      fleet.quotation_id = dto.quotation_id ?? null;
    }
    if (dto.policy_id !== undefined) {
      if (dto.policy_id) await this.ensurePolicy(companyId, dto.policy_id);
      fleet.policy_id = dto.policy_id ?? null;
    }
    if (dto.fleet_no !== undefined) fleet.fleet_no = dto.fleet_no.trim();
    if (dto.fleet_name !== undefined)
      fleet.fleet_name = this.normalizeText(dto.fleet_name);
    if (dto.total_vehicles !== undefined)
      fleet.total_vehicles = dto.total_vehicles ?? 0;
    if (dto.total_sum_insured !== undefined)
      fleet.total_sum_insured = this.normalizeMoney(dto.total_sum_insured);
    if (dto.total_premium !== undefined)
      fleet.total_premium = this.normalizeMoney(dto.total_premium);
    if (dto.status !== undefined)
      fleet.status = dto.status.trim().toUpperCase();

    try {
      return await this.motorFleetRepository.save(fleet);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A motor fleet with the same fleet number already exists in this company',
        );
      }
      throw error;
    }
  }

  async removeFleet(companyId: string, id: string): Promise<void> {
    const fleet = await this.findFleet(companyId, id);
    await this.motorFleetRepository.softDelete(fleet.id);
  }

  async createFleetItem(
    companyId: string,
    fleetId: string,
    dto: CreateMotorFleetItemDto,
  ) {
    await this.ensureFleet(companyId, fleetId);
    await this.ensureMotorVehicle(companyId, dto.motor_vehicle_id);
    if (dto.quotation_entry_risk_id)
      await this.ensureQuotationEntryRisk(
        companyId,
        dto.quotation_entry_risk_id,
      );
    if (dto.policy_risk_id)
      await this.ensurePolicyRisk(companyId, dto.policy_risk_id);

    return this.motorFleetItemRepository.save(
      this.motorFleetItemRepository.create({
        fleet_id: fleetId,
        motor_vehicle_id: dto.motor_vehicle_id,
        quotation_entry_risk_id: dto.quotation_entry_risk_id ?? null,
        policy_risk_id: dto.policy_risk_id ?? null,
        sum_insured: this.normalizeMoney(dto.sum_insured),
        premium: this.normalizeMoney(dto.premium),
        status: dto.status?.trim().toUpperCase() ?? 'ACTIVE',
      }),
    );
  }

  async listFleetItems(companyId: string, fleetId: string) {
    await this.ensureFleet(companyId, fleetId);
    return this.motorFleetItemRepository.find({
      where: { fleet_id: fleetId },
      relations: { motor_vehicle: true },
      order: { created_at: 'DESC' },
    });
  }

  async findFleetItem(companyId: string, fleetId: string, id: string) {
    await this.ensureFleet(companyId, fleetId);
    const item = await this.motorFleetItemRepository.findOne({
      where: { id, fleet_id: fleetId },
      relations: { motor_vehicle: true },
    });
    if (!item) throw new NotFoundException('Motor fleet item not found');
    return item;
  }

  async updateFleetItem(
    companyId: string,
    fleetId: string,
    id: string,
    dto: UpdateMotorFleetItemDto,
  ) {
    const item = await this.findFleetItem(companyId, fleetId, id);
    if (dto.motor_vehicle_id !== undefined) {
      await this.ensureMotorVehicle(companyId, dto.motor_vehicle_id);
      item.motor_vehicle_id = dto.motor_vehicle_id;
    }
    if (dto.quotation_entry_risk_id !== undefined) {
      if (dto.quotation_entry_risk_id)
        await this.ensureQuotationEntryRisk(
          companyId,
          dto.quotation_entry_risk_id,
        );
      item.quotation_entry_risk_id = dto.quotation_entry_risk_id ?? null;
    }
    if (dto.policy_risk_id !== undefined) {
      if (dto.policy_risk_id)
        await this.ensurePolicyRisk(companyId, dto.policy_risk_id);
      item.policy_risk_id = dto.policy_risk_id ?? null;
    }
    if (dto.sum_insured !== undefined)
      item.sum_insured = this.normalizeMoney(dto.sum_insured);
    if (dto.premium !== undefined)
      item.premium = this.normalizeMoney(dto.premium);
    if (dto.status !== undefined) item.status = dto.status.trim().toUpperCase();

    return this.motorFleetItemRepository.save(item);
  }

  async removeFleetItem(
    companyId: string,
    fleetId: string,
    id: string,
  ): Promise<void> {
    const item = await this.findFleetItem(companyId, fleetId, id);
    await this.motorFleetItemRepository.softDelete(item.id);
  }

  async createPolicyDetail(companyId: string, dto: CreateMotorPolicyDetailDto) {
    await this.ensureMotorVehicle(companyId, dto.motor_vehicle_id);
    await this.ensurePolicy(companyId, dto.policy_id);
    if (dto.policy_risk_id)
      await this.ensurePolicyRisk(companyId, dto.policy_risk_id);
    return this.motorPolicyDetailRepository.save(
      this.motorPolicyDetailRepository.create({
        policy_id: dto.policy_id,
        policy_risk_id: dto.policy_risk_id,
        motor_vehicle_id: dto.motor_vehicle_id,
        cover_type: this.normalizeText(dto.cover_type),
        usage_type: this.normalizeText(dto.usage_type),
        certificate_no: this.normalizeText(dto.certificate_no),
        sticker_no: this.normalizeText(dto.sticker_no),
      }),
    );
  }

  async listPolicyDetails(companyId: string, policyId?: string) {
    const qb = this.motorPolicyDetailRepository
      .createQueryBuilder('detail')
      .leftJoinAndSelect('detail.motor_vehicle', 'vehicle')
      .where('vehicle.company_id = :companyId', { companyId });
    if (policyId) qb.andWhere('detail.policy_id = :policyId', { policyId });
    return qb.orderBy('detail.created_at', 'DESC').getMany();
  }

  async findPolicyDetail(companyId: string, id: string) {
    const detail = await this.motorPolicyDetailRepository.findOne({
      where: { id },
      relations: { motor_vehicle: true },
    });
    if (!detail || detail.motor_vehicle.company_id !== companyId) {
      throw new NotFoundException('Motor policy detail not found');
    }
    return detail;
  }

  async updatePolicyDetail(
    companyId: string,
    id: string,
    dto: UpdateMotorPolicyDetailDto,
  ) {
    const detail = await this.findPolicyDetail(companyId, id);
    if (dto.policy_id !== undefined) {
      await this.ensurePolicy(companyId, dto.policy_id);
      detail.policy_id = dto.policy_id;
    }
    if (dto.policy_risk_id !== undefined) {
      if (dto.policy_risk_id)
        await this.ensurePolicyRisk(companyId, dto.policy_risk_id);
      detail.policy_risk_id = dto.policy_risk_id;
    }
    if (dto.motor_vehicle_id !== undefined) {
      await this.ensureMotorVehicle(companyId, dto.motor_vehicle_id);
      detail.motor_vehicle_id = dto.motor_vehicle_id;
    }
    if (dto.cover_type !== undefined)
      detail.cover_type = this.normalizeText(dto.cover_type);
    if (dto.usage_type !== undefined)
      detail.usage_type = this.normalizeText(dto.usage_type);
    if (dto.certificate_no !== undefined)
      detail.certificate_no = this.normalizeText(dto.certificate_no);
    if (dto.sticker_no !== undefined)
      detail.sticker_no = this.normalizeText(dto.sticker_no);
    return this.motorPolicyDetailRepository.save(detail);
  }

  async removePolicyDetail(companyId: string, id: string): Promise<void> {
    const detail = await this.findPolicyDetail(companyId, id);
    await this.motorPolicyDetailRepository.softDelete(detail.id);
  }

  async restorePolicyDetail(companyId: string, id: string): Promise<void> {
    const detail = await this.motorPolicyDetailRepository.findOne({
      where: { id },
      relations: { motor_vehicle: true },
      withDeleted: true,
    });
    if (!detail || detail.motor_vehicle.company_id !== companyId) {
      throw new NotFoundException('Motor policy detail not found');
    }
    await this.motorPolicyDetailRepository.restore(detail.id);
  }
}
