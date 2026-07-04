import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiClient } from './entities/api-client.entity';
import {
  hashPassword,
  comparePasswords,
} from '@insurance-max/portal-shared/utils/hash.util';

interface CreateApiClientInput {
  name: string;
  companyId?: string;
  scopes?: string[];
  description?: string;
  expiresAt?: Date;
}

interface ApiKeyCredentials {
  clientId: string;
  clientSecret: string;
  displaySecret: string;
}

@Injectable()
export class ApiClientsService {
  constructor(
    @InjectRepository(ApiClient)
    private readonly apiClientRepo: Repository<ApiClient>,
  ) {}

  async create(
    input: CreateApiClientInput,
  ): Promise<ApiClient & { plainSecret: string }> {
    const { clientId, clientSecret, displaySecret } =
      this.generateCredentials();
    const secretHash = await hashPassword(clientSecret);

    const client = this.apiClientRepo.create({
      name: input.name,
      company_id: input.companyId ?? null,
      client_id: clientId,
      client_secret_hash: secretHash,
      scopes: input.scopes ?? [],
      description: input.description ?? null,
      expires_at: input.expiresAt ?? null,
    });

    const saved = await this.apiClientRepo.save(client);

    return {
      ...saved,
      client_secret_hash: '[redacted]',
      plainSecret: displaySecret,
    };
  }

  async validateApiKey(
    clientId: string,
    clientSecret: string,
  ): Promise<ApiClient> {
    const client = await this.apiClientRepo.findOne({
      where: { client_id: clientId, status: 'active' },
      select: {
        id: true,
        client_id: true,
        company_id: true,
        name: true,
        scopes: true,
        status: true,
        expires_at: true,
        client_secret_hash: true,
      },
    });

    if (!client) throw new UnauthorizedException('Invalid API credentials');

    if (client.expires_at && new Date() > client.expires_at) {
      throw new UnauthorizedException('API key has expired');
    }

    const valid = await comparePasswords(
      clientSecret,
      client.client_secret_hash,
    );
    if (!valid) throw new UnauthorizedException('Invalid API credentials');

    await this.apiClientRepo.update(client.id, { last_used_at: new Date() });

    return client;
  }

  async findAll(companyId?: string): Promise<ApiClient[]> {
    const qb = this.apiClientRepo.createQueryBuilder('ac');
    if (companyId) qb.andWhere('ac.company_id = :companyId', { companyId });
    return qb.orderBy('ac.created_at', 'DESC').getMany();
  }

  async findById(id: string, companyId?: string): Promise<ApiClient> {
    const client = await this.apiClientRepo.findOne({
      where: companyId ? { id, company_id: companyId } : { id },
    });
    if (!client) throw new NotFoundException('API client not found');
    return client;
  }

  async revoke(id: string, companyId?: string): Promise<void> {
    const client = await this.findById(id, companyId);
    await this.apiClientRepo.update(client.id, { status: 'revoked' });
  }

  async rotateSecret(
    id: string,
    companyId?: string,
  ): Promise<{ plainSecret: string }> {
    await this.findById(id, companyId);
    const { clientSecret, displaySecret } = this.generateCredentials();
    const secretHash = await hashPassword(clientSecret);
    await this.apiClientRepo.update(id, { client_secret_hash: secretHash });
    return { plainSecret: displaySecret };
  }

  private generateCredentials(): ApiKeyCredentials {
    const clientId = `iam_${crypto.randomBytes(12).toString('hex')}`;
    const clientSecret = crypto.randomBytes(32).toString('hex');
    const displaySecret = `${clientId}.${clientSecret}`;
    return { clientId, clientSecret, displaySecret };
  }
}
