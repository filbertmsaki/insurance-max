import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

import type { ServicePrincipal } from '@insurance-max/contracts';
import type { RequestContext } from '../interfaces';

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  getContext(): RequestContext | undefined {
    return this.storage.getStore();
  }

  getRequestId(): string | undefined {
    return this.getContext()?.requestId;
  }

  getCorrelationId(): string | undefined {
    return this.getContext()?.correlationId;
  }

  getSourceService(): string | undefined {
    return this.getContext()?.sourceService;
  }

  setServicePrincipal(principal: ServicePrincipal): void {
    const context = this.storage.getStore();

    if (context) {
      context.servicePrincipal = principal;
    }
  }

  getServicePrincipal(): ServicePrincipal | undefined {
    return this.storage.getStore()?.servicePrincipal;
  }
}
