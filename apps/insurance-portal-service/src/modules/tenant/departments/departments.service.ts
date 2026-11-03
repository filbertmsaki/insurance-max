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
import { isPagedRequest } from '@insurance-max/portal-shared/dto/table-query.dto';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';
import { FindDepartmentsQueryDto } from './dto/find-departments-query.dto';
import { Branch } from '../branches/entities/branch.entity';
import { BranchUser } from '../branches/entities/branch-user.entity';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { AssignDepartmentUsersDto } from './dto/assign-department-users.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import {
  UpdateDepartmentDto,
  UpdateDepartmentStatusDto,
} from './dto/update-department.dto';
import {
  Department,
  departmentServesBranch,
} from './entities/department.entity';
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

  /** Loads and validates the branches a department should operate in. */
  private async resolveBranches(
    companyId: string,
    branchIds: string[] | undefined,
  ): Promise<Branch[]> {
    const ids = [...new Set(branchIds ?? [])];
    if (ids.length === 0) return [];
    const branches = await this.branchRepository.find({
      where: { id: In(ids), company_id: companyId },
    });
    if (branches.length !== ids.length) {
      throw new NotFoundException(
        'One or more branches were not found or do not belong to this company',
      );
    }
    return branches;
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
    const branches = await this.resolveBranches(companyId, dto.branch_ids);

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Department);
        const dept = repo.create({
          company_id: companyId,
          branches,
          name: dto.name.trim(),
          code: await this.nextDepartmentCode(manager, companyId),
          description: dto.description ?? null,
          status: 'active',
          created_by: userId,
          updated_by: userId,
        });
        return repo.save(dept);
      });
      return this.findOne(companyId, saved.id);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A department named "${dto.name.trim()}" already exists in this company`,
        );
      }
      throw error;
    }
  }

  /**
   * Next sequential code (DEP-0001, DEP-0002, …) for the company. A
   * transaction-scoped advisory lock serialises concurrent creates per
   * company; soft-deleted rows count so a code is never reused.
   */
  private async nextDepartmentCode(
    manager: EntityManager,
    companyId: string,
  ): Promise<string> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `departments:code:${companyId}`,
    ]);
    const [row] = await manager.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS integer)), 0) AS max
         FROM departments
        WHERE company_id = $1 AND code ~ '^DEP-[0-9]+$'`,
      [companyId],
    );
    const next = Number(row?.max ?? 0) + 1;
    return `DEP-${String(next).padStart(4, '0')}`;
  }

  /**
   * GET /departments. With `page` → server-side table page; without it →
   * every department of the company in the legacy `{ data, meta }` shape
   * (selectors). Company scope + filters apply before paging/count.
   */
  async findAll(companyId: string, query: FindDepartmentsQueryDto) {
    const qb = this.departmentRepository
      .createQueryBuilder('dept')
      .leftJoinAndSelect('dept.branches', 'branch')
      .where('dept.company_id = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('dept.status = :status', { status: query.status });
    }
    if (query.branch_id) {
      // Departments operating in the branch, plus company-wide ones.
      qb.andWhere(
        `(NOT EXISTS (SELECT 1 FROM department_branches db WHERE db.department_id = dept.id)
          OR EXISTS (SELECT 1 FROM department_branches db WHERE db.department_id = dept.id AND db.branch_id = :branchId))`,
        { branchId: query.branch_id },
      );
    }

    if (!isPagedRequest(query)) {
      const items = await qb
        .orderBy('dept.created_at', 'DESC')
        .addOrderBy('dept.id', 'DESC')
        .getMany();
      return {
        data: items,
        meta: {
          totalItems: items.length,
          itemCount: items.length,
          itemsPerPage: items.length,
          totalPages: items.length > 0 ? 1 : 0,
          currentPage: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    return paginateQueryBuilder(qb, query, {
      sortable: {
        name: 'dept.name',
        code: 'dept.code',
        status: 'dept.status',
        created_at: 'dept.created_at',
        updated_at: 'dept.updated_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'dept.name',
        'dept.code',
        'dept.description',
        'branch.name',
        'branch.code',
      ],
      tieBreaker: 'dept.id',
    });
  }

  async findOne(companyId: string, id: string): Promise<Department> {
    const dept = await this.departmentRepository.findOne({
      where: { id, company_id: companyId },
      relations: { branches: true },
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

    if (dto.name !== undefined) dept.name = dto.name.trim();
    if (dto.description !== undefined)
      dept.description = dto.description ?? null;
    if (dto.branch_ids !== undefined) {
      dept.branches = await this.resolveBranches(companyId, dto.branch_ids);
    }
    dept.updated_by = userId;

    try {
      await this.departmentRepository.save(dept);
      return this.findOne(companyId, dept.id);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A department named "${dept.name}" already exists in this company`,
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
        user_no: assignment.company_user.user_no,
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
          branch_ids: assignment.department.branch_ids,
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
   * across a branch switch. Company-wide departments (no branches)
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

    if (departmentServesBranch(activeAssignment.department, activeBranchId)) {
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
        `(NOT EXISTS (SELECT 1 FROM department_branches db WHERE db.department_id = department.id)
          OR EXISTS (SELECT 1 FROM department_branches db WHERE db.department_id = department.id AND db.branch_id = :activeBranchId))`,
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
