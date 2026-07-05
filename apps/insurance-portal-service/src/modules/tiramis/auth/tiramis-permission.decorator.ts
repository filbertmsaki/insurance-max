import { SetMetadata } from '@nestjs/common';

import { TiramisPermission } from './tiramis-permissions.constant';

export const TIRAMIS_PERMISSIONS_KEY = 'tiramis_permissions';

export const RequireTiramisPermissions = (
  ...permissions: TiramisPermission[]
) => SetMetadata(TIRAMIS_PERMISSIONS_KEY, permissions);
