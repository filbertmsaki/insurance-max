import { Injectable } from '@nestjs/common';
import { Customer } from '../entities/customer.entity';

export interface TiraPolicyholderPayload {
  PolicyHolderName: string | null;
  PolicyHolderBirthDate: string | null;
  PolicyHolderType: number | null;
  PolicyHolderIdNumber: string | null;
  PolicyHolderIdType: number | null;
  Gender: string | null;
  CountryCode: string | null;
  Region: string | null;
  District: string | null;
  Street: string | null;
  PolicyHolderPhoneNumber: string | null;
  PolicyHolderFax: string | null;
  PostalAddress: string | null;
  EmailAddress: string | null;
}

@Injectable()
export class TiraPolicyholderMapperService {
  mapCustomer(customer: Customer): TiraPolicyholderPayload {
    return {
      PolicyHolderName:
        customer.display_name ??
        customer.company_name ??
        this.fullName(customer),
      PolicyHolderBirthDate: customer.date_of_birth,
      PolicyHolderType: customer.policy_holder_type,
      PolicyHolderIdNumber: customer.id_number,
      PolicyHolderIdType: customer.id_type,
      Gender: customer.gender,
      CountryCode: customer.country_code,
      Region: customer.region,
      District: customer.district,
      Street: customer.street,
      PolicyHolderPhoneNumber: customer.phone,
      PolicyHolderFax: customer.fax,
      PostalAddress: customer.postal_address,
      EmailAddress: customer.email,
    };
  }

  private fullName(customer: Customer): string | null {
    const value = [
      customer.first_name,
      customer.middle_name,
      customer.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return value || null;
  }
}
