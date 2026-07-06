import { apiClient } from '@/modules/shared/api/client';
import type { Device } from '@/types';

export const devicesApi = {
  getDevices: () => apiClient.get<Device[]>('/devices').then((r) => r.data),

  trustDevice: (id: string) =>
    apiClient.post<Device>(`/devices/${id}/trust`).then((r) => r.data),

  removeDevice: (id: string) =>
    apiClient.delete(`/devices/${id}`).then((r) => r.data),
};
