import { apiClient } from '@/modules/shared/api/client';
import type { Device } from '@/types';

export const devicesApi = {
  getDevices: () => apiClient.get<Device[]>('/devices').then((r) => r.data),

  trustDevice: (id: string, code: string) =>
    apiClient
      .patch<Device>(`/devices/${id}/trust`, { code })
      .then((r) => r.data),

  untrustDevice: (id: string) =>
    apiClient.patch<Device>(`/devices/${id}/untrust`).then((r) => r.data),

  removeDevice: (id: string) =>
    apiClient.delete(`/devices/${id}`).then((r) => r.data),
};
