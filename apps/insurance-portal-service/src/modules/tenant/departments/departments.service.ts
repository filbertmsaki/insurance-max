import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  PaginationDto,
  SortDirection,
} from '@insurance-max/portal-shared/dto/pagination.dto';
import { Branch } from '../branches/entities/branch.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import {
  UpdateDepartmentDto,
  UpdateDepartmentStatusDto,
} from './dto/update-department.dto';
import { Department } from './entities/department.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
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

  private async requireDepartment(
    companyId: string,
    id: string,
  ): Promise<Department> {
    const dept = await this.departmentRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(
    companyId: string,
    dto: CreateDepartmentDto,
    userId: string,
  ): Promise<Department> {
    if (dto.branch_id) {
      const branch = await this.branchRepository.findOne({
        where: { id: dto.branch_id, company_id: companyId },
      });
      if (!branch)
        throw new NotFoundException(
          'Branch not found or does not belong to this company',
        );
    }

    const dept = this.departmentRepository.create({
      company_id: companyId,
      branch_id: dto.branch_id ?? null,
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      description: dto.description ?? null,
      status: 'active',
      created_by: userId,
      updated_by: userId,
    });

    try {
      return await this.departmentRepository.save(dept);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A department with code "${dto.code.trim().toUpperCase()}" already exists in this company`,
        );
      }
      throw error;
    }
  }

  async findAll(companyId: string, query: PaginationDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
    } = query;

    const allowedSortFields = [
      'name',
      'code',
      'status',
      'created_at',
      'updated_at',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.departmentRepository
      .createQueryBuilder('dept')
      .leftJoinAndSelect('dept.branch', 'branch')
      .where('dept.company_id = :companyId', { companyId })
      .orderBy(`dept.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(dept.name ILIKE :term OR dept.code ILIKE :term OR dept.description ILIKE :term)',
        { term },
      );
    }

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

  async findOne(companyId: string, id: string): Promise<Department> {
    const dept = await this.departmentRepository.findOne({
      where: { id, company_id: companyId },
      relations: { branch: true },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateDepartmentDto,
    userId: string,
  ): Promise<Department> {
    const dept = await this.requireDepartment(companyId, id);

    if (dto.branch_id !== undefined && dto.branch_id !== null) {
      const branch = await this.branchRepository.findOne({
        where: { id: dto.branch_id, company_id: companyId },
      });
      if (!branch)
        throw new NotFoundException(
          'Branch not found or does not belong to this company',
        );
    }

    if (dto.name !== undefined) dept.name = dto.name.trim();
    if (dto.code !== undefined) dept.code = dto.code.trim().toUpperCase();
    if (dto.description !== undefined)
      dept.description = dto.description ?? null;
    if (dto.branch_id !== undefined) dept.branch_id = dto.branch_id ?? null;
    dept.updated_by = userId;

    try {
      return await this.departmentRepository.save(dept);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A department with code "${dept.code}" already exists in this company`,
        );
      }
      throw error;
    }
  }

  async setStatus(
    companyId: string,
    id: string,
    dto: UpdateDepartmentStatusDto,
    userId: string,
  ): Promise<Department> {
    const dept = await this.requireDepartment(companyId, id);
    dept.status = dto.status;
    dept.updated_by = userId;
    return this.departmentRepository.save(dept);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const dept = await this.requireDepartment(companyId, id);
    await this.departmentRepository.softDelete(dept.id);
  }
}
