import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  companiesApi,
  type UpdateNumberFormatSettingsDto,
} from '@/modules/platform/companies/api/companies';
import { setActiveNumberFormatSettings } from '@/modules/shared/formatting/number-format';
import { companiesKeys } from './query-keys';

export function useUpdateNumberFormatSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateNumberFormatSettingsDto) =>
      companiesApi.updateMyNumberFormat(data),
    onSuccess: (settings) => {
      setActiveNumberFormatSettings(settings);
      queryClient.setQueryData(companiesKeys.numberFormat(), settings);
      toast.success('Number and currency format updated');
    },
  });
}
