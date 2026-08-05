import { apiClient } from '@/modules/shared/api/client';
import type {
  InsuranceProductVersion,
  ProductDefinitionSnapshot,
  UpsertProductVersionDto,
} from '@/types/product-engine';

export const productDefinitionsApi = {
  listVersions: (productId: string) =>
    apiClient
      .get<
        InsuranceProductVersion[]
      >(`/insurance-products/${productId}/versions`)
      .then((r) => r.data),

  findVersion: (productId: string, versionId: string) =>
    apiClient
      .get<InsuranceProductVersion>(
        `/insurance-products/${productId}/versions/${versionId}`,
      )
      .then((r) => r.data),

  createVersion: (productId: string) =>
    apiClient
      .post<InsuranceProductVersion>(
        `/insurance-products/${productId}/versions`,
      )
      .then((r) => r.data),

  updateDraft: (
    productId: string,
    versionId: string,
    data: UpsertProductVersionDto,
  ) =>
    apiClient
      .patch<InsuranceProductVersion>(
        `/insurance-products/${productId}/versions/${versionId}`,
        data,
      )
      .then((r) => r.data),

  submitReview: (productId: string, versionId: string) =>
    apiClient
      .post<InsuranceProductVersion>(
        `/insurance-products/${productId}/versions/${versionId}/submit-review`,
      )
      .then((r) => r.data),

  reject: (productId: string, versionId: string, comments: string) =>
    apiClient
      .post<InsuranceProductVersion>(
        `/insurance-products/${productId}/versions/${versionId}/reject`,
        { comments },
      )
      .then((r) => r.data),

  returnDraft: (productId: string, versionId: string) =>
    apiClient
      .post<InsuranceProductVersion>(
        `/insurance-products/${productId}/versions/${versionId}/return-draft`,
      )
      .then((r) => r.data),

  publish: (productId: string, versionId: string) =>
    apiClient
      .post<ProductDefinitionSnapshot>(
        `/insurance-products/${productId}/versions/${versionId}/publish`,
      )
      .then((r) => r.data),

  retire: (productId: string, versionId: string) =>
    apiClient
      .post(`/insurance-products/${productId}/versions/${versionId}/retire`)
      .then((r) => r.data),

  publishedDefinition: (
    productId: string,
    params?: { sub_class_id?: string; effective_date?: string },
  ) =>
    apiClient
      .get<ProductDefinitionSnapshot>(
        `/insurance-products/${productId}/published-definition`,
        { params },
      )
      .then((r) => r.data),
};
