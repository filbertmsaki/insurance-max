import { apiClient } from '@/api/client'
import type { Department } from '@/types/product-engine'
import type { PEPage } from '@/types/product-engine'

export const departmentsApi = {
  getAll: () =>
    apiClient
      .get<PEPage<Department>>('/departments', { params: { limit: 100 } })
      .then((r) => r.data.data),
}
