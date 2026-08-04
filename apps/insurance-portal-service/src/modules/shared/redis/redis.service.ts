import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private readonly logger = new Logger(RedisService.name);
  private readonly fallbackStore = new Map<
    string,
    { value: string; expiresAt?: number }
  >();
  private readonly fallbackHashes = new Map<string, Map<string, string>>();
  private readonly fallbackSets = new Map<string, Set<string>>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string | undefined>(
      'redis.password',
    );
    const db = this.configService.get<number>('redis.db', 0);

    const client = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    client.on('connect', () => this.logger.log('Redis connected'));
    client.on('error', (err) =>
      this.logger.warn(
        `Redis unavailable, using in-memory fallback: ${err.message}`,
      ),
    );
    client.on('close', () => this.logger.warn('Redis connection closed'));

    try {
      await client.connect();
      this.client = client;
    } catch (error) {
      this.logger.warn(
        'Redis startup connection failed. Falling back to in-memory storage.',
      );
      this.client = null;
      await client.disconnect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis disconnected');
    }
  }

  private purgeIfExpired(key: string) {
    const entry = this.fallbackStore.get(key);
    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
      this.fallbackStore.delete(key);
      return null;
    }
    return entry ?? null;
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      return this.client.get(key);
    }

    return this.purgeIfExpired(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client) {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return;
    }

    this.fallbackStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(key);
      return;
    }

    this.fallbackStore.delete(key);
    this.fallbackHashes.delete(key);
    this.fallbackSets.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.client) {
      const count = await this.client.exists(key);
      return count > 0;
    }

    return this.purgeIfExpired(key) !== null;
  }

  async ttl(key: string): Promise<number> {
    if (this.client) {
      return this.client.ttl(key);
    }

    const entry = this.purgeIfExpired(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async incr(key: string): Promise<number> {
    if (this.client) {
      return this.client.incr(key);
    }

    const current = Number((await this.get(key)) ?? '0') + 1;
    const entry = this.purgeIfExpired(key);
    this.fallbackStore.set(key, {
      value: String(current),
      expiresAt: entry?.expiresAt,
    });
    return current;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.client) {
      await this.client.expire(key, ttlSeconds);
      return;
    }

    const entry = this.purgeIfExpired(key);
    if (!entry) return;
    this.fallbackStore.set(key, {
      value: entry.value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    if (this.client) {
      await this.client.hset(key, field, value);
      return;
    }

    const hash = this.fallbackHashes.get(key) ?? new Map<string, string>();
    hash.set(field, value);
    this.fallbackHashes.set(key, hash);
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (this.client) {
      return this.client.hget(key, field);
    }

    return this.fallbackHashes.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (this.client) {
      return this.client.hgetall(key);
    }

    return Object.fromEntries(this.fallbackHashes.get(key)?.entries() ?? []);
  }

  async hdel(key: string, field: string): Promise<void> {
    if (this.client) {
      await this.client.hdel(key, field);
      return;
    }

    this.fallbackHashes.get(key)?.delete(field);
  }

  async sadd(key: string, member: string): Promise<void> {
    if (this.client) {
      await this.client.sadd(key, member);
      return;
    }

    const set = this.fallbackSets.get(key) ?? new Set<string>();
    set.add(member);
    this.fallbackSets.set(key, set);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    if (this.client) {
      const result = await this.client.sismember(key, member);
      return result === 1;
    }

    return this.fallbackSets.get(key)?.has(member) ?? false;
  }

  async srem(key: string, member: string): Promise<void> {
    if (this.client) {
      await this.client.srem(key, member);
      return;
    }

    this.fallbackSets.get(key)?.delete(member);
  }

  async addToBlacklist(token: string, ttlSeconds: number): Promise<void> {
    await this.set(`blacklist:${token}`, '1', ttlSeconds);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    return this.exists(`blacklist:${token}`);
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async healthCheck(): Promise<{
    available: boolean;
    mode: 'redis' | 'memory';
    latencyMs: number;
    message?: string;
  }> {
    const startedAt = Date.now();

    if (!this.client) {
      return {
        available: false,
        mode: 'memory',
        latencyMs: Date.now() - startedAt,
        message: 'Redis is unavailable; in-memory fallback is active.',
      };
    }

    try {
      const result = await this.client.ping();

      return {
        available: result === 'PONG',
        mode: 'redis',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        available: false,
        mode: 'memory',
        latencyMs: Date.now() - startedAt,
        message:
          error instanceof Error ? error.message : 'Redis health check failed.',
      };
    }
  }

  isUsingFallback(): boolean {
    return this.client === null;
  }
}
