import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';

import { TiramisApiKeyAuditEntity } from '../entities/tiramis-api-key-audit.entity';
import { TiramisApiKeyEntity } from '../entities/tiramis-api-key.entity';
import { CreateTiramisApiKeyDto } from '../dto/create-tiramis-api-key.dto';
import { UpdateTiramisApiKeyDto } from '../dto/update-tiramis-api-key.dto';

export interface TiramisApiKeyAuthContext {
  ipAddress?: string | null;
  requestId?: string | null;
  method?: string | null;
  path?: string | null;
}

export interface TiramisApiKeyPrincipal {
  id: string;
  serviceName: string;
  allowedIps: string[];
  scopes: string[];
  tenantCompanyCode: string | null;
  tenantSystemCode: string | null;
  tenantEnvironment: 'test' | 'live' | null;
  clientConfigurationId: string | null;
}

@Injectable()
export class TiramisApiKeyService {
  constructor(
    @InjectRepository(TiramisApiKeyEntity)
    private readonly apiKeyRepository: Repository<TiramisApiKeyEntity>,
    @InjectRepository(TiramisApiKeyAuditEntity)
    private readonly auditRepository: Repository<TiramisApiKeyAuditEntity>,
  ) {}

  async create(
    dto: CreateTiramisApiKeyDto,
  ): Promise<TiramisApiKeyEntity & { apiKey: string }> {
    const active = await this.apiKeyRepository.findOne({
      where: {
        serviceName: dto.serviceName,
        systemKey: true,
        isActive: true,
        revokedAt: IsNull(),
      },
    });
    if (active) {
      throw new BadRequestException(
        'This system already has an active key. Rotate its existing key instead.',
      );
    }

    const apiKey = this.generateRawKey();
    const entity = this.apiKeyRepository.create({
      name: dto.name,
      serviceName: dto.serviceName,
      tenantCompanyCode: dto.tenantCompanyCode ?? null,
      tenantSystemCode: dto.tenantSystemCode ?? null,
      tenantEnvironment: dto.tenantEnvironment ?? null,
      clientConfigurationId: dto.clientConfigurationId ?? null,
      apiKey: null as unknown as string,
      apiKeyHash: this.hashApiKey(apiKey),
      systemKey: true,
      keyPrefix: apiKey.slice(0, 18),
      scopes: [...dto.scopes],
      allowedIps: this.normalizeAllowedIps(dto.allowedIps),
      description: dto.description ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: dto.isActive ?? true,
      revokedAt: null,
      lastUsedAt: null,
    });
    const saved = await this.apiKeyRepository.save(entity);
    await this.audit(saved, 'CREATED', 'SUCCESS', {
      allowedIps: saved.allowedIps,
      expiresAt: saved.expiresAt?.toISOString() ?? null,
    });
    return { ...this.redact(saved), apiKey };
  }

