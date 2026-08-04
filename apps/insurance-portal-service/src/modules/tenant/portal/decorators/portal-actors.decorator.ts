import { SetMetadata } from '@nestjs/common';

import { PortalActorType } from '../enums/portal.enums';

export const PORTAL_ACTORS_KEY = 'portalActors';

export const PortalActors = (...actors: PortalActorType[]) =>
  SetMetadata(PORTAL_ACTORS_KEY, actors);
