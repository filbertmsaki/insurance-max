import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { BlockList, isIP } from 'node:net';
import {
  ApiClientStatus,
  ApiClientType,
  DeploymentEnvironment,
} from '@insurance-max/contracts';

import { SubscriptionLimitService } from '../saas-billing/services/subscription-limit.service';
import { ApiClientUsageEvent } from './entities/api-client-usage-event.entity';
import { ApiClient } from './entities/api-client.entity';
import {
  comparePasswords,
  hashPassword,
} from '@insurance-max/portal-shared/utils/hash.util';

interface CreateApiClientInput {
  name: string;
  companyId?: string;
  ownerUserId?: string;
  scopes?: string[];
  description?: string;
  expiresAt?: Date;
  clientType?: ApiClientType;
  environment?: DeploymentEnvironment;
  ipWhitelist?: string[];
  rateLimitPerMinute?: number;
}

interface ApiKeyValidationContext {
  ipAddress?: string;
  method?: string;
  requestPath?: string;
  requestId?: string;
  userAgent?: string;
  requiredScopes?: string[];
}

interface ApiKeyCredentials {
  clientId: string;
  clientSecret: string;
  displaySecret: string;
  keyPrefix: string;
}

@Injectable()
export class ApiClientsService {
  constructor(
    @InjectRepository(ApiClient)
    private readonly apiClientRepo: Repository<ApiClient>,
    @InjectRepository(ApiClientUsageEvent)
    private readonly usageEventRepo: Repository<ApiClientUsageEvent>,
    private readonly configService: ConfigService,
    private readonly subscriptionLimitService: SubscriptionLimitService,
  ) {}

  async create(
    input: CreateApiClientInput,
  ): Promise<ApiClient & { plainSecret: string }> {
    if (!this.configService.get<boolean>('API_KEYS_ENABLED', true)) {
      throw new ConflictException('API keys are disabled');
    }

    if (input.companyId) {
      await this.subscriptionLimitService.assertCapacity(
        input.companyId,
        'api_clients.max',
      );
    }

    this.assertIpPolicy(input.ipWhitelist);
    this.assertExpiryWindow(input.expiresAt);

    const { clientId, clientSecret, displaySecret, keyPrefix } =
      this.generateCredentials();
    const secretHash = await hashPassword(clientSecret);
    const defaultRateLimit = this.configService.get<number>(
      'API_KEY_DEFAULT_RATE_LIMIT_PER_MINUTE',
      60,
    );

    const client = this.apiClientRepo.create({
      name: input.name,
      company_id: input.companyId ?? null,
      owner_user_id: input.ownerUserId ?? null,
      client_id: clientId,
      key_prefix: keyPrefix,
      client_secret_hash: secretHash,
      previous_secret_hash: null,
      previous_secret_valid_until: null,
      scopes: input.scopes ?? [],
      description: input.description ?? null,
      status: ApiClientStatus.ACTIVE,
      client_type: input.clientType ?? ApiClientType.TENANT_INTEGRATION,
      environment: input.environment ?? DeploymentEnvironment.PRODUCTION,
      ip_whitelist: input.ipWhitelist ?? [],
      rate_limit_per_minute: input.rateLimitPerMinute ?? defaultRateLimit,
      expires_at: input.expiresAt ?? null,
    });

    const saved = await this.apiClientRepo.save(client);
    await this.recordUsageEvent(saved, 'CREATED', {
      metadata: {
        scopes: saved.scopes,
        client_type: saved.client_type,
        environment: saved.environment,
      },
    });

    return {
      ...saved,
      client_secret_hash: '[redacted]',
      previous_secret_hash: null,
      plainSecret: displaySecret,
    };
  }

