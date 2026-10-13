export interface ReferenceCountry {
  id: string;
  name: string;
  iso2_code: string | null;
  iso3_code: string;
  phone_code: string | null;
  is_active: boolean;
}

export interface ReferenceRegion {
  id: string;
  country_id: string;
  code: string;
  name: string;
  is_active: boolean;
  country?: ReferenceCountry;
}

export interface ReferenceDistrict {
  id: string;
  region_id: string;
  code: string;
  name: string;
  is_active: boolean;
  region?: ReferenceRegion & { country?: ReferenceCountry };
}

export interface ReferenceCurrency {
  id: string;
  name: string;
  code: string;
  symbol: string | null;
  is_active: boolean;
}

export interface ReferenceListParams {
  search?: string;
  is_active?: boolean;
  country_id?: string;
  region_id?: string;
}

export interface ReferenceTableParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  is_active?: string;
  country_id?: string;
}

export type ReferenceKind =
  | 'countries'
  | 'regions'
  | 'districts'
  | 'currencies';
