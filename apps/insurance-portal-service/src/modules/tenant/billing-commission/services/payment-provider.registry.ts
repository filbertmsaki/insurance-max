import { Injectable, NotFoundException } from '@nestjs/common';

import { PaymentProviderAdapter } from '../providers/payment-provider.adapter';

@Injectable()
export class PaymentProviderRegistry {
  private readonly adapters = new Map<string, PaymentProviderAdapter>();

  register(adapter: PaymentProviderAdapter) {
    this.adapters.set(adapter.providerCode.trim().toUpperCase(), adapter);
  }

  require(providerCode: string) {
    const adapter = this.adapters.get(providerCode.trim().toUpperCase());

    if (!adapter) {
      throw new NotFoundException('Payment provider is not configured.');
    }

    return adapter;
  }
}
