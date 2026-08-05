import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  PaginationDto,
  SortDirection,
} from '@insurance-max/portal-shared/dto/pagination.dto';
import { Branch } from '../branches/entities/branch.entity';
import { BranchUser } from '../branches/entities/branch-user.entity';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { AssignDepartmentUsersDto } from './dto/assign-department-users.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import {
  UpdateDepartmentDto,
  UpdateDepartmentStatusDto,
} from './dto/update-department.dto';
import { Department } from './entities/department.entity';
import { DepartmentUser } from './entities/department-user.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,

    @InjectRepository(DepartmentUser)
    private readonly departmentUserRepository: Repository<DepartmentUser>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,

    @InjectRepository(BranchUser)
    private readonly branchUserRepository: Repository<BranchUser>,

    @InjectRepository(CompanyUser)
    private readonly companyUserRepository: Repository<CompanyUser>,

    private readonly dataSource: DataSource,
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

  // ─── User assignment ─────────────────────────────────────────────────────────

  async assignUsers(
    companyId: string,
    departmentId: string,
    dto: AssignDepartmentUsersDto,
    actorId?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const departmentRepo = manager.getRepository(Department);
      const departmentUserRepo = manager.getRepository(DepartmentUser);
      const membershipRepo = manager.getRepository(CompanyUser);

      const department = await departmentRepo.findOne({
        where: { id: departmentId, company_id: companyId, status: 'active' },
      });
      if (!department) {
        throw new NotFoundException('Active department not found');
      }

      const memberships = await membershipRepo.find({
        where: {
          id: In(dto.company_user_ids),
          company_id: companyId,
          status: 'active',
        },
      });
      if (memberships.length !== dto.company_user_ids.length) {
        throw new NotFoundException(
          'One or more users do not belong to this company',
        );
      }

      const assignments: DepartmentUser[] = [];
      for (const membership of memberships) {
        const existing = await departmentUserRepo.findOne({
          where: {
            department_id: departmentId,
            company_user_id: membership.id,
          },
        });
        if (existing) {
          throw new ConflictException(
            'User is already assigned to this department',
          );
        }

        const shouldActivate =
          dto.make_active === true || dto.make_primary === true;

        if (shouldActivate) {
          await departmentUserRepo.update(
            { company_user_id: membership.id },
            { is_active_department: false },
          );
        }
        if (dto.make_primary === true) {
          await departmentUserRepo.update(
            { company_user_id: membership.id },
            { is_primary: false },
          );
        }

        const hasAnyAssignment = await departmentUserRepo.count({
          where: { company_user_id: membership.id },
        });

        const assignment = departmentUserRepo.create({
          company_id: companyId,
          department_id: departmentId,
          company_user_id: membership.id,
          is_primary: dto.make_primary === true || hasAnyAssignment === 0,
          is_active_department: shouldActivate || hasAnyAssignment === 0,
          assigned_by: actorId ?? null,
          activated_at:
            shouldActivate || hasAnyAssignment === 0 ? new Date() : null,
          activated_by:
            shouldActivate || hasAnyAssignment === 0 ? (actorId ?? null) : null,
        });
        assignments.push(await departmentUserRepo.save(assignment));
      }

      return { department, assignments };
    });
  }

  async removeUser(
    companyId: string,
    departmentId: string,
    companyUserId: string,
  ): Promise<{ message: string }> {
    const department = await this.requireDepartment(companyId, departmentId);

    const assignment = await this.departmentUserRepository.findOne({
      where: { department_id: department.id, company_user_id: companyUserId },
    });
    if (!assignment) {
      throw new NotFoundException('User is not assigned to this department');
    }

    await this.departmentUserRepository.delete(assignment.id);
    return { message: 'User department assignment removed successfully' };
  }

  async getDepartmentUsers(companyId: string, departmentId: string) {
    await this.requireDepartment(companyId, departmentId);

    const assignments = await this.departmentUserRepository.find({
      where: { department_id: departmentId, company_id: companyId },
      relations: { company_user: { user: true } },
      order: { created_at: 'ASC' },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      company_user_id: assignment.company_user_id,
      is_primary: assignment.is_primary,
      is_active_department: assignment.is_active_department,
      assigned_at: assignment.created_at,
      user: {
        id: assignment.company_user.user.id,
        user_no: assignment.company_user.user.user_no,
        first_name: assignment.company_user.user.first_name,
        last_name: assignment.company_user.user.last_name,
        email: assignment.company_user.user.email,
        officer_title: assignment.company_user.user.officer_title,
      },
    }));
  }

  async getUserDepartments(companyId: string, companyUserId: string) {
    const membership = await this.companyUserRepository.findOne({
      where: { id: companyUserId, company_id: companyId },
    });
    if (!membership) {
      throw new NotFoundException('Company user not found');
    }

    const assignments = await this.departmentUserRepository.find({
      where: { company_user_id: companyUserId, company_id: companyId },
      relations: { department: true },
      order: { is_primary: 'DESC', created_at: 'ASC' },
    });

    return assignments
      .filter((assignment) => !assignment.department.deleted_at)
      .map((assignment) => ({
        id: assignment.id,
        is_primary: assignment.is_primary,
        is_active_department: assignment.is_active_department,
        department: {
          id: assignment.department.id,
          code: assignment.department.code,
          name: assignment.department.name,
          branch_id: assignment.department.branch_id,
          status: assignment.department.status,
        },
      }));
  }

  async setActiveDepartment(
    companyId: string,
    companyUserId: string,
    departmentId: string,
    actorId?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const departmentUserRepo = manager.getRepository(DepartmentUser);
      const membershipRepo = manager.getRepository(CompanyUser);

      const membership = await membershipRepo.findOne({
        where: { id: companyUserId, company_id: companyId, status: 'active' },
      });
      if (!membership) {
        throw new NotFoundException('Company user not found');
      }

      const assignment = await departmentUserRepo.findOne({
        where: { company_user_id: companyUserId, department_id: departmentId },
        relations: { department: true },
      });
      if (
        !assignment ||
        assignment.department.company_id !== companyId ||
        assignment.department.status !== 'active'
      ) {
        throw new ForbiddenException(
          'User is not assigned to this active department',
        );
      }

      await departmentUserRepo.update(
        { company_user_id: companyUserId },
        { is_active_department: false },
      );
      assignment.is_active_department = true;
      assignment.activated_at = new Date();
      assignment.activated_by = actorId ?? null;
      return departmentUserRepo.save(assignment);
    });
  }

  /**
   * Ensures the given company user's active department (if any) is still
   * compatible with their newly-activated branch. Department assignments
   * that are branch-scoped and no longer match the active branch are
   * demoted from active/primary so a stale department claim never lingers
   * across a branch switch. Company-wide departments (branch_id === null)
   * are always compatible and left untouched.
   */
  async reconcileActiveDepartmentForBranch(
    companyId: string,
    companyUserId: string,
    activeBranchId: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    const departmentUserRepo =
      manager?.getRepository(DepartmentUser) ?? this.departmentUserRepository;

    const activeAssignment = await departmentUserRepo.findOne({
      where: { company_user_id: companyUserId, is_active_department: true },
      relations: { department: true },
    });

    if (!activeAssignment) {
      return;
    }

    const isCompatible =
      activeAssignment.department.branch_id === null ||
      activeAssignment.department.branch_id === activeBranchId;

    if (isCompatible) {
      return;
    }

    await departmentUserRepo.update(activeAssignment.id, {
      is_active_department: false,
    });

    const replacement = await departmentUserRepo
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.department', 'department')
      .where('assignment.company_user_id = :companyUserId', { companyUserId })
      .andWhere('assignment.company_id = :companyId', { companyId })
      .andWhere('department.status = :status', { status: 'active' })
      .andWhere(
        '(department.branch_id IS NULL OR department.branch_id = :activeBranchId)',
        { activeBranchId },
      )
      .orderBy('assignment.is_primary', 'DESC')
      .addOrderBy('assignment.created_at', 'ASC')
      .getOne();

    if (replacement) {
      await departmentUserRepo.update(replacement.id, {
        is_active_department: true,
        activated_at: new Date(),
      });
    }
  }
}
