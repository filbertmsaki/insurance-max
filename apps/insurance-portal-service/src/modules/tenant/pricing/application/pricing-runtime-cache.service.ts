import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service';

type PricingCacheVersionFamily = 'product' | 'rate' | 'tax';

@Injectable()
export class PricingRuntimeCacheService {
  private readonly defaultTtlSeconds = 300;
  private readonly inFlightLoads = new Map<string, Promise<unknown>>();

  constructor(private readonly redisService: RedisService) {}

  async getConfigurationSignature(
    companyId: string,
    families: PricingCacheVersionFamily[],
  ): Promise<string> {
    const uniqueFamilies = [...new Set(families)].sort();
    const versions = await Promise.all(
      uniqueFamilies.map(
        async (family) =>
          [family, await this.readVersion(companyId, family)] as const,
      ),
    );

    return versions
      .map(([family, version]) => `${family}:${version}`)
      .join('|');
  }

  async getActiveRisk<T>(
    companyId: string,
    riskId: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    return this.getOrLoadJson(
      'active-risk',
      companyId,
      [riskId],
      ['product'],
      loader,
    );
  }

  async getRequiredFactors<T>(
    companyId: string,
    riskId: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    return this.getOrLoadJson(
      'required-factors',
      companyId,
      [riskId],
      ['product'],
      loader,
    );
  }

  async getConfiguredFactors<T>(
    companyId: string,
    factorCodes: string[],
    loader: () => Promise<T>,
  ): Promise<T> {
    return this.getOrLoadJson(
      'configured-factors',
      companyId,
      factorCodes.map((code) => code.trim().toLowerCase()).sort(),
      ['product'],
      loader,
    );
  }

  async getActiveRules<T>(
    companyId: string,
    riskId: string,
    effectiveDate: string,
    currencyCode: string | null,
    loader: () => Promise<T>,
  ): Promise<T> {
    return this.getOrLoadJson(
      'active-rules',
      companyId,
      [riskId, effectiveDate, currencyCode ?? 'ANY'],
      ['product', 'rate'],
      loader,
    );
  }

  async getActiveTaxRules<T>(
    companyId: string,
    effectiveDate: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    return this.getOrLoadJson(
      'active-tax-rules',
      companyId,
      [effectiveDate],
      ['product', 'tax'],
      loader,
    );
  }

  async invalidateRateConfiguration(companyId: string): Promise<void> {
    await this.bumpVersion(companyId, 'rate');
  }

  async invalidateProductConfiguration(companyId: string): Promise<void> {
    await this.bumpVersion(companyId, 'product');
  }

  async invalidateTaxConfiguration(companyId: string): Promise<void> {
    await this.bumpVersion(companyId, 'tax');
  }

  private async getOrLoadJson<T>(
    namespace: string,
    companyId: string,
    keyParts: string[],
    versionFamilies: PricingCacheVersionFamily[],
    loader: () => Promise<T>,
    ttlSeconds = this.defaultTtlSeconds,
  ): Promise<T> {
    const versionSignature = await this.getConfigurationSignature(
      companyId,
      versionFamilies,
    );
    const cacheKey = [
      'pricing',
      'runtime',
      namespace,
      companyId,
      versionSignature,
      ...keyParts.map((part) => encodeURIComponent(part)),
    ].join(':');

    const cached = await this.redisService.getJson<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const inFlight = this.inFlightLoads.get(cacheKey) as Promise<T> | undefined;
    if (inFlight) {
      return inFlight;
    }

    const pending = (async () => {
      const loaded = await loader();
      await this.redisService.setJson(cacheKey, loaded, ttlSeconds);
      return loaded;
    })();

    this.inFlightLoads.set(cacheKey, pending);

    try {
      return await pending;
    } finally {
      this.inFlightLoads.delete(cacheKey);
    }
  }

  private async bumpVersion(
    companyId: string,
    family: PricingCacheVersionFamily,
  ): Promise<void> {
    const key = this.versionKey(companyId, family);
    await this.redisService.incr(key);
  }

  private async readVersion(
    companyId: string,
    family: PricingCacheVersionFamily,
  ): Promise<number> {
    const raw = await this.redisService.get(this.versionKey(companyId, family));
    const parsed = Number(raw ?? '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private versionKey(
    companyId: string,
    family: PricingCacheVersionFamily,
  ): string {
    return `pricing:runtime:version:${family}:${companyId}`;
  }
}
