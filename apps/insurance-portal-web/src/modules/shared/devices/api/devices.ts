import { apiClient } from '@/modules/shared/api/client';
import type { Device } from '@/types';

export const devicesApi = {
  getDevices: () =>
    apiClient.get<Device[]>('/apps/devices').then((r) => r.data),

  trustDevice: (id: string, code: string) =>
    apiClient
      .patch<Device>(`/apps/devices/${id}/trust`, { code })
      .then((r) => r.data),

  untrustDevice: (id: string) =>
    apiClient.patch<Device>(`/apps/devices/${id}/untrust`).then((r) => r.data),

  removeDevice: (id: string) =>
    apiClient.delete(`/apps/devices/${id}`).then((r) => r.data),
};
