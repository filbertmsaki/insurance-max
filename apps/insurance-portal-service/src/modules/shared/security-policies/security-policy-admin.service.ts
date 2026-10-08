import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SecurityPolicyStatus } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { AuditService } from '../audit/audit.service';
import { CreateSecurityPolicyDraftDto } from './dto/security-policy.dto';
import { SecurityPolicyProfile } from './entities/security-policy-profile.entity';
import { SecurityPoliciesService } from './security-policies.service';

/** Company policies share one profile code and are versioned under it. */
export const COMPANY_POLICY_PROFILE_CODE = 'COMPANY_DEFAULT';

/**
 * Company administration of security policy versions: draft, activate (by
 * a second person) and retire. Resolution and the tighten-only rule live in
 * SecurityPoliciesService.
 */
@Injectable()
export class SecurityPolicyAdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SecurityPolicyProfile)
    private readonly profileRepository: Repository<SecurityPolicyProfile>,
    private readonly policiesService: SecurityPoliciesService,
    private readonly auditService: AuditService,
  ) {}

  async overview(user: AuthenticatedUser) {
    const companyId = user.companyId!;
    const layers = await this.policiesService.resolveLayers(companyId);
    const versions = await this.profileRepository.find({
      where: { company_id: companyId },
      order: { version_number: 'DESC' },
    });

    return {
      effective: this.withoutStepUp(layers.effective),
      baseline: this.withoutStepUp(layers.baseline),
      baseline_source: layers.baselineSource,
      active_version_id: layers.companyProfile?.id ?? null,
      versions,
    };
  }

  async createDraft(
    user: AuthenticatedUser,
    dto: CreateSecurityPolicyDraftDto,
  ) {
    const companyId = user.companyId!;

    const draft = await this.dataSource.transaction(async (manager) => {
      await this.lockCompany(manager, companyId);
      const repository = manager.getRepository(SecurityPolicyProfile);
      const [latest] = await repository.find({
        where: {
          company_id: companyId,
          profile_code: COMPANY_POLICY_PROFILE_CODE,
        },
        order: { version_number: 'DESC' },
        take: 1,
      });
      const version = (latest?.version_number ?? 0) + 1;
      const twoFactor = dto.two_factor;

      return repository.save(
        repository.create({
          company_id: companyId,
          profile_code: COMPANY_POLICY_PROFILE_CODE,
          profile_name:
            dto.profile_name?.trim() || `Company security policy v${version}`,
          version_number: version,
          status: SecurityPolicyStatus.DRAFT,
          description: dto.description?.trim() || null,
          policy: {
            twoFactor: {
              ...(twoFactor.require_for_all_users !== undefined
                ? { requireForAllUsers: twoFactor.require_for_all_users }
                : {}),
              ...(twoFactor.require_for_roles
                ? { requireForRoles: this.clean(twoFactor.require_for_roles) }
                : {}),
              ...(twoFactor.require_for_permissions
                ? {
                    requireForPermissions: this.clean(
                      twoFactor.require_for_permissions,
                    ),
                  }
                : {}),
              ...(twoFactor.require_for_user_types
                ? {
                    requireForUserTypes: this.clean(
                      twoFactor.require_for_user_types,
                    ),
                  }
                : {}),
              ...(twoFactor.allow_trusted_device_bypass !== undefined
                ? {
                    allowTrustedDeviceBypass:
                      twoFactor.allow_trusted_device_bypass,
                  }
                : {}),
            },
          },
          created_by: user.id,
        }),
      );
    });

    await this.audit(user, 'security-policy.draft.created', draft);
    return draft;
  }

  /**
   * Makes a draft the company's active policy and supersedes the previous
   * one. The drafter cannot activate their own draft.
   */
  async activate(user: AuthenticatedUser, id: string) {
    const companyId = user.companyId!;

    const activated = await this.dataSource.transaction(async (manager) => {
      await this.lockCompany(manager, companyId);
      const repository = manager.getRepository(SecurityPolicyProfile);
      const draft = await this.requireProfile(repository, companyId, id);

      if (draft.status !== SecurityPolicyStatus.DRAFT) {
        throw new ConflictException('Only a draft policy can be activated');
      }
      if (draft.created_by === user.id) {
        throw new ForbiddenException(
          'A security policy must be activated by someone other than its author',
        );
      }

      const now = new Date();
      await repository.update(
        { company_id: companyId, status: SecurityPolicyStatus.ACTIVE },
        { status: SecurityPolicyStatus.SUPERSEDED, effective_to: now },
      );

      draft.status = SecurityPolicyStatus.ACTIVE;
      draft.approved_by = user.id;
      draft.approved_at = now;
      draft.effective_from = now;
      draft.effective_to = null;
      return repository.save(draft);
    });

    await this.audit(user, 'security-policy.activated', activated);
    return activated;
  }

  /** Retires the active company policy; the platform baseline then applies. */
  async retire(user: AuthenticatedUser, id: string) {
    const companyId = user.companyId!;

    const retired = await this.dataSource.transaction(async (manager) => {
      await this.lockCompany(manager, companyId);
      const repository = manager.getRepository(SecurityPolicyProfile);
      const profile = await this.requireProfile(repository, companyId, id);

      if (profile.status !== SecurityPolicyStatus.ACTIVE) {
        throw new ConflictException('Only the active policy can be retired');
      }

      profile.status = SecurityPolicyStatus.RETIRED;
      profile.effective_to = new Date();
      return repository.save(profile);
    });

    await this.audit(user, 'security-policy.retired', retired);
    return retired;
  }

  private async requireProfile(
    repository: Repository<SecurityPolicyProfile>,
    companyId: string,
    id: string,
  ) {
    const profile = await repository.findOne({
      where: { id, company_id: companyId },
    });
    if (!profile) {
      throw new NotFoundException('Security policy not found');
    }
    return profile;
  }

  /** Serialises version numbering and activation per company. */
  private async lockCompany(manager: EntityManager, companyId: string) {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `security-policy:${companyId}`,
    ]);
  }

  private clean(values: string[]) {
    return Array.from(
      new Set(values.map((value) => value.trim()).filter(Boolean)),
    );
  }

  private withoutStepUp<T extends { stepUpMaxAgeMinutes: number }>(
    policy: T,
  ): Omit<T, 'stepUpMaxAgeMinutes'> {
    const { stepUpMaxAgeMinutes: _unenforced, ...rest } = policy;
    return rest;
  }

  private audit(
    user: AuthenticatedUser,
    action: string,
    profile: SecurityPolicyProfile,
  ) {
    return this.auditService.log({
      userId: user.id,
      companyId: user.companyId,
      action,
      resource: 'security_policy_profile',
      resourceId: profile.id,
      metadata: {
        version: profile.version_number,
        status: profile.status,
        policy: profile.policy,
      },
    });
  }
}
