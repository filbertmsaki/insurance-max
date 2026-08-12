import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
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
import { ReferenceCountry } from './entities/reference-country.entity';
import { ReferenceCurrency } from './entities/reference-currency.entity';
import { ReferenceDistrict } from './entities/reference-district.entity';
import { ReferenceRegion } from './entities/reference-region.entity';

type ReferenceEntity =
  | ReferenceCountry
  | ReferenceRegion
  | ReferenceDistrict
  | ReferenceCurrency;

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
  ) {}

  listCountries(query: ReferenceListQueryDto) {
    const qb = this.countries
      .createQueryBuilder('country')
      .where('country.deleted_at IS NULL')
      .orderBy('country.name', 'ASC');
    this.applyActiveFilter(qb, 'country', query);
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
    if (dto.name !== undefined) country.name = this.cleanRequired(dto.name, 'name');
    if (dto.iso2_code !== undefined)
      country.iso2_code = this.cleanOptional(dto.iso2_code)?.toUpperCase() ?? null;
    if (dto.iso3_code !== undefined)
      country.iso3_code = this.cleanRequired(dto.iso3_code, 'iso3_code').toUpperCase();
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
    const code = this.cleanOptional(dto.code) ?? this.cleanRequired(dto.name, 'name');
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
    const code = this.cleanOptional(dto.code) ?? this.cleanRequired(dto.name, 'name');
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
    if (dto.name !== undefined) currency.name = this.cleanRequired(dto.name, 'name');
    if (dto.code !== undefined)
      currency.code = this.cleanRequired(dto.code, 'code').toUpperCase();
    if (dto.symbol !== undefined) currency.symbol = this.cleanOptional(dto.symbol);
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
