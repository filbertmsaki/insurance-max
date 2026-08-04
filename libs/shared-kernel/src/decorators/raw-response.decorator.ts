import { SetMetadata } from '@nestjs/common';

import { SKIP_API_ENVELOPE } from '../constants';

export const RawResponse = () => SetMetadata(SKIP_API_ENVELOPE, true);
