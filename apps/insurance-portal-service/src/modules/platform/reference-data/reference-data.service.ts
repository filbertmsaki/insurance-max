import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import VehicleMakesModelsSeeder from '../../../database/seeds/016-vehicle-makes-models.seed';
import VehicleFuelTypesSeeder from '../../../database/seeds/017-vehicle-fuel-types.seed';
import VehicleBodyTypesSeeder from '../../../database/seeds/018-vehicle-body-types.seed';
import VehicleColoursSeeder from '../../../database/seeds/019-vehicle-colours.seed';
import {
  CreateCountryDto,
  CreateCurrencyDto,
  CreateDistrictDto,
  CreateRegionDto,
  ReferenceListQueryDto,
  UpdateCountryDto,
  UpdateCurrencyDto,
  UpdateDistrictDto,
  UpdateRegionDto,
} from './dto/reference-data.dto';
import { isPagedRequest } from '@insurance-max/portal-shared/dto/table-query.dto';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';
import { ReferenceCountry } from './entities/reference-country.entity';
import { ReferenceCurrency } from './entities/reference-currency.entity';
import { ReferenceDistrict } from './entities/reference-district.entity';
import { ReferenceRegion } from './entities/reference-region.entity';
import { VehicleMake } from './entities/vehicle-make.entity';
import { VehicleModel } from './entities/vehicle-model.entity';
import { VehicleReferenceAttribute } from './entities/vehicle-attribute.entity';

type ReferenceEntity =
  | ReferenceCountry
  | ReferenceRegion
  | ReferenceDistrict
  | ReferenceCurrency;

export type VehicleDefaultSeedKind =
  | 'makes_models'
  | 'fuel_type'
  | 'body_type'
  | 'colour';

