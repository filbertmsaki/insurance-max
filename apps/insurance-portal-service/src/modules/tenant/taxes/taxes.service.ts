import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Tax } from './entities/tax.entity';
import { CreateTaxDto, UpdateTaxDto } from './dto/tax.dto';

@Injectable()
export class TaxesService {
  constructor(
    @InjectRepository(Tax) private readonly repository: Repository<Tax>,
  ) {}

  list(companyId: string, activeOnly = false) {
    return this.repository.find({
      where: {
        company_id: companyId,
        ...(activeOnly ? { is_active: true } : {}),
      },
      order: { tax_code: 'ASC' },
    });
  }

  async findOne(companyId: string, id: string) {
    const tax = await this.repository.findOne({
      where: { id, company_id: companyId },
    });
    if (!tax) throw new NotFoundException('Tax not found');
    return tax;
  }

  async create(companyId: string, dto: CreateTaxDto) {
    return this.save(
      this.repository.create({
        ...dto,
        company_id: companyId,
        tax_rate: dto.tax_rate.toFixed(10),
      }),
    );
  }

  async update(companyId: string, id: string, dto: UpdateTaxDto) {
    const tax = await this.findOne(companyId, id);
    if (dto.tax_code !== undefined && dto.tax_code !== tax.tax_code) {
      // Saved quotations refer to the code. Keep it stable while allowing name,
      // rate and availability to change for subsequent calculations.
      throw new ConflictException(
        'Tax code cannot be changed. Create a new tax instead.',
      );
    }
    if (dto.tax_name !== undefined) tax.tax_name = dto.tax_name;
    if (dto.tax_rate !== undefined) tax.tax_rate = dto.tax_rate.toFixed(10);
    if (dto.is_active !== undefined) tax.is_active = dto.is_active;
    return this.save(tax);
  }

  async remove(companyId: string, id: string) {
    const tax = await this.findOne(companyId, id);
    await this.repository.softDelete({ id: tax.id, company_id: companyId });
  }

  private async save(tax: Tax) {
    try {
      return await this.repository.save(tax);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'This tax code already exists, including deleted taxes. Use a different code.',
        );
      }
      throw error;
    }
  }
}