  async findAll(): Promise<TiramisApiKeyEntity[]> {
    const rows = await this.apiKeyRepository.find({
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.redact(row));
  }

  async findById(id: string): Promise<TiramisApiKeyEntity> {
    const row = await this.apiKeyRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('API key was not found.');
    return this.redact(row);
  }

  async update(id: string, dto: UpdateTiramisApiKeyDto) {
    const existing = await this.getExisting(id);
    await this.apiKeyRepository.update(id, {
      scopes: dto.scopes ?? existing.scopes ?? [],
      clientConfigurationId:
        dto.clientConfigurationId === undefined
          ? existing.clientConfigurationId
          : dto.clientConfigurationId,
      tenantCompanyCode:
        dto.tenantCompanyCode === undefined
          ? existing.tenantCompanyCode
          : dto.tenantCompanyCode,
      tenantSystemCode:
        dto.tenantSystemCode === undefined
          ? existing.tenantSystemCode
          : dto.tenantSystemCode,
      tenantEnvironment:
        dto.tenantEnvironment === undefined
          ? existing.tenantEnvironment
          : dto.tenantEnvironment,
      allowedIps: this.normalizeAllowedIps(
        dto.allowedIps ?? existing.allowedIps ?? [],
      ),
      description:
        dto.description === undefined ? existing.description : dto.description,
      expiresAt:
        dto.expiresAt === undefined
          ? existing.expiresAt
          : dto.expiresAt
            ? new Date(dto.expiresAt)
            : null,
    });
    await this.audit(existing, 'UPDATED', 'SUCCESS', {
      allowedIps: dto.allowedIps,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt,
    });
    return this.findById(id);
  }

  async activate(id: string) {
    const existing = await this.getExisting(id);
    if (existing.revokedAt) {
      throw new BadRequestException(
        'A revoked API key cannot be reactivated. Rotate the system key instead.',
      );
    }
    await this.apiKeyRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(TiramisApiKeyEntity);
      await repo.update(
        { serviceName: existing.serviceName, isActive: true },
        { isActive: false },
      );
      await repo.update(id, { isActive: true, systemKey: true });
    });
    await this.audit(existing, 'ACTIVATED', 'SUCCESS');
    return this.findById(id);
  }

  async disable(id: string) {
    const existing = await this.getExisting(id);
    await this.apiKeyRepository.update(id, { isActive: false });
    await this.audit(existing, 'DISABLED', 'SUCCESS');
    return this.findById(id);
  }

  async revoke(id: string) {
    const existing = await this.getExisting(id);
    await this.apiKeyRepository.update(id, {
      isActive: false,
      revokedAt: new Date(),
    });
    await this.audit(existing, 'REVOKED', 'SUCCESS');
  }

  /** Atomic replacement keeps one active key per system; the new secret is returned once. */
  async rotate(
    id: string,
    scopes?: string[],
  ): Promise<TiramisApiKeyEntity & { apiKey: string }> {
    const existing = await this.getExisting(id);
    if (existing.revokedAt) {
      throw new BadRequestException(
        'A revoked API key cannot be rotated. Create a new system key instead.',
      );
    }
    const apiKey = this.generateRawKey();
    await this.apiKeyRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(TiramisApiKeyEntity);
      await repo.update(
        { serviceName: existing.serviceName, isActive: true },
        { isActive: false },
      );
      await repo.update(id, {
        apiKey: null as unknown as string,
        apiKeyHash: this.hashApiKey(apiKey),
        keyPrefix: apiKey.slice(0, 18),
        systemKey: true,
        isActive: true,
        ...(scopes ? { scopes } : {}),
      });
    });
    await this.audit(existing, 'ROTATED', 'SUCCESS', {
      scopes: scopes ?? existing.scopes ?? [],
    });
    return { ...(await this.findById(id)), apiKey };
  }

  async rotateSystem(
    serviceName: string,
    scopes?: string[],
  ): Promise<TiramisApiKeyEntity & { apiKey: string }> {
    const existing = await this.apiKeyRepository.findOne({
      where: {
        serviceName,
        systemKey: true,
        isActive: true,
        revokedAt: IsNull(),
      },
      order: { updatedAt: 'DESC' },
    });
    if (!existing)
      throw new NotFoundException(
        'Active API key for this system was not found.',
      );
    return this.rotate(existing.id, scopes);
  }

  async validate(
    rawKey: string | undefined,
    requiredScopes: string[] = [],
    context: TiramisApiKeyAuthContext = {},
  ): Promise<TiramisApiKeyPrincipal> {
    if (!rawKey) {
      await this.audit(null, 'AUTHENTICATE', 'FAILED', {
        reason: 'MISSING',
        ...context,
      });
      throw new UnauthorizedException('Missing API key');
    }

    const hash = this.hashApiKey(rawKey);
    let row = await this.apiKeyRepository.findOne({
      where: { apiKeyHash: hash },
    });
    // Compatibility window: legacy raw keys remain valid until rotated/replaced.
    if (!row) {
      row = await this.apiKeyRepository.findOne({
        where: { apiKey: rawKey },
        select: [
          'id',
          'name',
          'apiKey',
          'keyPrefix',
          'serviceName',
          'allowedIps',
          'tenantCompanyCode',
          'tenantSystemCode',
          'tenantEnvironment',
          'clientConfigurationId',
          'scopes',
          'description',
          'isActive',
          'expiresAt',
          'lastUsedAt',
          'revokedAt',
          'createdAt',
          'updatedAt',
        ],
      });
    }
    if (
      !row ||
      !this.constantTimeEquals(
        row.apiKeyHash || row.apiKey || '',
        row.apiKeyHash ? hash : rawKey,
      )
    ) {
      await this.audit(null, 'AUTHENTICATE', 'FAILED', {
        reason: 'INVALID',
        keyPrefix: rawKey.slice(0, 18),
        ...context,
      });
      throw new UnauthorizedException('Invalid API key');
    }
    if (row.revokedAt || !row.isActive) {
      await this.audit(row, 'AUTHENTICATE', 'FAILED', {
        reason: row.revokedAt ? 'REVOKED' : 'DISABLED',
        ...context,
      });
      throw new ForbiddenException('API key is not active');
    }
    if (row.expiresAt && row.expiresAt <= new Date()) {
      await this.audit(row, 'AUTHENTICATE', 'FAILED', {
        reason: 'EXPIRED',
        ...context,
      });
      throw new ForbiddenException('API key has expired');
    }
    if (requiredScopes.includes('tiramis:admin')) {
      await this.audit(row, 'AUTHENTICATE', 'FAILED', {
        reason: 'ADMIN_LOGIN_REQUIRED',
        ...context,
      });
      throw new ForbiddenException(
        'Administrator login is required for this operation',
      );
    }
    const grantedScopes = row.scopes ?? [];
    const missingScopes = requiredScopes.filter(
      (scope) => !grantedScopes.includes(scope),
    );
    if (missingScopes.length) {
      await this.audit(row, 'AUTHENTICATE', 'FAILED', {
        reason: 'INSUFFICIENT_SCOPE',
        requiredScopes,
        missingScopes,
        ...context,
      });
      throw new ForbiddenException('API key does not have required scope');
    }
    const allowedIps = this.normalizeAllowedIps(row.allowedIps ?? []);
    if (
      !context.ipAddress ||
      !allowedIps.includes(this.normalizeIp(context.ipAddress))
    ) {
      await this.audit(row, 'AUTHENTICATE', 'FAILED', {
        reason: 'IP_NOT_ALLOWED',
        ...context,
      });
      throw new ForbiddenException(
        'API key is not allowed from this IP address',
      );
    }

    await this.apiKeyRepository.update(row.id, { lastUsedAt: new Date() });
    await this.audit(row, 'AUTHENTICATE', 'SUCCESS', context as any);
    return {
      id: row.id,
      serviceName: row.serviceName,
      allowedIps,
      scopes: grantedScopes,
      tenantCompanyCode: row.tenantCompanyCode ?? null,
      tenantSystemCode: row.tenantSystemCode ?? null,
      tenantEnvironment: this.normalizeTenantEnvironment(row.tenantEnvironment),
      clientConfigurationId: row.clientConfigurationId ?? null,
    };
  }

  async listAudit(apiKeyId: string) {
    return this.auditRepository.find({
      where: { apiKeyId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  private async getExisting(id: string) {
    const existing = await this.apiKeyRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('API key was not found.');
    return existing;
  }

  private async audit(
    apiKey: Pick<TiramisApiKeyEntity, 'id' | 'serviceName'> | null,
    action: string,
    outcome: string,
    metadata: Record<string, unknown> = {},
  ) {
    await this.auditRepository.save(
      this.auditRepository.create({
        apiKeyId: apiKey?.id ?? null,
        action,
        outcome,
        serviceName: apiKey?.serviceName ?? null,
        requestId:
          typeof metadata.requestId === 'string' ? metadata.requestId : null,
        ipAddress:
          typeof metadata.ipAddress === 'string' ? metadata.ipAddress : null,
        metadata,
      }),
    );
  }

  private generateRawKey(): string {
    return `tms_${randomBytes(32).toString('base64url')}`;
  }

  private hashApiKey(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private constantTimeEquals(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private normalizeAllowedIps(values: string[]): string[] {
    return [...new Set(values.map((value) => this.normalizeIp(value)))];
  }

  private normalizeIp(value: string): string {
    const trimmed = value.trim().toLowerCase();
    return trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
  }

  private normalizeTenantEnvironment(value: string | null | undefined) {
    return value === 'test' || value === 'live' ? value : null;
  }

  private redact(entity: TiramisApiKeyEntity): TiramisApiKeyEntity {
    return {
      ...entity,
      apiKey: undefined as unknown as string,
      apiKeyHash: undefined as unknown as string,
    };
  }
}