@Injectable()
export class ReferenceDataService {
  constructor(
    @InjectRepository(ReferenceCountry)
    private readonly countries: Repository<ReferenceCountry>,
    @InjectRepository(ReferenceRegion)
    private readonly regions: Repository<ReferenceRegion>,
    @InjectRepository(ReferenceDistrict)
    private readonly districts: Repository<ReferenceDistrict>,
    @InjectRepository(ReferenceCurrency)
    private readonly currencies: Repository<ReferenceCurrency>,
    @InjectRepository(VehicleMake)
    private readonly vehicleMakes: Repository<VehicleMake>,
    @InjectRepository(VehicleModel)
    private readonly vehicleModels: Repository<VehicleModel>,
    @InjectRepository(VehicleReferenceAttribute)
    private readonly vehicleAttributes: Repository<VehicleReferenceAttribute>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async seedVehicleDefaults(kind: string) {
    const seeders = {
      makes_models: VehicleMakesModelsSeeder,
      fuel_type: VehicleFuelTypesSeeder,
      body_type: VehicleBodyTypesSeeder,
      colour: VehicleColoursSeeder,
    } as const;
    if (!Object.prototype.hasOwnProperty.call(seeders, kind)) {
      throw new BadRequestException('Unknown vehicle default data type');
    }

    const seedKind = kind as VehicleDefaultSeedKind;
    const SeederClass = seeders[seedKind];
    await new SeederClass().run(
      this.dataSource,
      undefined as unknown as SeederFactoryManager,
    );

    const names: Record<VehicleDefaultSeedKind, string> = {
      makes_models: 'vehicle makes and models',
      fuel_type: 'fuel types',
      body_type: 'body types',
      colour: 'colours',
    };
    return {
      kind: seedKind,
      message: `Default ${names[seedKind]} loaded. Existing records were preserved.`,
    };
  }

  listVehicleMakes(query: ReferenceListQueryDto) {
    const qb = this.vehicleMakes
      .createQueryBuilder('make')
      .where('make.deleted_at IS NULL')
      .orderBy('make.name', 'ASC');
    if (query.is_active !== undefined)
      qb.andWhere('make.is_active = :active', { active: query.is_active });
    if (query.search)
      qb.andWhere('make.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    if (isPagedRequest(query))
      return paginateQueryBuilder(qb, query, {
        sortable: { name: 'make.name', is_active: 'make.is_active' },
        defaultSort: 'name',
        defaultOrder: 'ASC',
        searchable: ['make.name'],
        tieBreaker: 'make.id',
      });
    return qb.take(100).getMany();
  }

  listVehicleModels(query: ReferenceListQueryDto & { make_id?: string }) {
    const qb = this.vehicleModels
      .createQueryBuilder('model')
      .leftJoinAndSelect('model.make', 'make')
      .where('model.deleted_at IS NULL');
    if (query.make_id)
      qb.andWhere('model.make_id = :makeId', { makeId: query.make_id });
    if (query.is_active !== undefined)
      qb.andWhere('model.is_active = :active', { active: query.is_active });
    if (query.search)
      qb.andWhere('model.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    qb.orderBy('model.name', 'ASC');
    if (isPagedRequest(query))
      return paginateQueryBuilder(qb, query, {
        sortable: { name: 'model.name', is_active: 'model.is_active' },
        defaultSort: 'name',
        defaultOrder: 'ASC',
        searchable: ['model.name'],
        tieBreaker: 'model.id',
      });
    return qb.take(100).getMany();
  }

  listVehicleAttributes(kind: string, query: ReferenceListQueryDto) {
    this.assertVehicleAttributeKind(kind);
    const qb = this.vehicleAttributes
      .createQueryBuilder('item')
      .where('item.deleted_at IS NULL')
      .andWhere('item.kind = :kind', { kind })
      .orderBy('item.name', 'ASC');
    if (query.is_active !== undefined)
      qb.andWhere('item.is_active = :active', { active: query.is_active });
    if (query.search)
      qb.andWhere('item.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    if (isPagedRequest(query))
      return paginateQueryBuilder(qb, query, {
        sortable: { name: 'item.name', is_active: 'item.is_active' },
        defaultSort: 'name',
        defaultOrder: 'ASC',
        searchable: ['item.name'],
        tieBreaker: 'item.id',
      });
    return qb.take(100).getMany();
  }

  async createVehicleMake(dto: {
    name: string;
    is_active?: boolean;
    models?: string;
  }) {
    const name = this.cleanRequired(dto.name, 'name');
    try {
      const make = await this.vehicleMakes.save(
        this.vehicleMakes.create({
          name,
          normalized_name: this.normalize(name),
          is_active: dto.is_active ?? true,
          source: 'administrator',
          metadata: null,
        }),
      );
      const models = dto.models
        ? await this.saveVehicleModels(make.id, dto.models)
        : { created: [], skipped: [] };
      return { ...make, bulk_models: models };
    } catch (error) {
      if (this.isUniqueViolation(error))
        throw new ConflictException('Make already exists');
      throw error;
    }
  }

  async updateVehicleMake(
    id: string,
    dto: { name?: string; is_active?: boolean; models?: string },
  ) {
    const make = await this.vehicleMakes.findOneBy({
      id,
      deleted_at: IsNull(),
    });
    if (!make) throw new NotFoundException('Vehicle make not found');
    if (dto.name !== undefined) {
      make.name = this.cleanRequired(dto.name, 'name');
      make.normalized_name = this.normalize(make.name);
    }
    if (dto.is_active !== undefined) make.is_active = dto.is_active;
    try {
      await this.vehicleMakes.save(make);
    } catch (error) {
      if (this.isUniqueViolation(error))
        throw new ConflictException('Make already exists');
      throw error;
    }
    const models = dto.models
      ? await this.saveVehicleModels(id, dto.models)
      : { created: [], skipped: [] };
    return { ...make, bulk_models: models };
  }

  async previewVehicleModels(makeId: string, input: string) {
    const make = await this.vehicleMakes.findOneBy({
      id: makeId,
      deleted_at: IsNull(),
    });
    if (!make) throw new NotFoundException('Vehicle make not found');
    const candidates = this.splitModels(input);
    const seen = new Set<string>();
    const unique: string[] = [];
    const duplicates: string[] = [];
    const invalid: string[] = [];
    for (const value of candidates) {
      const normalized = this.normalize(value);
      if (!value || value.length > 120) {
        invalid.push(value || '(empty)');
        continue;
      }
      if (seen.has(normalized)) {
        duplicates.push(value);
        continue;
      }
      seen.add(normalized);
      unique.push(value);
    }
    const existingRows = unique.length
      ? await this.vehicleModels
          .createQueryBuilder('model')
          .where(
            'model.make_id = :makeId AND model.deleted_at IS NULL AND model.normalized_name IN (:...names)',
            { makeId, names: unique.map((name) => this.normalize(name)) },
          )
          .getMany()
      : [];
    const existingSet = new Set(existingRows.map((row) => row.normalized_name));
    return {
      make_id: makeId,
      new_models: unique.filter(
        (name) => !existingSet.has(this.normalize(name)),
      ),
      duplicates,
      existing_models: unique.filter((name) =>
        existingSet.has(this.normalize(name)),
      ),
      invalid,
    };
  }

  async saveVehicleModels(makeId: string, input: string) {
    const preview = await this.previewVehicleModels(makeId, input);
    const created: string[] = [];
    for (const name of preview.new_models) {
      try {
        await this.vehicleModels.insert({
          make_id: makeId,
          name,
          normalized_name: this.normalize(name),
          is_active: true,
          source: 'administrator',
          metadata: null,
        });
        created.push(name);
      } catch (error) {
        if (!this.isUniqueViolation(error)) throw error;
      }
    }
    return {
      created,
      skipped: [
        ...preview.duplicates,
        ...preview.existing_models,
        ...preview.invalid,
      ],
      preview,
    };
  }

  async createVehicleAttribute(
    kind: string,
    dto: { name: string; is_active?: boolean },
  ) {
    this.assertVehicleAttributeKind(kind);
    const name = this.cleanRequired(dto.name, 'name');
    try {
      return await this.vehicleAttributes.save(
        this.vehicleAttributes.create({
          kind,
          name,
          normalized_name: this.normalize(name),
          is_active: dto.is_active ?? true,
          source: 'administrator',
          metadata: null,
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error))
        throw new ConflictException('Vehicle reference value already exists');
      throw error;
    }
  }

  async updateVehicleAttribute(
    kind: string,
    id: string,
    dto: { name?: string; is_active?: boolean },
  ) {
    this.assertVehicleAttributeKind(kind);
    const item = await this.vehicleAttributes.findOneBy({
      id,
      kind,
      deleted_at: IsNull(),
    });
    if (!item) throw new NotFoundException('Vehicle reference value not found');
    if (dto.name !== undefined) {
      item.name = this.cleanRequired(dto.name, 'name');
      item.normalized_name = this.normalize(item.name);
    }
    if (dto.is_active !== undefined) item.is_active = dto.is_active;
    try {
      return await this.vehicleAttributes.save(item);
    } catch (error) {
      if (this.isUniqueViolation(error))
        throw new ConflictException('Vehicle reference value already exists');
      throw error;
    }
  }

  async setVehicleAttributeStatus(kind: string, id: string, isActive: boolean) {
    this.assertVehicleAttributeKind(kind);
    const item = await this.vehicleAttributes.findOneBy({
      id,
      kind,
      deleted_at: IsNull(),
    });
    if (!item) throw new NotFoundException('Vehicle reference value not found');
    item.is_active = isActive;
    return this.vehicleAttributes.save(item);
  }

  async setVehicleMakeStatus(id: string, isActive: boolean) {
    const make = await this.vehicleMakes.findOneBy({
      id,
      deleted_at: IsNull(),
    });
    if (!make) throw new NotFoundException('Vehicle make not found');
    make.is_active = isActive;
    return this.vehicleMakes.save(make);
  }

  private normalize(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
  }
  private splitModels(input: string) {
    return String(input ?? '')
      .split(',')
      .map((entry) => entry.trim().replace(/\s+/g, ' '));
  }
  private assertVehicleAttributeKind(
    kind: string,
  ): asserts kind is 'body_type' | 'colour' | 'fuel_type' {
    if (!['body_type', 'colour', 'fuel_type'].includes(kind))
      throw new BadRequestException('Unknown vehicle reference kind');
  }
  private isUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  }

  listCountries(query: ReferenceListQueryDto) {
    const qb = this.countries
      .createQueryBuilder('country')
      .where('country.deleted_at IS NULL')
      .orderBy('country.name', 'ASC');
    this.applyActiveFilter(qb, 'country', query);
    if (isPagedRequest(query)) {
      return paginateQueryBuilder(qb, query, {
        sortable: {
          name: 'country.name',
          iso2_code: 'country.iso2_code',
          iso3_code: 'country.iso3_code',
          phone_code: 'country.phone_code',
          is_active: 'country.is_active',
        },
        defaultSort: 'name',
        defaultOrder: 'ASC',
        searchable: ['country.name', 'country.iso2_code', 'country.iso3_code'],
        tieBreaker: 'country.id',
      });
    }
    this.applySearch(qb, 'country', ['name', 'iso2_code', 'iso3_code'], query);
    return qb.getMany();
  }

  async getCountry(id: string) {
    const country = await this.countries.findOne({
      where: { id, deleted_at: IsNull() },
      relations: { regions: true },
      order: { regions: { name: 'ASC' } },
    });
    if (!country) throw new NotFoundException('Country not found');
    return country;
  }

  async createCountry(dto: CreateCountryDto) {
    await this.assertCountryUnique(dto.iso3_code, dto.name);
    return this.countries.save(
      this.countries.create({
        name: this.cleanRequired(dto.name, 'name'),
        iso2_code: this.cleanOptional(dto.iso2_code)?.toUpperCase() ?? null,
        iso3_code: this.cleanRequired(dto.iso3_code, 'iso3_code').toUpperCase(),
        phone_code: this.cleanOptional(dto.phone_code),
        is_active: dto.is_active ?? true,
      }),
    );
  }

  async updateCountry(id: string, dto: UpdateCountryDto) {
    const country = await this.getCountry(id);
    if (dto.iso3_code || dto.name) {
      await this.assertCountryUnique(
        dto.iso3_code ?? country.iso3_code,
        dto.name ?? country.name,
        id,
      );
    }
    if (dto.name !== undefined)
      country.name = this.cleanRequired(dto.name, 'name');
    if (dto.iso2_code !== undefined)
      country.iso2_code =
        this.cleanOptional(dto.iso2_code)?.toUpperCase() ?? null;
    if (dto.iso3_code !== undefined)
      country.iso3_code = this.cleanRequired(
        dto.iso3_code,
        'iso3_code',
      ).toUpperCase();
    if (dto.phone_code !== undefined)
      country.phone_code = this.cleanOptional(dto.phone_code);
    if (dto.is_active !== undefined) country.is_active = dto.is_active;
    return this.countries.save(country);
  }

  listRegions(query: ReferenceListQueryDto) {
    const qb = this.regions
      .createQueryBuilder('region')
      .leftJoinAndSelect('region.country', 'country')
      .where('region.deleted_at IS NULL')
      .orderBy('country.name', 'ASC')
      .addOrderBy('region.name', 'ASC');
    if (query.country_id) {
      qb.andWhere('region.country_id = :countryId', {
        countryId: query.country_id,
      });
    }
    this.applyActiveFilter(qb, 'region', query);
    if (isPagedRequest(query)) {
      return paginateQueryBuilder(qb, query, {
        sortable: {
          name: 'region.name',
          code: 'region.code',
          country: 'country.name',
          is_active: 'region.is_active',
        },
        defaultSort: 'name',
        defaultOrder: 'ASC',
        searchable: ['region.name', 'region.code', 'country.name'],
        tieBreaker: 'region.id',
      });
    }
    this.applySearch(qb, 'region', ['name', 'code'], query);
    return qb.getMany();
  }

  async getRegion(id: string) {
    const region = await this.regions.findOne({
      where: { id, deleted_at: IsNull() },
      relations: { country: true, districts: true },
      order: { districts: { name: 'ASC' } },
    });
    if (!region) throw new NotFoundException('Region not found');
    return region;
  }

  async createRegion(dto: CreateRegionDto) {
    await this.assertCountryExists(dto.country_id);
    const code =
      this.cleanOptional(dto.code) ?? this.cleanRequired(dto.name, 'name');
    await this.assertRegionUnique(dto.country_id, code, dto.name);
    return this.regions.save(
      this.regions.create({
        country_id: dto.country_id,
        code,
        name: this.cleanRequired(dto.name, 'name'),
        is_active: dto.is_active ?? true,
      }),
    );
  }

  async updateRegion(id: string, dto: UpdateRegionDto) {
    const region = await this.getRegion(id);
    const countryId = dto.country_id ?? region.country_id;
    await this.assertCountryExists(countryId);
    const code = this.cleanOptional(dto.code) ?? region.code;
    const name = dto.name ?? region.name;
    await this.assertRegionUnique(countryId, code, name, id);
    region.country_id = countryId;
    region.code = code;
    region.name = this.cleanRequired(name, 'name');
    if (dto.is_active !== undefined) region.is_active = dto.is_active;
    return this.regions.save(region);
  }

  listDistricts(query: ReferenceListQueryDto) {
    const qb = this.districts
      .createQueryBuilder('district')
      .leftJoinAndSelect('district.region', 'region')
      .leftJoinAndSelect('region.country', 'country')
      .where('district.deleted_at IS NULL')
      .orderBy('country.name', 'ASC')
      .addOrderBy('region.name', 'ASC')
      .addOrderBy('district.name', 'ASC');
    if (query.region_id) {
      qb.andWhere('district.region_id = :regionId', {
        regionId: query.region_id,
      });
    }
    if (query.country_id) {
      qb.andWhere('region.country_id = :countryId', {
        countryId: query.country_id,
      });
    }
    this.applyActiveFilter(qb, 'district', query);
    if (isPagedRequest(query)) {
      return paginateQueryBuilder(qb, query, {
        sortable: {
          name: 'district.name',
          code: 'district.code',
          region: 'region.name',
          country: 'country.name',
          is_active: 'district.is_active',
        },
        defaultSort: 'name',
        defaultOrder: 'ASC',
        searchable: ['district.name', 'district.code', 'region.name'],
        tieBreaker: 'district.id',
      });
    }
    this.applySearch(qb, 'district', ['name', 'code'], query);
    return qb.getMany();
  }

  async getDistrict(id: string) {
    const district = await this.districts.findOne({
      where: { id, deleted_at: IsNull() },
      relations: { region: { country: true } },
    });
    if (!district) throw new NotFoundException('District not found');
    return district;
  }

  async createDistrict(dto: CreateDistrictDto) {
    await this.assertRegionExists(dto.region_id);
    const code =
      this.cleanOptional(dto.code) ?? this.cleanRequired(dto.name, 'name');
    await this.assertDistrictUnique(dto.region_id, code, dto.name);
    return this.districts.save(
      this.districts.create({
        region_id: dto.region_id,
        code,
        name: this.cleanRequired(dto.name, 'name'),
        is_active: dto.is_active ?? true,
      }),
    );
  }

  async updateDistrict(id: string, dto: UpdateDistrictDto) {
    const district = await this.getDistrict(id);
    const regionId = dto.region_id ?? district.region_id;
    await this.assertRegionExists(regionId);
    const code = this.cleanOptional(dto.code) ?? district.code;
    const name = dto.name ?? district.name;
    await this.assertDistrictUnique(regionId, code, name, id);
    district.region_id = regionId;
    district.code = code;
    district.name = this.cleanRequired(name, 'name');
    if (dto.is_active !== undefined) district.is_active = dto.is_active;
    return this.districts.save(district);
  }

  listCurrencies(query: ReferenceListQueryDto) {
    const qb = this.currencies
      .createQueryBuilder('currency')
      .where('currency.deleted_at IS NULL')
      .orderBy('currency.code', 'ASC');
    this.applyActiveFilter(qb, 'currency', query);
    if (isPagedRequest(query)) {
      return paginateQueryBuilder(qb, query, {
        sortable: {
          code: 'currency.code',
          name: 'currency.name',
          symbol: 'currency.symbol',
          is_active: 'currency.is_active',
        },
        defaultSort: 'code',
        defaultOrder: 'ASC',
        searchable: ['currency.name', 'currency.code', 'currency.symbol'],
        tieBreaker: 'currency.id',
      });
    }
    this.applySearch(qb, 'currency', ['name', 'code', 'symbol'], query);
    return qb.getMany();
  }

  async getCurrency(id: string) {
    const currency = await this.currencies.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!currency) throw new NotFoundException('Currency not found');
    return currency;
  }

  async createCurrency(dto: CreateCurrencyDto) {
    await this.assertCurrencyUnique(dto.code);
    return this.currencies.save(
      this.currencies.create({
        name: this.cleanRequired(dto.name, 'name'),
        code: this.cleanRequired(dto.code, 'code').toUpperCase(),
        symbol: this.cleanOptional(dto.symbol),
        is_active: dto.is_active ?? true,
      }),
    );
  }

  async updateCurrency(id: string, dto: UpdateCurrencyDto) {
    const currency = await this.getCurrency(id);
    if (dto.code) await this.assertCurrencyUnique(dto.code, id);
    if (dto.name !== undefined)
      currency.name = this.cleanRequired(dto.name, 'name');
    if (dto.code !== undefined)
      currency.code = this.cleanRequired(dto.code, 'code').toUpperCase();
    if (dto.symbol !== undefined)
      currency.symbol = this.cleanOptional(dto.symbol);
    if (dto.is_active !== undefined) currency.is_active = dto.is_active;
    return this.currencies.save(currency);
  }

  async setActive(kind: string, id: string, isActive: boolean) {
    const entity = await this.findByKind(kind, id);
    entity.is_active = isActive;
    return this.repositoryForKind(kind).save(entity as never);
  }

  async remove(kind: string, id: string) {
    const repository = this.repositoryForKind(kind);
    const entity = await this.findByKind(kind, id);
    if (kind === 'countries') {
      const count = await this.regions.count({
        where: { country_id: id, deleted_at: IsNull() },
      });
      if (count > 0) throw new ConflictException('Country has regions');
    }
    if (kind === 'regions') {
      const count = await this.districts.count({
        where: { region_id: id, deleted_at: IsNull() },
      });
      if (count > 0) throw new ConflictException('Region has districts');
    }
    await repository.softRemove(entity as never);
    return { deleted: true };
  }

  private repositoryForKind(kind: string): Repository<ReferenceEntity> {
    switch (kind) {
      case 'countries':
        return this.countries;
      case 'regions':
        return this.regions;
      case 'districts':
        return this.districts;
      case 'currencies':
        return this.currencies;
      default:
        throw new BadRequestException('Unknown reference data type');
    }
  }

  private async findByKind(kind: string, id: string): Promise<ReferenceEntity> {
    switch (kind) {
      case 'countries':
        return this.getCountry(id);
      case 'regions':
        return this.getRegion(id);
      case 'districts':
        return this.getDistrict(id);
      case 'currencies':
        return this.getCurrency(id);
      default:
        throw new BadRequestException('Unknown reference data type');
    }
  }

  private applyActiveFilter(
    qb: ReturnType<Repository<ReferenceEntity>['createQueryBuilder']>,
    alias: string,
    query: ReferenceListQueryDto,
  ) {
    if (query.is_active !== undefined) {
      qb.andWhere(`${alias}.is_active = :isActive`, {
        isActive: query.is_active,
      });
    }
  }

  private applySearch(
    qb: ReturnType<Repository<ReferenceEntity>['createQueryBuilder']>,
    alias: string,
    fields: string[],
    query: ReferenceListQueryDto,
  ) {
    const search = this.cleanOptional(query.search);
    if (!search) return;
    qb.andWhere(
      new Brackets((where) => {
        for (const field of fields) {
          where.orWhere(`${alias}.${field} ILIKE :search`, {
            search: `%${search}%`,
          });
        }
      }),
    );
  }

  private cleanOptional(value?: string | null) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private cleanRequired(value: string | undefined, field: string) {
    const cleaned = value?.trim();
    if (!cleaned) throw new BadRequestException(`${field} is required`);
    return cleaned;
  }

  private async assertCountryExists(id: string) {
    const exists = await this.countries.exist({
      where: { id, deleted_at: IsNull() },
    });
    if (!exists) throw new BadRequestException('Country not found');
  }

  private async assertRegionExists(id: string) {
    const exists = await this.regions.exist({
      where: { id, deleted_at: IsNull() },
    });
    if (!exists) throw new BadRequestException('Region not found');
  }

  private async assertCountryUnique(
    iso3: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.countries
      .createQueryBuilder('country')
      .where('country.deleted_at IS NULL')
      .andWhere(
        '(lower(country.iso3_code) = lower(:iso3) OR lower(country.name) = lower(:name))',
        { iso3: iso3.trim(), name: name.trim() },
      )
      .andWhere(excludeId ? 'country.id != :excludeId' : '1=1', { excludeId })
      .getOne();
    if (existing) throw new ConflictException('Country already exists');
  }

  private async assertRegionUnique(
    countryId: string,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.regions
      .createQueryBuilder('region')
      .where('region.deleted_at IS NULL')
      .andWhere('region.country_id = :countryId', { countryId })
      .andWhere(
        '(lower(region.code) = lower(:code) OR lower(region.name) = lower(:name))',
        { code: code.trim(), name: name.trim() },
      )
      .andWhere(excludeId ? 'region.id != :excludeId' : '1=1', { excludeId })
      .getOne();
    if (existing) throw new ConflictException('Region already exists');
  }

  private async assertDistrictUnique(
    regionId: string,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.districts
      .createQueryBuilder('district')
      .where('district.deleted_at IS NULL')
      .andWhere('district.region_id = :regionId', { regionId })
      .andWhere(
        '(lower(district.code) = lower(:code) OR lower(district.name) = lower(:name))',
        { code: code.trim(), name: name.trim() },
      )
      .andWhere(excludeId ? 'district.id != :excludeId' : '1=1', { excludeId })
      .getOne();
    if (existing) throw new ConflictException('District already exists');
  }

  private async assertCurrencyUnique(code: string, excludeId?: string) {
    const existing = await this.currencies
      .createQueryBuilder('currency')
      .where('currency.deleted_at IS NULL')
      .andWhere('lower(currency.code) = lower(:code)', { code: code.trim() })
      .andWhere(excludeId ? 'currency.id != :excludeId' : '1=1', { excludeId })
      .getOne();
    if (existing) throw new ConflictException('Currency already exists');
  }
}
