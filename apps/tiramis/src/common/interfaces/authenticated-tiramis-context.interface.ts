/**
 * The trusted request context resolved once by TiramisApiKeyGuard from the
 * validated X-Api-Key. Every value here is server-controlled — none of it
 * is accepted from client-supplied headers, query params, or DTO fields.
 * Controllers/services should read this instead of re-deriving tenant
 * routing data from the request.
 */
export interface AuthenticatedTiramisContext {
  apiKeyId: string;
  serviceName: string;
  scopes: string[];

  companyCode?: string | null;
  systemCode?: string | null;
  environment?: 'uat' | 'production' | null;
  clientConfigurationId?: string | null;
}
