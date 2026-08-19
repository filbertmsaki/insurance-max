import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';

import { TiramisApiKeyAuditEntity } from '../entities/tiramis-api-key-audit.entity';
import { TiramisApiKeyEntity } from '../entities/tiramis-api-key.entity';
import { CreateTiramisApiKeyDto } from '../dto/create-tiramis-api-key.dto';
import { UpdateTiramisApiKeyDto } from '../dto/update-tiramis-api-key.dto';
import { TiramisClientConfigurationEntity } from '../../config/entities/tiramis-client-configuration.entity';

export interface TiramisApiKeyAuthContext {
  ipAddress?: string | null;
  requestId?: string | null;
  method?: string | null;
  path?: string | null;
}

export interface TiramisApiKeyPrincipal {
  id: string;
  serviceName: string;
  scopes: string[];
  tenantCompanyCode?: string | null;
  tenantSystemCode?: string | null;
  tenantEnvironment?: string | null;
  clientConfigurationId?: string | null;
}

@Injectable()
export class TiramisApiKeyService {
  constructor(
    @InjectRepository(TiramisApiKeyEntity)
    private readonly apiKeyRepository: Repository<TiramisApiKeyEntity>,
    @InjectRepository(TiramisApiKeyAuditEntity)
    private readonly auditRepository: Repository<TiramisApiKeyAuditEntity>,
    @InjectRepository(TiramisClientConfigurationEntity)
    private readonly clientConfigurationRepository: Repository<TiramisClientConfigurationEntity>,
  ) {}

