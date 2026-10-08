import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { IsNull, Repository } from 'typeorm';

import { SecurityPolicyStatus } from '@insurance-max/contracts';

import { User } from '../../tenant/users/entities/user.entity';
import { SecurityPolicyProfile } from './entities/security-policy-profile.entity';

export interface EffectiveSecurityPolicy {
  requireTwoFactorForAllUsers: boolean;
  requireTwoFactorForRoles: string[];
  requireTwoFactorForPermissions: string[];
  requireTwoFactorForUserTypes: string[];
  allowTrustedDeviceBypass: boolean;
  stepUpMaxAgeMinutes: number;
}

@Injectable()
export class SecurityPoliciesService {
  constructor(
    @InjectRepository(SecurityPolicyProfile)
    private readonly policyRepository: Repository<SecurityPolicyProfile>,
    private readonly configService: ConfigService,
  ) {}

  async getEffectivePolicy(
    companyId?: string | null,
  ): Promise<EffectiveSecurityPolicy> {
    const base = this.defaultPolicy();
    const activeProfile = await this.findActivePolicy(companyId ?? null);

    if (!activeProfile?.policy) {
      return base;
    }

    const policy = activeProfile.policy;
    const twoFactor = this.readPolicyObject(policy, 'twoFactor');
    const stepUp = this.readPolicyObject(policy, 'stepUp');

    return {
      requireTwoFactorForAllUsers:
        this.readBoolean(twoFactor, 'requireForAllUsers') ??
        base.requireTwoFactorForAllUsers,
      requireTwoFactorForRoles:
        this.readStringArray(twoFactor, 'requireForRoles') ??
        base.requireTwoFactorForRoles,
      requireTwoFactorForPermissions:
        this.readStringArray(twoFactor, 'requireForPermissions') ??
        base.requireTwoFactorForPermissions,
      requireTwoFactorForUserTypes:
        this.readStringArray(twoFactor, 'requireForUserTypes') ??
        base.requireTwoFactorForUserTypes,
      allowTrustedDeviceBypass:
        this.readBoolean(twoFactor, 'allowTrustedDeviceBypass') ??
        base.allowTrustedDeviceBypass,
      stepUpMaxAgeMinutes:
        this.readStepUpMaxAge(stepUp) ?? base.stepUpMaxAgeMinutes,
    };
  }

  async resolveTwoFactorRequirement(
    user: Pick<
      User,
      'is_two_factor_enabled' | 'user_type' | 'roles' | 'permissions'
    >,
    companyId?: string | null,
  ): Promise<{
    required: boolean;
    enrolled: boolean;
    allowTrustedDeviceBypass: boolean;
    stepUpMaxAgeMinutes: number;
  }> {
    const policy = await this.getEffectivePolicy(companyId);
    const roleNames = (user.roles ?? []).map((role) => role.name);
    const directPermissions = (user.permissions ?? []).map(
      (permission) => permission.name,
    );
    const rolePermissions = (user.roles ?? []).flatMap(
      (role) => role.permissions?.map((permission) => permission.name) ?? [],
    );
    const permissions = new Set(
      [...directPermissions, ...rolePermissions].filter(Boolean),
    );

    const policyRequiresTwoFactor =
      policy.requireTwoFactorForAllUsers ||
      policy.requireTwoFactorForRoles.some((role) =>
        roleNames.includes(role),
      ) ||
      policy.requireTwoFactorForPermissions.some((permission) =>
        permissions.has(permission),
      ) ||
      policy.requireTwoFactorForUserTypes.includes(user.user_type);

    return {
      required: Boolean(user.is_two_factor_enabled) || policyRequiresTwoFactor,
      enrolled: Boolean(user.is_two_factor_enabled),
      allowTrustedDeviceBypass: policy.allowTrustedDeviceBypass,
      stepUpMaxAgeMinutes: policy.stepUpMaxAgeMinutes,
    };
  }

  private async findActivePolicy(
    companyId: string | null,
  ): Promise<SecurityPolicyProfile | null> {
    if (companyId) {
      const companyPolicies = await this.policyRepository.find({
        where: {
          company_id: companyId,
          status: SecurityPolicyStatus.ACTIVE,
        },
        order: { version_number: 'DESC', created_at: 'DESC' },
      });
      const effectiveCompanyPolicy = companyPolicies.find((profile) =>
        this.isEffective(profile),
      );
      if (effectiveCompanyPolicy) return effectiveCompanyPolicy;
    }

    const globalPolicies = await this.policyRepository.find({
      where: {
        company_id: IsNull(),
        status: SecurityPolicyStatus.ACTIVE,
      },
      order: { version_number: 'DESC', created_at: 'DESC' },
    });
    return globalPolicies.find((profile) => this.isEffective(profile)) ?? null;
  }

  private isEffective(profile: SecurityPolicyProfile): boolean {
    const now = Date.now();
    return (
      (!profile.effective_from || profile.effective_from.getTime() <= now) &&
      (!profile.effective_to || profile.effective_to.getTime() > now)
    );
  }

  private readStepUpMaxAge(
    root: Record<string, unknown> | null,
  ): number | null {
    const value = this.readNumber(root, 'maxAgeMinutes');
    return value !== null &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 1440
      ? value
      : null;
  }

  private defaultPolicy(): EffectiveSecurityPolicy {
    return {
      requireTwoFactorForAllUsers:
        this.configService.get<boolean>('SECURITY_REQUIRE_2FA_FOR_ALL_USERS') ??
        false,
      requireTwoFactorForRoles: this.readCsvEnv('SECURITY_REQUIRE_2FA_ROLES', [
        'ADMINISTRATOR',
        'SUPER_ADMIN',
      ]),
      requireTwoFactorForPermissions: this.readCsvEnv(
        'SECURITY_REQUIRE_2FA_PERMISSIONS',
        ['security-policies:activate', 'security-policies:approve'],
      ),
      requireTwoFactorForUserTypes: this.readCsvEnv(
        'SECURITY_REQUIRE_2FA_USER_TYPES',
        ['SUPER_ADMIN', 'COMPANY_ADMIN'],
      ),
      allowTrustedDeviceBypass:
        this.configService.get<boolean>('AUTH_ALLOW_TRUSTED_DEVICE_BYPASS') ??
        true,
      stepUpMaxAgeMinutes:
        this.configService.get<number>('SECURITY_STEP_UP_MAX_AGE_MINUTES') ??
        10,
    };
  }

  private readCsvEnv(key: string, fallback: string[]): string[] {
    const value = this.configService.get<string>(key);
    if (!value) {
      return fallback;
    }

    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private readPolicyObject(
    root: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> | null {
    const value = root[key];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private readBoolean(
    root: Record<string, unknown> | null,
    key: string,
  ): boolean | null {
    return typeof root?.[key] === 'boolean' ? root[key] : null;
  }

  private readNumber(
    root: Record<string, unknown> | null,
    key: string,
  ): number | null {
    return typeof root?.[key] === 'number' ? root[key] : null;
  }

  private readStringArray(
    root: Record<string, unknown> | null,
    key: string,
  ): string[] | null {
    if (!Array.isArray(root?.[key])) {
      return null;
    }

    return (root[key] as unknown[])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);
  }
}