  async validateApiKey(
    clientId: string,
    clientSecret: string,
    context: ApiKeyValidationContext = {},
  ): Promise<ApiClient> {
    if (!this.configService.get<boolean>('API_KEYS_ENABLED', true)) {
      throw new UnauthorizedException('API keys are disabled');
    }

    const client = await this.apiClientRepo.findOne({
      where: { client_id: clientId },
      select: {
        id: true,
        client_id: true,
        company_id: true,
        owner_user_id: true,
        name: true,
        key_prefix: true,
        scopes: true,
        status: true,
        client_type: true,
        environment: true,
        ip_whitelist: true,
        rate_limit_per_minute: true,
        last_used_at: true,
        last_used_ip: true,
        last_used_user_agent: true,
        usage_count: true,
        expires_at: true,
        client_secret_hash: true,
        previous_secret_hash: true,
        previous_secret_valid_until: true,
        rotated_at: true,
        compromised_at: true,
        revoked_reason: true,
        description: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!client) {
      throw new UnauthorizedException('Invalid API credentials');
    }

    const now = new Date();
    const normalizedStatus = client.status?.toUpperCase?.() as ApiClientStatus;
    if (
      [
        ApiClientStatus.REVOKED,
        ApiClientStatus.SUSPENDED,
        ApiClientStatus.COMPROMISED,
      ].includes(normalizedStatus)
    ) {
      await this.recordUsageEvent(client, 'REJECTED', {
        ...context,
        metadata: { reason: normalizedStatus },
      });
      throw new UnauthorizedException('API key is not active');
    }

    if (client.expires_at && now > client.expires_at) {
      await this.apiClientRepo.update(client.id, {
        status: ApiClientStatus.EXPIRED,
      });
      await this.recordUsageEvent(client, 'REJECTED', {
        ...context,
        metadata: { reason: 'EXPIRED' },
      });
      throw new UnauthorizedException('API key has expired');
    }

    if (!this.isRequestIpAllowed(client, context.ipAddress)) {
      await this.recordUsageEvent(client, 'REJECTED', {
        ...context,
        metadata: { reason: 'IP_NOT_ALLOWED' },
      });
      throw new UnauthorizedException('API key is not allowed from this IP');
    }

    if (client.rate_limit_per_minute) {
      const windowStart = new Date(now.getTime() - 60_000);
      const recentCount = await this.usageEventRepo.count({
        where: {
          api_client_id: client.id,
          outcome: 'SUCCESS',
          created_at: MoreThanOrEqual(windowStart),
        },
      });

      if (recentCount >= client.rate_limit_per_minute) {
        await this.recordUsageEvent(client, 'RATE_LIMITED', {
          ...context,
          metadata: { limit: client.rate_limit_per_minute },
        });
        throw new UnauthorizedException('API key rate limit exceeded');
      }
    }

    const validCurrent = await comparePasswords(
      clientSecret,
      client.client_secret_hash,
    );

    let validPrevious = false;
    if (
      !validCurrent &&
      client.previous_secret_hash &&
      client.previous_secret_valid_until &&
      client.previous_secret_valid_until > now
    ) {
      validPrevious = await comparePasswords(
        clientSecret,
        client.previous_secret_hash,
      );
    }

    if (!validCurrent && !validPrevious) {
      await this.recordUsageEvent(client, 'REJECTED', {
        ...context,
        metadata: { reason: 'SECRET_MISMATCH' },
      });
      throw new UnauthorizedException('Invalid API credentials');
    }

    if (context.requiredScopes?.length) {
      const missingScopes = context.requiredScopes.filter(
        (scope) => !client.scopes.includes(scope),
      );

      if (missingScopes.length) {
        await this.recordUsageEvent(client, 'REJECTED', {
          ...context,
          metadata: { reason: 'MISSING_SCOPE', missingScopes },
        });
        throw new UnauthorizedException('API key is missing required scopes');
      }
    }

    const nextStatus =
      validPrevious &&
      client.previous_secret_valid_until &&
      client.previous_secret_valid_until > now
        ? ApiClientStatus.ROTATING
        : ApiClientStatus.ACTIVE;

    await this.apiClientRepo.update(client.id, {
      last_used_at: now,
      last_used_ip: context.ipAddress ?? null,
      last_used_user_agent: context.userAgent ?? null,
      usage_count: String(Number(client.usage_count ?? '0') + 1),
      status: nextStatus,
    });

    await this.recordUsageEvent(client, 'SUCCESS', {
      ...context,
      metadata: { using_previous_secret: validPrevious },
    });

    client.status = nextStatus;
    client.last_used_at = now;
    client.last_used_ip = context.ipAddress ?? null;
    client.last_used_user_agent = context.userAgent ?? null;
    client.usage_count = String(Number(client.usage_count ?? '0') + 1);

    return client;
  }

  async findAll(companyId?: string): Promise<ApiClient[]> {
    const qb = this.apiClientRepo.createQueryBuilder('ac');
    if (companyId) {
      qb.andWhere('ac.company_id = :companyId', { companyId });
    }
    return qb.orderBy('ac.created_at', 'DESC').getMany();
  }

  async findById(id: string, companyId?: string): Promise<ApiClient> {
    const client = await this.apiClientRepo.findOne({
      where: companyId ? { id, company_id: companyId } : { id },
    });
    if (!client) throw new NotFoundException('API client not found');
    return client;
  }

  async listUsageEvents(id: string, companyId?: string) {
    const client = await this.findById(id, companyId);
    return this.usageEventRepo.find({
      where: { api_client_id: client.id },
      order: { created_at: 'DESC' },
      take: 200,
    });
  }

  async update(
    id: string,
    companyId: string | undefined,
    dto: {
      scopes?: string[];
      description?: string;
      ip_whitelist?: string[];
      rate_limit_per_minute?: number | null;
      status?: string;
    },
  ) {
    const client = await this.findById(id, companyId);
    const nextStatus = dto.status?.toUpperCase?.() as
      | ApiClientStatus
      | undefined;

    if (
      nextStatus &&
      !Object.values(ApiClientStatus).includes(nextStatus)
    ) {
      throw new ConflictException('Unsupported API client status.');
    }

    this.assertIpPolicy(dto.ip_whitelist ?? client.ip_whitelist);

    await this.apiClientRepo.update(client.id, {
      scopes: dto.scopes ?? client.scopes,
      description: dto.description ?? client.description,
      ip_whitelist: dto.ip_whitelist ?? client.ip_whitelist,
      rate_limit_per_minute:
        dto.rate_limit_per_minute === undefined
          ? client.rate_limit_per_minute
          : dto.rate_limit_per_minute,
      status: nextStatus ?? client.status,
    });

    return this.findById(client.id, companyId);
  }

  async revoke(
    id: string,
    companyId?: string,
    reason?: string,
  ): Promise<void> {
    const client = await this.findById(id, companyId);
    await this.apiClientRepo.update(client.id, {
      status: ApiClientStatus.REVOKED,
      revoked_reason: reason ?? null,
    });
    await this.recordUsageEvent(client, 'REVOKED', {
      metadata: { reason: reason ?? null },
    });
  }

  async rotateSecret(
    id: string,
    rotatedBy: string,
    companyId?: string,
  ): Promise<{ plainSecret: string; previousSecretGraceEndsAt: Date }> {
    const client = await this.apiClientRepo.findOne({
      where: companyId ? { id, company_id: companyId } : { id },
      select: {
        id: true,
        company_id: true,
        key_prefix: true,
        client_secret_hash: true,
      },
    });
    if (!client) {
      throw new NotFoundException('API client not found');
    }

    const { clientSecret, displaySecret } = this.generateCredentials(client.key_prefix);
    const secretHash = await hashPassword(clientSecret);
    const graceHours = this.configService.get<number>(
      'API_KEY_ROTATION_GRACE_HOURS',
      24,
    );
    const previousSecretGraceEndsAt = new Date(
      Date.now() + graceHours * 60 * 60 * 1000,
    );

    await this.apiClientRepo.update(id, {
      previous_secret_hash: client.client_secret_hash,
      previous_secret_valid_until: previousSecretGraceEndsAt,
      client_secret_hash: secretHash,
      rotated_at: new Date(),
      status: ApiClientStatus.ROTATING,
    });

    await this.recordUsageEvent(client, 'ROTATED', {
      metadata: { rotated_by: rotatedBy },
    });

    return { plainSecret: displaySecret, previousSecretGraceEndsAt };
  }

  private generateCredentials(existingPrefix?: string | null): ApiKeyCredentials {
    const clientId = `iam_${crypto.randomBytes(12).toString('hex')}`;
    const clientSecret = crypto.randomBytes(32).toString('hex');
    const keyPrefix =
      existingPrefix ?? `IMX_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const displaySecret = `${clientId}.${clientSecret}`;
    return { clientId, clientSecret, displaySecret, keyPrefix };
  }

  private async recordUsageEvent(
    client: Pick<ApiClient, 'id' | 'company_id'>,
    outcome: string,
    context: {
      ipAddress?: string;
      method?: string;
      requestPath?: string;
      requestId?: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ) {
    await this.usageEventRepo.save(
      this.usageEventRepo.create({
        api_client_id: client.id,
        company_id: client.company_id ?? null,
        outcome,
        ip_address: context.ipAddress ?? null,
        method: context.method ?? null,
        request_path: context.requestPath ?? null,
        metadata: {
          ...(context.metadata ?? {}),
          request_id: context.requestId ?? null,
          user_agent: context.userAgent ?? null,
        },
      }),
    );
  }

  private assertIpPolicy(ipWhitelist?: string[]): void {
    const maxIps = this.configService.get<number>('API_KEY_MAX_IPS_PER_KEY', 1);
    const requireIpAllowlist = this.configService.get<boolean>(
      'API_KEY_REQUIRE_IP_ALLOWLIST',
      true,
    );

    if (requireIpAllowlist && (!ipWhitelist || ipWhitelist.length === 0)) {
      throw new BadRequestException(
        'At least one IP allowlist entry is required for this API key',
      );
    }

    if (ipWhitelist && ipWhitelist.length > maxIps) {
      throw new BadRequestException(
        `API keys may only contain ${maxIps} approved IP address entries`,
      );
    }
  }

  private assertExpiryWindow(expiresAt?: Date): void {
    if (!expiresAt) {
      return;
    }

    const maxValidityDays = this.configService.get<number>(
      'API_KEY_MAX_VALIDITY_DAYS',
      365,
    );
    const maxExpiry = new Date(
      Date.now() + maxValidityDays * 24 * 60 * 60 * 1000,
    );

    if (expiresAt > maxExpiry) {
      throw new BadRequestException(
        `API key validity cannot exceed ${maxValidityDays} days`,
      );
    }
  }

  private isRequestIpAllowed(
    client: Pick<ApiClient, 'ip_whitelist'>,
    ipAddress?: string,
  ): boolean {
    if (!client.ip_whitelist?.length) {
      return true;
    }

    if (!ipAddress) {
      return false;
    }

    const normalizedIp = this.normalizeIp(ipAddress);
    if (!normalizedIp || !isIP(normalizedIp)) {
      return false;
    }

    return client.ip_whitelist.some((rule) =>
      this.matchesIpRule(normalizedIp, rule),
    );
  }

  private matchesIpRule(ipAddress: string, rule: string): boolean {
    const normalizedRule = this.normalizeIp(rule.trim());
    if (!normalizedRule) {
      return false;
    }

    if (!normalizedRule.includes('/')) {
      return normalizedRule === ipAddress;
    }

    const [networkAddress, prefixValue] = normalizedRule.split('/');
    const prefix = Number(prefixValue);
    const ipType = isIP(networkAddress);
    if (!ipType || !Number.isInteger(prefix)) {
      return false;
    }

    const blockList = new BlockList();
    blockList.addSubnet(networkAddress, prefix, ipType === 6 ? 'ipv6' : 'ipv4');
    return blockList.check(ipAddress, ipType === 6 ? 'ipv6' : 'ipv4');
  }

  private normalizeIp(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    return value.startsWith('::ffff:') ? value.slice(7) : value;
  }
}