  async create(
    dto: CreateTiramisApiKeyDto,
  ): Promise<TiramisApiKeyEntity & { apiKey: string }> {
    const clientConfigurationId = await this.resolveClientConfigurationId({
      tenantCompanyCode: dto.tenantCompanyCode ?? null,
      tenantSystemCode: dto.tenantSystemCode ?? null,
      tenantEnvironment: dto.tenantEnvironment ?? null,
    });

    const apiKey = this.generateRawKey();
    const entity = this.apiKeyRepository.create({
      name: dto.name,
      serviceName: dto.serviceName,
      tenantCompanyCode: dto.tenantCompanyCode ?? null,
      tenantSystemCode: dto.tenantSystemCode ?? null,
      tenantEnvironment: dto.tenantEnvironment ?? null,
      clientConfigurationId,
      apiKey,
      keyPrefix: apiKey.slice(0, 18),
      scopes: dto.scopes ?? [],
      description: dto.description ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: dto.isActive ?? true,
      revokedAt: null,
      lastUsedAt: null,
    });

    const saved = await this.apiKeyRepository.save(entity);
    await this.audit(saved, 'CREATED', 'SUCCESS', {
      scopes: saved.scopes ?? [],
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
    if (!row) {
      throw new NotFoundException('API key was not found.');
    }
    return this.redact(row);
  }

  async update(id: string, dto: UpdateTiramisApiKeyDto) {
    const existing = await this.getExisting(id);

    const tenantCompanyCode =
      dto.tenantCompanyCode === undefined
        ? existing.tenantCompanyCode
        : dto.tenantCompanyCode;
    const tenantSystemCode =
      dto.tenantSystemCode === undefined
        ? existing.tenantSystemCode
        : dto.tenantSystemCode;
    const tenantEnvironment =
      dto.tenantEnvironment === undefined
        ? existing.tenantEnvironment
        : dto.tenantEnvironment;

    const tenantChanged =
      tenantCompanyCode !== existing.tenantCompanyCode ||
      tenantSystemCode !== existing.tenantSystemCode ||
      tenantEnvironment !== existing.tenantEnvironment;

    const clientConfigurationId = tenantChanged
      ? await this.resolveClientConfigurationId({
          tenantCompanyCode,
          tenantSystemCode,
          tenantEnvironment,
        })
      : existing.clientConfigurationId;

    await this.apiKeyRepository.update(id, {
      name: dto.name ?? existing.name,
      serviceName: dto.serviceName ?? existing.serviceName,
      tenantCompanyCode,
      tenantSystemCode,
      tenantEnvironment,
      clientConfigurationId,
      scopes: dto.scopes ?? existing.scopes,
      description:
        dto.description === undefined ? existing.description : dto.description,
      expiresAt:
        dto.expiresAt === undefined
          ? existing.expiresAt
          : dto.expiresAt
            ? new Date(dto.expiresAt)
            : null,
      isActive: dto.isActive ?? existing.isActive,
    });

    await this.audit(existing, 'UPDATED', 'SUCCESS', dto as any);
    return this.findById(id);
  }

  async activate(id: string) {
    const existing = await this.getExisting(id);
    await this.apiKeyRepository.update(id, {
      isActive: true,
      revokedAt: null,
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

  async rotate(id: string): Promise<TiramisApiKeyEntity & { apiKey: string }> {
    const existing = await this.getExisting(id);
    const apiKey = this.generateRawKey();
    await this.apiKeyRepository.update(id, {
      apiKey,
      keyPrefix: apiKey.slice(0, 18),
      revokedAt: null,
      isActive: true,
    });
    await this.audit(existing, 'ROTATED', 'SUCCESS');
    return { ...(await this.findById(id)), apiKey };
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

    const row = await this.apiKeyRepository.findOne({
      where: { apiKey: rawKey },
      select: {
        id: true,
        name: true,
        apiKey: true,
        keyPrefix: true,
        serviceName: true,
        tenantCompanyCode: true,
        tenantSystemCode: true,
        tenantEnvironment: true,
        clientConfigurationId: true,
        scopes: true,
        description: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row || !this.constantTimeEquals(row.apiKey, rawKey)) {
      await this.audit(null, 'AUTHENTICATE', 'FAILED', {
        reason: 'INVALID',
        keyPrefix: rawKey.slice(0, 18),
        ...context,
      });
      throw new UnauthorizedException('Invalid API key');
    }

    if (row.revokedAt) {
      await this.audit(row, 'AUTHENTICATE', 'FAILED', {
        reason: 'REVOKED',
        ...context,
      });
      throw new ForbiddenException('API key has been revoked');
    }

    if (!row.isActive) {
      await this.audit(row, 'AUTHENTICATE', 'FAILED', {
        reason: 'DISABLED',
        ...context,
      });
      throw new ForbiddenException('API key is disabled');
    }

    if (row.expiresAt && row.expiresAt <= new Date()) {
      await this.audit(row, 'AUTHENTICATE', 'FAILED', {
        reason: 'EXPIRED',
        ...context,
      });
      throw new ForbiddenException('API key has expired');
    }

    const scopes = row.scopes ?? [];

    if (requiredScopes.length) {
      const missingScopes = requiredScopes.filter(
        (scope) => !scopes.includes(scope),
      );

      if (missingScopes.length) {
        await this.audit(row, 'AUTHENTICATE', 'FAILED', {
          reason: 'MISSING_SCOPE',
          missingScopes,
          ...context,
        });
        throw new ForbiddenException('API key is missing required scopes');
      }
    }

    await this.apiKeyRepository.update(row.id, { lastUsedAt: new Date() });
    await this.audit(row, 'AUTHENTICATE', 'SUCCESS', context as any);

    return {
      id: row.id,
      serviceName: row.serviceName,
      scopes,
      tenantCompanyCode: row.tenantCompanyCode,
      tenantSystemCode: row.tenantSystemCode,
      tenantEnvironment: row.tenantEnvironment,
      clientConfigurationId: row.clientConfigurationId,
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
    const existing = await this.apiKeyRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        apiKey: true,
        keyPrefix: true,
        serviceName: true,
        tenantCompanyCode: true,
        tenantSystemCode: true,
        tenantEnvironment: true,
        clientConfigurationId: true,
        scopes: true,
        description: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('API key was not found.');
    }
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

  /**
   * Resolves the ClientConfiguration an API key's tenant fields should be
   * bound to, at key-creation/update time rather than leaving it to be
   * discovered (or silently unmatched) at first request time. Fails fast
   * if a tenant triple is provided but doesn't correspond to any active
   * configuration — a key that will never resolve a configuration should
   * never be minted in the first place.
   */
  private async resolveClientConfigurationId(tenant: {
    tenantCompanyCode: string | null;
    tenantSystemCode: string | null;
    tenantEnvironment: string | null;
  }): Promise<string | null> {
    const { tenantCompanyCode, tenantSystemCode, tenantEnvironment } = tenant;

    if (!tenantCompanyCode && !tenantSystemCode && !tenantEnvironment) {
      return null;
    }

    if (!tenantCompanyCode || !tenantSystemCode || !tenantEnvironment) {
      throw new BadRequestException({
        code: 'TIRAMIS_ORGANIZATION_CONTEXT_REQUIRED',
        message:
          'tenantCompanyCode, tenantSystemCode, and tenantEnvironment must all be provided together.',
      });
    }

    const configuration = await this.clientConfigurationRepository.findOne({
      where: {
        companyCode: tenantCompanyCode,
        systemCode: tenantSystemCode,
        environment: tenantEnvironment,
        isActive: 1,
      },
    });

    if (!configuration) {
      throw new NotFoundException({
        code: 'TIRAMIS_CLIENT_CONFIGURATION_NOT_FOUND',
        message:
          'No active TIRAMIS client configuration matches the supplied company, system, and environment.',
        details: { tenantCompanyCode, tenantSystemCode, tenantEnvironment },
      });
    }

    return configuration.id;
  }

  private generateRawKey(): string {
    return `tms_${randomBytes(32).toString('base64url')}`;
  }

  private constantTimeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private redact(entity: TiramisApiKeyEntity): TiramisApiKeyEntity {
    return { ...entity, apiKey: undefined as unknown as string };
  }
}
