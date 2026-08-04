import { Global, Module, type INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { RequestContextService } from './context';
import { RequestContextMiddleware } from './middleware';

@Global()
@Module({
  providers: [RequestContextService, RequestContextMiddleware],
  exports: [RequestContextService],
})
export class RequestContextModule {}

/**
 * Binds RequestContextMiddleware directly at the Express layer via app.use(),
 * so it runs for every request regardless of global prefix, versioning, or
 * NestJS's module-level route matching for wildcard middleware.
 */
export function bindRequestContext(app: INestApplication): void {
  const middleware = app.get(RequestContextMiddleware);

  app.use((request: Request, response: Response, next: NextFunction) => {
    middleware.use(request, response, next);
  });
}
