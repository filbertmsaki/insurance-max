import { useMemo } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import {
  useReferenceCountries,
  useReferenceDistricts,
  useReferenceRegions,
} from '../hooks';

interface LocationReferenceSelectsProps {
  country?: string;
  countryCode?: string;
  region?: string;
  district?: string;
  onCountryChange: (country: string, countryCode: string) => void;
  onRegionChange: (region: string) => void;
  onDistrictChange: (district: string) => void;
  errors?: {
    country?: string;
    region?: string;
    district?: string;
  };
}

export function LocationReferenceSelects({
  country,
  countryCode,
  region,
  district,
  onCountryChange,
  onRegionChange,
  onDistrictChange,
  errors,
}: LocationReferenceSelectsProps) {
  const { data: countries = [] } = useReferenceCountries({ is_active: true });
  // Falls back to Tanzania when the stored value doesn't match any reference record yet,
  // since nearly all customers/policyholders in this portal are based there.
  const selectedCountry =
    countries.find((item) => item.name === country) ??
    countries.find((item) => item.iso3_code === countryCode) ??
    countries.find((item) => item.iso3_code === 'TZA') ??
    null;
  const { data: regions = [] } = useReferenceRegions({
    is_active: true,
    country_id: selectedCountry?.id ?? '',
  });
  const selectedRegion =
    regions.find((item) => item.name === region) ??
    regions.find((item) => item.code === region) ??
    null;
  const { data: districts = [] } = useReferenceDistricts({
    is_active: true,
    region_id: selectedRegion?.id ?? '',
  });

  const countryOptions = useMemo(
    () =>
      countries.map((item) => ({
        value: item.id,
        label: `${item.name} (${item.iso3_code})`,
      })),
    [countries],
  );
  const regionOptions = useMemo(
    () => regions.map((item) => ({ value: item.id, label: item.name })),
    [regions],
  );
  const districtOptions = useMemo(
    () => districts.map((item) => ({ value: item.id, label: item.name })),
    [districts],
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label>Country</Label>
        <Combobox
          value={selectedCountry?.id ?? ''}
          onValueChange={(id) => {
            const next = countries.find((item) => item.id === id);
            onCountryChange(next?.name ?? '', next?.iso3_code ?? '');
            onRegionChange('');
            onDistrictChange('');
          }}
          options={countryOptions}
          placeholder="Select country"
          searchPlaceholder="Search countries"
        />
        {errors?.country && (
          <p className="text-sm text-red-600">{errors.country}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Region</Label>
        <Combobox
          value={selectedRegion?.id ?? ''}
          onValueChange={(id) => {
            const next = regions.find((item) => item.id === id);
            onRegionChange(next?.name ?? '');
            onDistrictChange('');
          }}
          options={regionOptions}
          placeholder="Select region"
          searchPlaceholder="Search regions"
          disabled={!selectedCountry}
        />
        {errors?.region && (
          <p className="text-sm text-red-600">{errors.region}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>District</Label>
        <Combobox
          value={
            districts.find(
              (item) => item.name === district || item.code === district,
            )?.id ?? ''
          }
          onValueChange={(id) => {
            const next = districts.find((item) => item.id === id);
            onDistrictChange(next?.name ?? '');
          }}
          options={districtOptions}
          placeholder="Select district"
          searchPlaceholder="Search districts"
          disabled={!selectedRegion}
        />
        {errors?.district && (
          <p className="text-sm text-red-600">{errors.district}</p>
        )}
      </div>
    </div>
  );
}
