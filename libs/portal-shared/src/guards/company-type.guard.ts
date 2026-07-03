import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyType } from '../enums/company-type.enum';
import { COMPANY_TYPES_KEY } from '../decorators/company-types.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class CompanyTypeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTypes = this.reflector.getAllAndOverride<CompanyType[]>(
      COMPANY_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredTypes?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const companyType = request.user?.companyType;

    if (!companyType || !requiredTypes.includes(companyType)) {
      throw new ForbiddenException(
        `This action is restricted to: ${requiredTypes.join(', ')}`,
      );
    }

    return true;
  }
}
