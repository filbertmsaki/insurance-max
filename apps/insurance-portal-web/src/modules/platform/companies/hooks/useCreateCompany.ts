import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  companiesApi,
  type CreateCompanyExtendedDto,
  type UpdateCompanyDto,
} from '@/modules/platform/companies/api/companies';
import { getApiErrorMessage } from '@/lib/api-error';
import { companiesKeys } from './query-keys';

/**
 * Creates a company and its first administrator.
 *
 * The backend /companies endpoint only accepts the core + admin fields, so any
 * optional profile fields (contact_email, website, address, settings…) are
 * applied via a follow-up PATCH on the newly created company.
 */
export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCompanyExtendedDto) => {
      const {
        contact_email,
        contact_phone,
        website,
        logo_url,
        address,
        settings,
        ...coreDto
      } = data;

      const company = await companiesApi.createCompany(coreDto);

      const profileFields: UpdateCompanyDto = {};
      if (contact_email) profileFields.contact_email = contact_email;
      if (contact_phone) profileFields.contact_phone = contact_phone;
      if (website) profileFields.website = website;
      if (logo_url) profileFields.logo_url = logo_url;
      if (address && Object.values(address).some(Boolean))
        profileFields.address = address;
      if (settings && Object.keys(settings).length > 0)
        profileFields.settings = settings;

      if (Object.keys(profileFields).length > 0) {
        await companiesApi.updateCompany(company.id, profileFields);
      }

      return company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      toast.success('Company created successfully');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
