import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hashPassword } from '@insurance-max/portal-shared/utils/hash.util';
import {
  PaginationDto,
  SortDirection,
} from '@insurance-max/portal-shared/dto/pagination.dto';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { User } from '../../tenant/users/entities/user.entity';
import { Company } from './entities/company.entity';
import { CompanyUser } from './entities/company-user.entity';
import { CompanyUserRole } from './entities/company-user-role.entity';
import { CompanyUserPermission } from './entities/company-user-permission.entity';
import { CreateCompanyDto } from './dtos/create-company.dto';
import { UpdateCompanyDto } from './dtos/update-company.dto';
import {
  CompanyMembershipContext,
  CompanySummary,
} from './interfaces/company-membership-context.interface';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,

    @InjectRepository(CompanyUser)
    private readonly companyUserRepository: Repository<CompanyUser>,

    @InjectRepository(CompanyUserRole)
    private readonly companyUserRoleRepository: Repository<CompanyUserRole>,

    @InjectRepository(CompanyUserPermission)
    private readonly companyUserPermissionRepository: Repository<CompanyUserPermission>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  private getCompanyRepository(manager?: EntityManager): Repository<Company> {
    return manager?.getRepository(Company) ?? this.companyRepository;
  }

  private getCompanyUserRepository(
    manager?: EntityManager,
  ): Repository<CompanyUser> {
    return manager?.getRepository(CompanyUser) ?? this.companyUserRepository;
  }

  private getCompanyUserRoleRepository(
    manager?: EntityManager,
  ): Repository<CompanyUserRole> {
    return (
      manager?.getRepository(CompanyUserRole) ?? this.companyUserRoleRepository
    );
  }

  private getRoleRepository(manager?: EntityManager): Repository<Role> {
    return manager?.getRepository(Role) ?? this.roleRepository;
  }

  private async findRoleByNameForCompany(
    name: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<Role | null> {
    const roleRepository = this.getRoleRepository(manager);

    return roleRepository
      .createQueryBuilder('role')
      .where('role.name = :name', { name })
      .andWhere('(role.company_id = :companyId OR role.company_id IS NULL)', {
        companyId,
      })
      .orderBy('CASE WHEN role.company_id = :companyId THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('role.id', 'ASC')
      .setParameter('companyId', companyId)
      .getOne();
  }

  private async resolveRolesByIdsForCompany(
    roleIds: string[],
    companyId: string,
    manager?: EntityManager,
  ): Promise<Role[]> {
    const uniqueRoleIds = Array.from(new Set(roleIds));

    if (!uniqueRoleIds.length) {
      return [];
    }

    const roleRepository = this.getRoleRepository(manager);
    const roles = await roleRepository.find({
      where: uniqueRoleIds.map((id) => ({ id })),
    });

    if (
      roles.length !== uniqueRoleIds.length ||
      roles.some(
        (role) => role.company_id !== null && role.company_id !== companyId,
      )
    ) {
      throw new NotFoundException('One or more requested roles were not found');
    }

    const byId = new Map(roles.map((role) => [role.id, role]));
    return uniqueRoleIds.map((roleId) => byId.get(roleId)!);
  }

  private async resolveRolesByNamesForCompany(
    roleNames: string[],
    companyId: string,
    manager?: EntityManager,
  ): Promise<Role[]> {
    const uniqueRoleNames = Array.from(new Set(roleNames));
    const roles: Role[] = [];

    for (const roleName of uniqueRoleNames) {
      const role = await this.findRoleByNameForCompany(roleName, companyId, manager);

      if (!role) {
        throw new NotFoundException(
          `Role "${roleName}" was not found for this company`,
        );
      }

      roles.push(role);
    }

    return roles;
  }

  private getUserRepository(manager?: EntityManager): Repository<User> {
    return manager?.getRepository(User) ?? this.userRepository;
  }

  private slugify(value: string): string {
    return value
      .trim()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private buildSlugCandidate(baseSlug: string, suffix: number): string {
    if (suffix === 0) {
      return baseSlug;
    }

    const suffixText = `-${suffix}`;
    const maxBaseLength = Math.max(1, 120 - suffixText.length);
    const trimmedBase = baseSlug.slice(0, maxBaseLength).replace(/-+$/g, '');
    const safeBase = trimmedBase || 'company';

    return `${safeBase}${suffixText}`;
  }

  private async generateUniqueCompanySlug(
    name: string,
    excludeCompanyId?: string,
    manager?: EntityManager,
  ): Promise<string> {
    const companyRepository = this.getCompanyRepository(manager);
    const baseSlug = this.slugify(name);

    if (!baseSlug) {
      throw new BadRequestException('Company slug could not be generated');
    }

    let suffix = 0;
    while (true) {
      const candidateSlug = this.buildSlugCandidate(baseSlug, suffix);
      const query = companyRepository
        .createQueryBuilder('company')
        .select(['company.id'])
        .where('company.slug = :slug', { slug: candidateSlug });

      if (excludeCompanyId) {
        query.andWhere('company.id != :excludeCompanyId', {
          excludeCompanyId,
        });
      }

      const existing = await query.getOne();

      if (!existing) {
        return candidateSlug;
      }

      suffix += 1;
    }
  }

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = (error as QueryFailedError & {
      driverError?: { code?: string | number };
    }).driverError;

    return (
      driverError?.code === '23505' ||
      driverError?.code === 'ER_DUP_ENTRY' ||
      String(driverError?.code ?? '') === '1062'
    );
  }

  private getMembershipPermissions(membership: CompanyUser): string[] {
    const permissions = new Set<string>();

    membership.permission_assignments?.forEach((assignment) => {
      if (assignment.permission?.name) {
        permissions.add(assignment.permission.name);
      }
    });

    membership.role_assignments?.forEach((assignment) => {
      assignment.role?.permissions?.forEach((permission) => {
        if (permission?.name) {
          permissions.add(permission.name);
        }
      });
    });

    return Array.from(permissions);
  }

  private mapMembershipSummary(membership: CompanyUser): CompanySummary {
    return {
      companyId: membership.company_id,
      companyName: membership.company.name,
      companySlug: membership.company.slug,
      companyType: membership.company.company_type,
      membershipId: membership.id,
      isDefault: membership.is_default,
      roles:
        membership.role_assignments?.map(
          (assignment) => assignment.role.name,
        ) ?? [],
      permissions: this.getMembershipPermissions(membership),
    };
  }

  private async generateUserNo(manager?: EntityManager): Promise<string> {
    const repository = this.getUserRepository(manager);
    const year = new Date().getFullYear();
    const prefix = `USER-${year}-`;

    const lastUser = await repository
      .createQueryBuilder('user')
      .where('user.user_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('user.user_no', 'DESC')
      .limit(1)
      .getOne();

    const nextNumber = lastUser?.user_no
      ? Number(lastUser.user_no.substring(prefix.length)) + 1
      : 1;

    return `${prefix}${String(nextNumber || 1).padStart(5, '0')}`;
  }

  async createCompany(
    dto: {
      name: string;
      company_type: CompanyType;
      tira_license_number?: string;
      tira_license_status?: string;
      license_issued_at?: string;
      license_expires_at?: string;
      tin?: string;
      brela_registration_number?: string;
    },
    manager?: EntityManager,
  ): Promise<Company> {
    const companyRepository = this.getCompanyRepository(manager);
    const normalizedName = dto.name.trim();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const uniqueSlug = await this.generateUniqueCompanySlug(
        normalizedName,
        undefined,
        manager,
      );
      const company = companyRepository.create({
        name: normalizedName,
        slug: uniqueSlug,
        status: 'active',
        company_type: dto.company_type,
        tira_license_number: dto.tira_license_number ?? null,
        tira_license_status: dto.tira_license_status ?? null,
        license_issued_at: dto.license_issued_at ? new Date(dto.license_issued_at) : null,
        license_expires_at: dto.license_expires_at ? new Date(dto.license_expires_at) : null,
        tin: dto.tin ?? null,
        brela_registration_number: dto.brela_registration_number ?? null,
      });

      try {
        return await companyRepository.save(company);
      } catch (error) {
        if (this.isDuplicateEntryError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to generate a unique company slug');
  }

  async createCompanyWithAdministrator(createCompanyDto: CreateCompanyDto) {
    const {
      company_name,
      company_type,
      tira_license_number,
      tira_license_status,
      license_issued_at,
      license_expires_at,
      tin,
      brela_registration_number,
      admin_first_name,
      admin_last_name,
      admin_email,
      admin_phone,
      admin_password,
    } = createCompanyDto;

    return this.companyRepository.manager.transaction(async (manager) => {
      const userRepository = this.getUserRepository(manager);

      const existingUser = await userRepository.findOne({
        where: [{ email: admin_email }, { phone: admin_phone }],
      });

      if (existingUser) {
        throw new ConflictException(
          existingUser.email === admin_email
            ? 'Administrator email already exists'
            : 'Administrator phone number already exists',
        );
      }

      const company = await this.createCompany(
        {
          name: company_name,
          company_type,
          tira_license_number,
          tira_license_status,
          license_issued_at,
          license_expires_at,
          tin,
          brela_registration_number,
        },
        manager,
      );
      const hashedPassword = await hashPassword(admin_password);
      const userNo = await this.generateUserNo(manager);

      const administrator = await userRepository.save(
        userRepository.create({
          user_no: userNo,
          first_name: admin_first_name,
          last_name: admin_last_name,
          phone: admin_phone,
          email: admin_email,
          password: hashedPassword,
          status: 'active',
          user_type: 'COMPANY_USER',
          is_email_verified: true,
        }),
      );

      const companyContext = await this.addUserToCompany(
        administrator.id,
        company.id,
        {
          isDefault: true,
          roleNames: [this.getDefaultAdminRoleForCompanyType(company.company_type)],
        },
        manager,
      );

      return {
        message: 'Company and first administrator created successfully',
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
          company_type: company.company_type,
          status: company.status,
          tira_license_number: company.tira_license_number,
          tira_license_status: company.tira_license_status,
          created_at: company.created_at,
        },
        administrator: {
          id: administrator.id,
          user_no: administrator.user_no,
          first_name: administrator.first_name,
          last_name: administrator.last_name,
          phone: administrator.phone,
          email: administrator.email,
          status: administrator.status,
          user_type: administrator.user_type,
          roles: companyContext.roles,
          permissions: companyContext.permissions,
        },
      };
    });
  }

  async findActiveCompanyBySlug(
    slug: string,
    manager?: EntityManager,
  ): Promise<Company | null> {
    const companyRepository = this.getCompanyRepository(manager);

    return companyRepository.findOne({
      where: {
        slug: slug.trim().toLowerCase(),
        status: 'active',
      },
    });
  }

  async findAllCompanies() {
    const companies = await this.companyRepository
      .createQueryBuilder('company')
      .leftJoin('company.memberships', 'membership', "membership.status = 'active'")
      .select([
        'company.id AS id',
        'company.name AS name',
        'company.slug AS slug',
        'company.status AS status',
        'company.contact_email AS contact_email',
        'company.contact_phone AS contact_phone',
        'company.website AS website',
        'company.logo_url AS logo_url',
        'company.address AS address',
        'company.settings AS settings',
        'company.company_type AS company_type',
        'company.tira_license_number AS tira_license_number',
        'company.tira_license_status AS tira_license_status',
        'company.license_expires_at AS license_expires_at',
        'company.created_at AS created_at',
        'COUNT(membership.id) AS active_users_count',
      ])
      .groupBy('company.id')
      .addGroupBy('company.name')
      .addGroupBy('company.slug')
      .addGroupBy('company.status')
      .addGroupBy('company.contact_email')
      .addGroupBy('company.contact_phone')
      .addGroupBy('company.website')
      .addGroupBy('company.logo_url')
      .addGroupBy('company.address')
      .addGroupBy('company.settings')
      .addGroupBy('company.company_type')
      .addGroupBy('company.tira_license_number')
      .addGroupBy('company.tira_license_status')
      .addGroupBy('company.license_expires_at')
      .addGroupBy('company.created_at')
      .orderBy('company.name', 'ASC')
      .getRawMany<{
        id: string;
        name: string;
        slug: string;
        status: string;
        company_type: CompanyType | null;
        tira_license_number: string | null;
        tira_license_status: string | null;
        license_expires_at: Date | null;
        contact_email: string | null;
        contact_phone: string | null;
        website: string | null;
        logo_url: string | null;
        address: Record<string, unknown> | null;
        settings: Record<string, unknown> | null;
        created_at: Date;
        active_users_count: string;
      }>();

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      company_type: company.company_type ?? null,
      tira_license_number: company.tira_license_number ?? null,
      tira_license_status: company.tira_license_status ?? null,
      license_expires_at: company.license_expires_at ?? null,
      contact_email: company.contact_email ?? null,
      contact_phone: company.contact_phone ?? null,
      website: company.website ?? null,
      logo_url: company.logo_url ?? null,
      address: company.address ?? null,
      settings: company.settings ?? null,
      created_at: company.created_at,
      active_users_count: Number(company.active_users_count ?? 0),
    }));
  }

  async listUserCompanies(
    userId: string,
    manager?: EntityManager,
  ): Promise<CompanySummary[]> {
    const companyUserRepository = this.getCompanyUserRepository(manager);

    const memberships = await companyUserRepository.find({
      where: {
        user_id: userId,
        status: 'active',
      },
      relations: {
        company: true,
        role_assignments: {
          role: {
            permissions: true,
          },
        },
        permission_assignments: {
          permission: true,
        },
      },
      order: {
        is_default: 'DESC',
        last_accessed_at: 'DESC',
        company: {
          name: 'ASC',
        },
      },
    });

    return memberships
      .filter((membership) => membership.company?.status === 'active')
      .map((membership) => this.mapMembershipSummary(membership));
  }

  async getMembershipContext(
    userId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<CompanyMembershipContext> {
    const companyUserRepository = this.getCompanyUserRepository(manager);

    const membership = await companyUserRepository.findOne({
      where: {
        user_id: userId,
        company_id: companyId,
        status: 'active',
      },
      relations: {
        company: true,
        role_assignments: {
          role: {
            permissions: true,
          },
        },
        permission_assignments: {
          permission: true,
        },
      },
    });

    if (!membership || membership.company.status !== 'active') {
      throw new NotFoundException('Active company membership not found');
    }

    return {
      ...this.mapMembershipSummary(membership),
      status: membership.status,
    };
  }

  async setActiveMembership(
    userId: string,
    companyId: string,
    manager?: EntityManager,
  ): Promise<CompanyMembershipContext> {
    const companyUserRepository = this.getCompanyUserRepository(manager);
    const membership = await this.getMembershipContext(userId, companyId, manager);

    await companyUserRepository.update(
      { user_id: userId, status: 'active' },
      { is_default: false },
    );
    await companyUserRepository.update(membership.membershipId, {
      is_default: true,
      last_accessed_at: new Date(),
    });

    return this.getMembershipContext(userId, companyId, manager);
  }

  async setPrimaryUser(
    companyId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<CompanyMembershipContext> {
    const companyUserRepository = this.getCompanyUserRepository(manager);

    const membership = await companyUserRepository.findOne({
      where: {
        company_id: companyId,
        user_id: userId,
        status: 'active',
      },
      relations: {
        company: true,
        role_assignments: {
          role: {
            permissions: true,
          },
        },
        permission_assignments: {
          permission: true,
        },
      },
    });

    if (!membership || membership.company.status !== 'active') {
      throw new NotFoundException('Active company membership not found');
    }

    await companyUserRepository.update(
      { company_id: companyId, status: 'active' },
      { is_default: false },
    );
    await companyUserRepository.update(membership.id, {
      is_default: true,
      last_accessed_at: new Date(),
    });

    return this.getMembershipContext(userId, companyId, manager);
  }

  async addUserToCompany(
    userId: string,
    companyId: string,
    options?: {
      isDefault?: boolean;
      roleIds?: string[];
      roleNames?: string[];
    },
    manager?: EntityManager,
  ): Promise<CompanyMembershipContext> {
    const companyRepository = this.getCompanyRepository(manager);
    const companyUserRepository = this.getCompanyUserRepository(manager);
    const companyUserRoleRepository =
      this.getCompanyUserRoleRepository(manager);
    const userRepository = this.getUserRepository(manager);

    const company = await companyRepository.findOne({
      where: { id: companyId, status: 'active' },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const user = await userRepository.findOne({
      where: { id: userId },
      select: { id: true, user_type: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.user_type === 'OWNER' || user.user_type === 'SUPER_ADMIN') {
      throw new BadRequestException(
        'Platform users cannot be assigned to a company',
      );
    }

    const existingMembership = await companyUserRepository.findOne({
      where: { company_id: companyId, user_id: userId },
    });

    let membership = existingMembership;
    if (!membership) {
      const hasOtherMemberships =
        (await companyUserRepository.count({
          where: { user_id: userId, status: 'active' },
        })) > 0;

      membership = companyUserRepository.create({
        company_id: companyId,
        user_id: userId,
        status: 'active',
        is_default: options?.isDefault ?? !hasOtherMemberships,
      });
      membership = await companyUserRepository.save(membership);
    } else if (membership.status !== 'active') {
      membership.status = 'active';
      membership.is_default = options?.isDefault ?? membership.is_default;
      membership = await companyUserRepository.save(membership);
    }

    if (membership.is_default) {
      await companyUserRepository.update(
        { user_id: userId },
        { is_default: false },
      );
      membership.is_default = true;
      membership = await companyUserRepository.save(membership);
    }

    const roleIds = new Set<string>();

    options?.roleIds?.forEach((roleId) => {
      if (roleId) {
        roleIds.add(roleId);
      }
    });

    if (options?.roleNames?.length) {
      const namedRoles = await this.resolveRolesByNamesForCompany(
        options.roleNames,
        companyId,
        manager,
      );
      namedRoles.forEach((role) => roleIds.add(role.id));
    }

    if (!roleIds.size) {
      const viewerRole = await this.findRoleByNameForCompany(
        'VIEWER',
        companyId,
        manager,
      );

      if (!viewerRole) {
        throw new NotFoundException('Default viewer role not found');
      }

      roleIds.add(viewerRole.id);
    }

    const resolvedRoles = await this.resolveRolesByIdsForCompany(
      Array.from(roleIds),
      companyId,
      manager,
    );
    void resolvedRoles;

    for (const roleId of roleIds) {
      const existingAssignment = await companyUserRoleRepository.findOne({
        where: {
          company_user_id: membership.id,
          role_id: roleId,
        },
      });

      if (!existingAssignment) {
        await companyUserRoleRepository.save(
          companyUserRoleRepository.create({
            company_user_id: membership.id,
            role_id: roleId,
          }),
        );
      }
    }

    return this.getMembershipContext(userId, companyId, manager);
  }

  async assignRole(
    companyId: string,
    userId: string,
    roleId: string,
  ): Promise<CompanyMembershipContext> {
    const membership = await this.companyUserRepository.findOne({
      where: {
        company_id: companyId,
        user_id: userId,
        status: 'active',
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this company');
    }

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role || (role.company_id !== null && role.company_id !== companyId)) {
      throw new NotFoundException('Role not found');
    }

    const existingAssignment = await this.companyUserRoleRepository.findOne({
      where: {
        company_user_id: membership.id,
        role_id: roleId,
      },
    });

    if (!existingAssignment) {
      await this.companyUserRoleRepository.save(
        this.companyUserRoleRepository.create({
          company_user_id: membership.id,
          role_id: roleId,
        }),
      );
    }

    return this.getMembershipContext(userId, companyId);
  }

  async revokeRole(
    companyId: string,
    userId: string,
    roleId: string,
  ): Promise<CompanyMembershipContext> {
    const membership = await this.companyUserRepository.findOne({
      where: {
        company_id: companyId,
        user_id: userId,
        status: 'active',
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this company');
    }

    await this.companyUserRoleRepository.delete({
      company_user_id: membership.id,
      role_id: roleId,
    });

    return this.getMembershipContext(userId, companyId);
  }

  async touchMembership(membershipId: string): Promise<void> {
    await this.companyUserRepository.update(membershipId, {
      last_accessed_at: new Date(),
    });
  }

  async removeUserFromCompany(
    companyId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const membership = await this.companyUserRepository.findOne({
      where: {
        company_id: companyId,
        user_id: userId,
        status: 'active',
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this company');
    }

    await this.companyUserRepository.delete({ id: membership.id });

    return { message: 'User removed from company successfully' };
  }

  async findCompanyUserContext(
    companyId: string,
    userId: string,
  ): Promise<CompanyMembershipContext> {
    return this.getMembershipContext(userId, companyId);
  }

  async findCompanyUserDetailContext(
    companyId: string,
    userId: string,
  ): Promise<{
    companyId: string;
    companyName: string;
    companySlug: string;
    roles: { id: string; name: string; display_name: string }[];
    permissions: { id: string; name: string; display_name: string }[];
  }> {
    const membership = await this.companyUserRepository.findOne({
      where: { user_id: userId, company_id: companyId, status: 'active' },
      relations: {
        company: true,
        role_assignments: { role: true },
        permission_assignments: { permission: true },
      },
    });

    if (!membership || membership.company.status !== 'active') {
      throw new NotFoundException('Active company membership not found');
    }

    return {
      companyId: membership.company_id,
      companyName: membership.company.name,
      companySlug: membership.company.slug,
      roles: (membership.role_assignments ?? []).map((a) => ({
        id: a.role.id,
        name: a.role.name,
        display_name: a.role.display_name,
      })),
      permissions: (membership.permission_assignments ?? []).map((a) => ({
        id: a.permission.id,
        name: a.permission.name,
        display_name: a.permission.display_name,
      })),
    };
  }

  async findCompanyById(id: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) throw new NotFoundException(`Company not found`);
    return company;
  }

  async updateCompany(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findCompanyById(id);

    if (dto.name !== undefined) {
      const normalizedName = dto.name.trim();
      if (!normalizedName) {
        throw new BadRequestException('Company name can not be empty');
      }

      company.name = normalizedName;
      company.slug = await this.generateUniqueCompanySlug(
        normalizedName,
        company.id,
      );
    }

    const { name, ...rest } = dto;
    void name;
    Object.assign(company, rest);

    return this.companyRepository.save(company);
  }

  async setCompanyStatus(id: string, status: 'active' | 'inactive'): Promise<Company> {
    const company = await this.findCompanyById(id);
    company.status = status;
    return this.companyRepository.save(company);
  }

  async deleteCompany(id: string): Promise<void> {
    const company = await this.findCompanyById(id);
    await this.companyRepository.remove(company);
  }

  async findCompanyUsersPaginated(companyId: string, query: PaginationDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
    } = query;

    const qb = this.companyUserRepository
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.user', 'user')
      .innerJoinAndSelect('membership.company', 'company')
      .leftJoinAndSelect('membership.role_assignments', 'roleAssignments')
      .leftJoinAndSelect('roleAssignments.role', 'roles')
      .leftJoinAndSelect('roles.permissions', 'rolePermissions')
      .leftJoinAndSelect(
        'membership.permission_assignments',
        'permissionAssignments',
      )
      .leftJoinAndSelect('permissionAssignments.permission', 'permissions')
      .where('membership.company_id = :companyId', { companyId })
      .andWhere('membership.status = :status', { status: 'active' });

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(user.first_name ILIKE :term OR ' +
        'user.last_name ILIKE :term OR ' +
        'user.email ILIKE :term OR ' +
        'user.phone ILIKE :term OR ' +
        'user.user_no ILIKE :term)',
        { term },
      );
    }

    const allowedSortFields = [
      'id',
      'user_no',
      'first_name',
      'last_name',
      'email',
      'phone',
      'status',
      'created_at',
      'updated_at',
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    qb.orderBy(`user.${safeSortBy}`, direction);

    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: items.map((membership) => ({
        id: membership.user.id,
        user_no: membership.user.user_no,
        first_name: membership.user.first_name,
        last_name: membership.user.last_name,
        phone: membership.user.phone,
        email: membership.user.email,
        status: membership.user.status,
        user_type: membership.user.user_type,
        is_email_verified: membership.user.is_email_verified,
        is_two_factor_enabled: membership.user.is_two_factor_enabled,
        last_login_at: membership.user.last_login_at,
        last_login_ip: membership.user.last_login_ip,
        created_at: membership.user.created_at,
        updated_at: membership.user.updated_at,
        roles:
          membership.role_assignments?.map(
            (assignment) => assignment.role.name,
          ) ?? [],
        permissions: this.getMembershipPermissions(membership),
      })),
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

  private getDefaultAdminRoleForCompanyType(companyType: CompanyType): string {
    switch (companyType) {
      case CompanyType.INSURANCE_COMPANY:
        return 'INSURANCE_ADMIN';
      case CompanyType.REINSURANCE_COMPANY:
        return 'REINSURANCE_ADMIN';
      case CompanyType.BROKER:
        return 'BROKER_ADMIN';
      case CompanyType.AGENCY:
        return 'AGENCY_ADMIN';
      case CompanyType.BANCASSURANCE:
        return 'BANCASSURANCE_ADMIN';
      case CompanyType.SERVICE_PROVIDER:
        return 'SERVICE_PROVIDER_ADMIN';
      default:
        return 'ADMINISTRATOR';
    }
  }

}
