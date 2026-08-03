import { SetMetadata } from '@nestjs/common';

export const SUBSCRIPTION_FEATURE_KEY = 'subscription_feature';

export const RequireSubscriptionFeature = (featureCode: string) =>
  SetMetadata(SUBSCRIPTION_FEATURE_KEY, featureCode);
