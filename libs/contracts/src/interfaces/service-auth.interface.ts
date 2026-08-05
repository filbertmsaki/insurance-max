export interface ServiceTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  scopes: string[];
  jti: string;
  iat: number;
  exp: number;
}

export interface ServicePrincipal {
  serviceId: string;
  scopes: string[];
}
