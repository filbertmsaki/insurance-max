import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { Request } from 'express';

import type { ServicePrincipal } from '@insurance-max/contracts';

@Injectable()
export class TiramisProductContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & {
        servicePrincipal?: ServicePrincipal;
      }
    >();

    const product = request.servicePrincipal?.product;

    if (
      !product ||
      !product.productId ||
      !product.productVersionId ||
      !product.versionNumber ||
      !product.tiramisProductCode ||
      !product.definitionHash
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_PRODUCT_CONTEXT_REQUIRED',
        message: 'A signed product-definition context is required.',
      });
    }

    return true;
  }
}
