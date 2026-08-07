import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiClientsService } from '../api-clients.service';
import { ApiClient } from '../entities/api-client.entity';

declare module 'express' {
  interface Request {
    apiClient?: ApiClient;
  }
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiClientsService: ApiClientsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey) throw new UnauthorizedException('API key is required');

    const parts = apiKey.split('.');
    if (parts.length !== 2)
      throw new UnauthorizedException('Invalid API key format');

    const [clientId, clientSecret] = parts;
    const requiredScopes =
      this.reflector.getAllAndMerge<string[]>('api-client-scopes', [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const client = await this.apiClientsService.validateApiKey(
      clientId,
      clientSecret,
      {
        ipAddress: request.ip,
        method: request.method,
        requestPath: request.originalUrl ?? request.url,
        requestId:
          (request.headers['x-request-id'] as string | undefined) ?? undefined,
        userAgent: request.get('user-agent') ?? undefined,
        requiredScopes,
      },
    );
    request.apiClient = client;

    return true;
  }
}
