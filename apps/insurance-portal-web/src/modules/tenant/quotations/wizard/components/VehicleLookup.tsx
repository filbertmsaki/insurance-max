import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api-error';
import { verificationsApi } from '@/modules/tenant/verifications/api';
import type { QuotationFormSchemaValues } from '../../schemas';
import { normalizeMotorTextInput } from '../../utils/motorText';
import { readVerifiedMotorDetails } from '../utils/vehicleVerification';

interface Props {
  initialCategory?: string;
  onFound: (details: Partial<QuotationFormSchemaValues['motor']>) => void;
}

export function VehicleLookup({ initialCategory, onFound }: Props) {
  const id = useId();
  const [category, setCategory] = useState<'1' | '2'>(
    initialCategory === '2' ? '2' : '1',
  );
  const [identifierType, setIdentifierType] = useState('registration');
  const [identifier, setIdentifier] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState(false);
  const active = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function fetchVehicle() {
    if (inFlight.current) return;
    const value = normalizeMotorTextInput(identifier);
    setFound(false);
    setError(null);
    if (!value) {
      setError('Enter a registration number or chassis number.');
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      const result = await verificationsApi.motor({
        motorCategory: Number(category) as 1 | 2,
        ...(identifierType === 'registration'
          ? { motorRegistrationNumber: value }
          : { motorChassisNumber: value }),
      });
      if (!active.current) return;
      if (result.responseCode === 'TIRA007') {
        setError('Vehicle details not found.');
        return;
      }
      if (result.status === 'PENDING') {
        setError(
          'Vehicle verification is still pending. Please try again shortly.',
        );
        return;
      }
      if (!result.success) {
        setError(
          result.responseMessage ||
            'Unable to fetch vehicle details. Please try again.',
        );
        return;
      }
      const details = readVerifiedMotorDetails(result, category);
      if (!details) {
        setError('Vehicle details not found.');
        return;
      }
      onFound(details);
      setFound(true);
    } catch (error) {
      if (active.current) setError(getApiErrorMessage(error));
    } finally {
      inFlight.current = false;
      if (active.current) setPending(false);
    }
  }

  function clearMessage() {
    setError(null);
    setFound(false);
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">
        Fetch vehicle details
      </p>
      <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto]">
        <div className="space-y-2">
          <Label htmlFor={`${id}-category`}>Motor category</Label>
          <Select
            value={category}
            disabled={pending}
            onValueChange={(value) => {
              setCategory(value as '1' | '2');
              clearMessage();
            }}
          >
            <SelectTrigger id={`${id}-category`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Motor vehicle</SelectItem>
              <SelectItem value="2">Motorcycle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-type`}>Search by</Label>
          <Select
            value={identifierType}
            disabled={pending}
            onValueChange={(value) => {
              setIdentifierType(value);
              setIdentifier('');
              clearMessage();
            }}
          >
            <SelectTrigger id={`${id}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="registration">Registration number</SelectItem>
              <SelectItem value="chassis">Chassis number</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-identifier`}>
            {identifierType === 'registration'
              ? 'Registration number'
              : 'Chassis number'}
          </Label>
          <Input
            id={`${id}-identifier`}
            value={identifier}
            maxLength={50}
            disabled={pending}
            placeholder={
              identifierType === 'registration' ? 'T123ABC' : 'Chassis number'
            }
            onChange={(event) => {
              setIdentifier(event.target.value);
              clearMessage();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void fetchVehicle();
              }
            }}
          />
        </div>
        <Button
          type="button"
          disabled={pending}
          onClick={() => void fetchVehicle()}
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          {pending ? 'Fetching...' : 'Fetch details'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {found && (
        <p role="status" className="text-sm text-emerald-700">
          Vehicle details populated. Review the fields below.
        </p>
      )}
    </div>
  );
}
