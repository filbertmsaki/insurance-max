import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, Repository } from 'typeorm';

import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import {
  comparePasswords,
  hashPassword,
} from '@insurance-max/portal-shared/utils/hash.util';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CompaniesService } from '../../platform/companies/companies.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserProfileDto } from './dtos/user-profile-dto';
import { UserAdminDetailDto } from './dtos/user-admin-detail.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly companiesService: CompaniesService,
  ) {}

  private extractRoleIds(
    roles?: Array<{ id?: string } | string>,
  ): string[] | undefined {
    if (!roles?.length) return undefined;
    const ids = roles
      .map((r) => (typeof r === 'string' ? r : r?.id))
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    return ids.length ? ids : undefined;
  }

  private async findOrFail(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { roles: { permissions: true }, permissions: true },
    });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async generateUserNo(manager?: EntityManager): Promise<string> {
    const repository = manager?.getRepository(User) ?? this.userRepository;
    const year = new Date().getFullYear();
    const prefix = `USER-${year}-`;

    const lastUser = await repository
      .createQueryBuilder('user')
      .where('user.user_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('user.user_no', 'DESC')
      .limit(1)
      .getOne();

    let nextNumber = 1;
    if (lastUser?.user_no) {
      const parsed = Number(lastUser.user_no.substring(prefix.length));
      if (!isNaN(parsed)) nextNumber = parsed + 1;
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  async createForCompany(
    companyId: string,
    createUserDto: CreateUserDto,
  ): Promise<UserProfileDto | { message: string; user: UserProfileDto }> {
    const { roles, password, branch_id, officer_title, ...userData } =
      createUserDto;

    await this.companiesService.assertBranchBelongsToCompany(
      companyId,
      branch_id,
    );
    const existingByEmail = await this.userRepository.findOne({
      where: { email: userData.email },
    });
    const existingByPhone = await this.userRepository.findOne({
      where: { phone: userData.phone },
    });

    if (
      existingByEmail &&
      existingByPhone &&
      existingByEmail.id !== existingByPhone.id
    ) {
      throw new ConflictException(
        'Email and phone belong to different existing users',
      );
    }

    const existingUser = existingByEmail ?? existingByPhone;
    const roleIds = this.extractRoleIds(roles);

    if (existingUser) {
      if (existingByEmail && existingByEmail.phone !== userData.phone) {
        throw new ConflictException(
          'This email already exists with a different phone number',
        );
      }
      if (existingByPhone && existingByPhone.email !== userData.email) {
        throw new ConflictException(
          'This phone number already exists with a different email',
        );
      }

      const currentMembership = await this.companiesService
        .findCompanyUserContext(companyId, existingUser.id)
        .catch(() => null);

      if (currentMembership)
        throw new ConflictException('User already belongs to this company');

      const membership = await this.companiesService.addUserToCompany(
        existingUser.id,
        companyId,
        { roleIds },
      );
      existingUser.officer_title = officer_title || existingUser.officer_title;
      await this.userRepository.save(existingUser);
      await this.companiesService.assignCompanyUserToBranch(
        companyId,
        membership.membershipId,
        branch_id,
        true,
      );

      return {
        message: 'Existing user added to company successfully',
        user: await this.findProfileInCompany(existingUser.id, companyId),
      };
    }

    const hashedPassword = await hashPassword(password);
    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
      user_no: userData.user_no ?? (await this.generateUserNo()),
      status: userData.status ?? 'active',
      user_type: userData.user_type ?? 'COMPANY_USER',
      officer_title: officer_title || 'Underwriter',
      is_email_verified: true,
    });

    const savedUser = await this.userRepository.save(user);
    const membership = await this.companiesService.addUserToCompany(
      savedUser.id,
      companyId,
      {
        roleIds,
      },
    );
    await this.companiesService.assignCompanyUserToBranch(
      companyId,
      membership.membershipId,
      branch_id,
      true,
    );

    return this.findProfileInCompany(savedUser.id, companyId);
  }

  async findByEmailForAuth(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        status: true,
        user_type: true,
        first_name: true,
        last_name: true,
        user_no: true,
        phone: true,
        last_login_at: true,
        last_login_ip: true,
        is_email_verified: true,
        is_two_factor_enabled: true,
        failed_login_attempts: true,
        locked_until: true,
      },
      relations: { roles: { permissions: true }, permissions: true },
    });
  }

  async findByEmailWithRelations(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: { roles: { permissions: true }, permissions: true },
    });
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: { roles: true, permissions: true },
    });
  }

  async findAllPaginatedInCompany(companyId: string, query: PaginationDto) {
    return this.companiesService.findCompanyUsersPaginated(companyId, query);
  }

  async findByIdWithRelations(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: { roles: { permissions: true }, permissions: true },
    });
  }

  async findById(id: string): Promise<User> {
    return this.findOrFail(id);
  }

  async findByIdFor2FA(userId: string): Promise<User> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.two_factor_secret')
      .addSelect('user.two_factor_backup_codes')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: { roles: { permissions: true }, permissions: true },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { phone },
      relations: { roles: { permissions: true }, permissions: true },
    });
  }

  async findByUserNo(userNo: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { user_no: userNo } });
  }

  async existsByUserNo(userNo: string): Promise<boolean> {
    return !!(await this.findByUserNo(userNo));
  }

  async findMyProfileById(
    id: string,
    companyId?: string,
  ): Promise<UserProfileDto> {
    const user = await this.findOrFail(id);

    if (!companyId) {
      const permissions = new Set<string>();
      user.permissions?.forEach((permission) => {
        if (permission?.name) permissions.add(permission.name);
      });
      user.roles?.forEach((role) => {
        role.permissions?.forEach((permission) => {
          if (permission?.name) permissions.add(permission.name);
        });
      });

      return new UserProfileDto({
        id: user.id,
        user_no: user.user_no,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        email: user.email,
        status: user.status,
        user_type: user.user_type,
        officer_title: user.officer_title,
        is_email_verified: user.is_email_verified,
        is_two_factor_enabled: user.is_two_factor_enabled,
        last_login_at: user.last_login_at,
        last_login_ip: user.last_login_ip,
        created_at: user.created_at,
        updated_at: user.updated_at,
        roles: user.roles?.map((role) => role.name) ?? [],
        permissions: Array.from(permissions),
        companies: [],
      });
    }

    const currentCompany = await this.companiesService.findCompanyUserContext(
      companyId,
      id,
    );
    const companies = await this.companiesService.listUserCompanies(id);

    return new UserProfileDto({
      id: user.id,
      user_no: user.user_no,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      email: user.email,
      status: user.status,
      user_type: user.user_type,
      officer_title: user.officer_title,
      is_email_verified: user.is_email_verified,
      is_two_factor_enabled: user.is_two_factor_enabled,
      last_login_at: user.last_login_at,
      last_login_ip: user.last_login_ip,
      created_at: user.created_at,
      updated_at: user.updated_at,
      roles: currentCompany.roles,
      permissions: currentCompany.permissions,
      current_company: {
        id: currentCompany.companyId,
        name: currentCompany.companyName,
        slug: currentCompany.companySlug,
      },
      companies,
    });
  }

  async findProfileInCompany(
    id: string,
    companyId: string,
  ): Promise<UserProfileDto> {
    const user = await this.findOrFail(id);
    const companyContext = await this.companiesService.findCompanyUserContext(
      companyId,
      id,
    );

    return new UserProfileDto({
      id: user.id,
      user_no: user.user_no,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      email: user.email,
      status: user.status,
      user_type: user.user_type,
      officer_title: user.officer_title,
      is_email_verified: user.is_email_verified,
      is_two_factor_enabled: user.is_two_factor_enabled,
      last_login_at: user.last_login_at,
      last_login_ip: user.last_login_ip,
      created_at: user.created_at,
      updated_at: user.updated_at,
      roles: companyContext.roles,
      permissions: companyContext.permissions,
      current_company: {
        id: companyContext.companyId,
        name: companyContext.companyName,
        slug: companyContext.companySlug,
      },
    });
  }

  async findAdminDetailInCompany(
    id: string,
    companyId: string,
  ): Promise<UserAdminDetailDto> {
    const user = await this.findOrFail(id);
    const ctx = await this.companiesService.findCompanyUserDetailContext(
      companyId,
      id,
    );

    return new UserAdminDetailDto({
      id: user.id,
      user_no: user.user_no,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      email: user.email,
      status: user.status,
      user_type: user.user_type,
      officer_title: user.officer_title,
      is_email_verified: user.is_email_verified,
      is_phone_verified: user.is_phone_verified,
      is_two_factor_enabled: user.is_two_factor_enabled,
      failed_login_attempts: user.failed_login_attempts,
      last_login_at: user.last_login_at,
      last_login_ip: user.last_login_ip,
      locked_until: user.locked_until,
      created_at: user.created_at,
      updated_at: user.updated_at,
      roles: ctx.roles,
      permissions: ctx.permissions,
      current_company: {
        id: ctx.companyId,
        name: ctx.companyName,
        slug: ctx.companySlug,
      },
    });
  }

  async updateLastLogin(
    id: string,
    lastLoginAt: Date,
    lastLoginIp: string | null,
  ): Promise<void> {
    await this.userRepository.update(id, {
      last_login_at: lastLoginAt,
      last_login_ip: lastLoginIp,
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.userRepository.update(id, { password: hashedPassword });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOrFail(id);
    const { roles, branch_id, ...safeUpdate } =
      updateUserDto as UpdateUserDto & {
        roles?: unknown;
        branch_id?: unknown;
      };
    void roles;
    void branch_id;
    Object.assign(user, safeUpdate);
    return this.userRepository.save(user);
  }

  async updateInCompany(
    companyId: string,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserProfileDto> {
    await this.companiesService.findCompanyUserContext(companyId, id);
    await this.update(id, dto);
    return this.findProfileInCompany(id, companyId);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await comparePasswords(oldPassword, user.password ?? '');
    if (!isMatch) throw new UnauthorizedException('Current password incorrect');

    const hashed = await hashPassword(newPassword);
    await this.userRepository.update(userId, { password: hashed });
    return { message: 'Password changed successfully' };
  }

  async updateVerificationToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      email_verification_token: token,
      email_verification_expires: expires,
    });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      is_email_verified: true,
      email_verification_token: null,
      email_verification_expires: null,
    });
  }

  async markPhoneVerified(userId: string): Promise<void> {
    await this.userRepository.update(userId, { is_phone_verified: true });
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: {
        email_verification_token: token,
        email_verification_expires: MoreThan(new Date()),
      },
    });
  }

  async update2FASecret(userId: string, secret: string): Promise<void> {
    await this.userRepository.update(userId, { two_factor_secret: secret });
  }

  async activate2FA(
    userId: string,
    secret: string,
    backupCodes: string[],
  ): Promise<void> {
    await this.userRepository.update(userId, {
      is_two_factor_enabled: true,
      two_factor_secret: secret,
      two_factor_backup_codes: backupCodes,
    });
  }

  async updateBackupCodes(
    userId: string,
    backupCodes: string[],
  ): Promise<void> {
    await this.userRepository.update(userId, {
      two_factor_backup_codes: backupCodes,
    });
  }

  async disable2FA(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      is_two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_backup_codes: null,
    });
  }

  async assignRoleInCompany(
    companyId: string,
    userId: string,
    roleId: string,
    actor?: AuthenticatedUser,
  ): Promise<UserProfileDto> {
    await this.companiesService.assignRole(companyId, userId, roleId, actor);
    return this.findProfileInCompany(userId, companyId);
  }

  async revokeRoleInCompany(
    companyId: string,
    userId: string,
    roleId: string,
    actor?: AuthenticatedUser,
  ): Promise<UserProfileDto> {
    await this.companiesService.revokeRole(companyId, userId, roleId, actor);
    return this.findProfileInCompany(userId, companyId);
  }

  async removeFromCompany(
    companyId: string,
    userId: string,
    actor?: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.companiesService.removeUserFromCompany(
      companyId,
      userId,
      actor,
    );
  }

  // ── Account lockout ─────────────────────────────────────────────────────────

  async lockAccount(userId: string, lockedUntil: Date): Promise<void> {
    await this.userRepository.update(userId, {
      locked_until: lockedUntil,
      status: 'locked',
    });
  }

  async incrementLoginAttempts(userId: string): Promise<void> {
    await this.userRepository.increment(
      { id: userId },
      'failed_login_attempts',
      1,
    );
  }

  async resetLoginAttempts(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      failed_login_attempts: 0,
      locked_until: null,
      status: 'active',
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.userRepository.softDelete(id);
  }
}
