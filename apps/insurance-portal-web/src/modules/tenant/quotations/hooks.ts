import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { SortOrder } from '@/types';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { API_BASE_URL, API_WITH_CREDENTIALS } from '@/modules/shared/config';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import { customersApi } from '@/modules/tenant/customers/api';
import { motorApi } from '@/modules/tenant/motor/api';
import {
  useAllActiveCategories,
  useAllActiveProducts,
  useRisksByProduct,
  useSubClassesByProduct,
} from '@/modules/tenant/product-engine/hooks';
import { usePricingCalculator } from '@/modules/pricing';
import { tiramisApi } from '@/modules/tenant/tiramis/api';
import { departmentsApi } from '@/modules/tenant/departments/api/departments';
import { getApiErrorMessage } from '@/lib/api-error';
import type { InsuranceBusinessLine } from '@/types/product-engine';
import { quotationsApi } from './api';
import { buildQuotationDraftPayload, buildQuotationPayload } from './schemas';
import type { QuotationFormSchemaValues } from './schemas';
import type {
  DecideQuotationPremiumOverridePayload,
  QuotationDraftRecordPayload,
  QuotationDetailRecord,
  QuotationListParams,
  QuotationPreviewRecord,
  RequestQuotationPremiumOverridePayload,
  QuotationSubmitResponse,
  QuotationStatusTransitionAction,
  TransitionQuotationStatusPayload,
} from './types';
import type {
  QuotationDraftUpdatePayload,
  QuotationUpdatePayload,
} from './api';

const quotationKeys = {
  all: ['quotations'] as const,
  list: (params: QuotationListParams) =>
    ['quotations', 'list', params] as const,
  detail: (id: string) => ['quotations', 'detail', id] as const,
  editDetail: (id: string) => ['quotations', 'edit-detail', id] as const,
  preview: (id: string) => ['quotations', 'preview', id] as const,
  workflow: (id: string) => ['quotations', 'workflow', id] as const,
  payload: (id: string) => ['quotations', 'payload', id] as const,
};

type NotificationStreamEvent = {
  type?: string;
  targetRecordType?: string | null;
  targetRecordId?: string | null;
  payload?: Record<string, unknown>;
};

type ParsedSseMessage = {
  event: string;
  data: string;
  id?: string;
};

function parseSseMessage(rawMessage: string): ParsedSseMessage | null {
  const lines = rawMessage.split('\n');
  const data: string[] = [];
  let event = 'message';
  let id: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');

    if (!line || line.startsWith(':')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const value =
      separatorIndex >= 0
        ? line.slice(separatorIndex + 1).replace(/^ /, '')
        : '';

    if (field === 'event') {
      event = value || 'message';
    } else if (field === 'data') {
      data.push(value);
    } else if (field === 'id') {
      id = value;
    }
  }

  if (data.length === 0) {
    return null;
  }

  return {
    event,
    data: data.join('\n'),
    id,
  };
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: NotificationStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let boundaryIndex = buffer.indexOf('\n\n');
    while (boundaryIndex >= 0) {
      const rawMessage = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      const parsed = parseSseMessage(rawMessage);
      if (!parsed) {
        boundaryIndex = buffer.indexOf('\n\n');
        continue;
      }

      try {
        const event = JSON.parse(parsed.data) as NotificationStreamEvent;
        onEvent({ ...event, type: event.type || parsed.event });
      } catch {
        // Ignore malformed stream frames; the connection itself can continue.
      }

      boundaryIndex = buffer.indexOf('\n\n');
    }
  }
}

export function useQuotationsList() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const committedSearch = params.get('search') ?? '';
  const status = params.get('status') ?? 'all';
  const quotationType = params.get('quotation_type') ?? 'all';
  const quotationFlow = params.get('quotation_flow') ?? 'all';
  const productId = params.get('product_id') ?? 'all';
  const [searchInput, setSearchInput] = useState(committedSearch);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value === null) next.delete(key);
        else next.set(key, value);
        next.set('page', '1');
        return next;
      });
    },
    [setParams],
  );

  useEffect(() => {
    const normalizedSearch = searchInput.trim();
    if (normalizedSearch === committedSearch) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setParam('search', normalizedSearch || null);
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [committedSearch, searchInput, setParam]);

  const queryParams = useMemo<QuotationListParams>(
    () => ({
      page,
      limit,
      search: committedSearch || undefined,
      status:
        status === 'all'
          ? undefined
          : (status as QuotationListParams['status']),
      quotation_type:
        quotationType === 'all'
          ? undefined
          : (quotationType as QuotationListParams['quotation_type']),
      quotation_flow:
        quotationFlow === 'all'
          ? undefined
          : (quotationFlow as QuotationListParams['quotation_flow']),
      product_id: productId === 'all' ? undefined : productId,
      sortBy,
      sortOrder,
    }),
    [
      committedSearch,
      limit,
      page,
      productId,
      quotationFlow,
      quotationType,
      sortBy,
      sortOrder,
      status,
    ],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: quotationKeys.list(queryParams),
    queryFn: () => quotationsApi.getList(queryParams),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });

  return {
    data,
    isLoading,
    error,
    page,
    limit,
    search: searchInput,
    status,
    quotationType,
    quotationFlow,
    productId,
    sortBy,
    sortOrder,
    setSearch: setSearchInput,
    setStatus: (value: string) =>
      setParam('status', value === 'all' ? null : value),
    setQuotationType: (value: string) =>
      setParam('quotation_type', value === 'all' ? null : value),
    setQuotationFlow: (value: string) =>
      setParam('quotation_flow', value === 'all' ? null : value),
    setProductId: (value: string) =>
      setParam('product_id', value === 'all' ? null : value),
    setPage: (value: number) =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set('page', String(value));
        return next;
      }),
    setLimit: (value: number) =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      }),
    setSort: (key: string, order: SortOrder) => {
      setSortBy(key);
      setSortOrder(order);
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set('page', '1');
        return next;
      });
    },
  };
}

export function useQuotationDetail(id?: string) {
  return useQuery({
    queryKey: id ? quotationKeys.detail(id) : quotationKeys.detail(''),
    queryFn: () => quotationsApi.getById(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useQuotationEditDetail(id?: string) {
  return useQuery({
    queryKey: id ? quotationKeys.editDetail(id) : quotationKeys.editDetail(''),
    queryFn: () => quotationsApi.getForEdit(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useQuotationPreview(id?: string) {
  return useQuery({
    queryKey: id ? quotationKeys.preview(id) : quotationKeys.preview(''),
    queryFn: () => quotationsApi.getPreview(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useQuotationWorkflow(id?: string) {
  return useQuery({
    queryKey: id ? quotationKeys.workflow(id) : quotationKeys.workflow(''),
    queryFn: () => quotationsApi.getWorkflow(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useQuotationRealtime(id?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!id || !accessToken) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const invalidateQuotation = () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: quotationKeys.preview(id) });
      queryClient.invalidateQueries({ queryKey: quotationKeys.workflow(id) });
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
    };

    const waitBeforeReconnect = () =>
      new Promise<void>((resolve) => {
        retryTimer = setTimeout(resolve, 3000);
      });

    const handleNotification = (notification: NotificationStreamEvent) => {
      if (notification.type !== 'quotation.tiramis.updated') {
        return;
      }

      const payloadQuotationId =
        typeof notification.payload?.quotationId === 'string'
          ? notification.payload.quotationId
          : null;

      const quotationId = notification.targetRecordId ?? payloadQuotationId;

      if (quotationId === id) {
        invalidateQuotation();
      }
    };

    const connect = async () => {
      while (!cancelled) {
        try {
          const response = await fetch(`${API_BASE_URL}/notifications/stream`, {
            headers: {
              Accept: 'text/event-stream',
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: API_WITH_CREDENTIALS ? 'include' : 'same-origin',
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error('Notification stream failed to open');
          }

          await readSseStream(response.body, handleNotification);
        } catch {
          if (cancelled || controller.signal.aborted) {
            return;
          }
        }

        if (!cancelled) {
          await waitBeforeReconnect();
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      controller.abort();

      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [accessToken, id, queryClient]);
}

export function useQuotationPayload(id?: string) {
  return useQuery({
    queryKey: id ? quotationKeys.payload(id) : quotationKeys.payload(''),
    queryFn: () => quotationsApi.getPayload(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      values,
      salePointCode,
      productCode,
      existingCustomer,
    }: {
      values: QuotationFormSchemaValues;
      salePointCode: string;
      productCode: string;
      existingCustomer?: Parameters<
        typeof buildQuotationPayload
      >[1]['existingCustomer'];
    }) =>
      quotationsApi.create(
        buildQuotationPayload(values, {
          salePointCode,
          productCode,
          existingCustomer: existingCustomer ?? null,
        }),
      ),
    onSuccess: (quotation) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      queryClient.setQueryData(quotationKeys.detail(quotation.id), quotation);
      toast.success('Quotation created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useUpdateQuotation(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      values,
      salePointCode,
      productCode,
      existingCustomer,
      expectedUpdatedAt,
    }: {
      values: QuotationFormSchemaValues;
      salePointCode: string;
      productCode: string;
      existingCustomer?: Parameters<
        typeof buildQuotationPayload
      >[1]['existingCustomer'];
      expectedUpdatedAt?: string;
    }) =>
      quotationsApi.update(id!, {
        ...buildQuotationPayload(values, {
          salePointCode,
          productCode,
          existingCustomer: existingCustomer ?? null,
        }),
        expected_updated_at: expectedUpdatedAt,
      } satisfies QuotationUpdatePayload),
    onSuccess: (quotation) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.setQueryData(quotationKeys.detail(id), quotation);
      }
      toast.success('Quotation updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useDeleteQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => quotationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      toast.success('Quotation deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useCreateQuotationDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      values,
      currentWizardStep,
    }: {
      values: QuotationFormSchemaValues;
      currentWizardStep?: string | null;
      silent?: boolean;
    }) =>
      quotationsApi.createDraft(
        buildQuotationDraftPayload(
          values,
          currentWizardStep,
        ) satisfies QuotationDraftRecordPayload,
      ),
    onSuccess: (quotation, variables) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      queryClient.setQueryData(quotationKeys.detail(quotation.id), quotation);
      queryClient.setQueryData(
        quotationKeys.editDetail(quotation.id),
        quotation,
      );
      queryClient.invalidateQueries({
        queryKey: quotationKeys.workflow(quotation.id),
      });
      if (!variables.silent) {
        toast.success('Quotation draft saved');
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useUpdateQuotationDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
      currentWizardStep,
      expectedUpdatedAt,
    }: {
      id: string;
      values: QuotationFormSchemaValues;
      currentWizardStep?: string | null;
      expectedUpdatedAt?: string;
      silent?: boolean;
    }) =>
      quotationsApi.updateDraft(id, {
        ...buildQuotationDraftPayload(values, currentWizardStep),
        expected_updated_at: expectedUpdatedAt,
      } satisfies QuotationDraftUpdatePayload),
    onSuccess: (quotation, variables) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      queryClient.setQueryData(quotationKeys.detail(quotation.id), quotation);
      queryClient.setQueryData(
        quotationKeys.editDetail(quotation.id),
        quotation,
      );
      queryClient.invalidateQueries({
        queryKey: quotationKeys.workflow(quotation.id),
      });
      if (!variables.silent) {
        toast.success('Quotation draft updated');
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useDeleteQuotationDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => quotationsApi.deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      toast.success('Quotation draft deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useFinalizeQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
      salePointCode,
      productCode,
      existingCustomer,
      expectedUpdatedAt,
    }: {
      id: string;
      values: QuotationFormSchemaValues;
      salePointCode: string;
      productCode: string;
      existingCustomer?: Parameters<
        typeof buildQuotationPayload
      >[1]['existingCustomer'];
      expectedUpdatedAt?: string;
    }) =>
      quotationsApi.finalize(id, {
        ...buildQuotationPayload(values, {
          salePointCode,
          productCode,
          existingCustomer: existingCustomer ?? null,
        }),
        expected_updated_at: expectedUpdatedAt,
      } satisfies QuotationUpdatePayload),
    onSuccess: (quotation) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      queryClient.setQueryData(quotationKeys.detail(quotation.id), quotation);
      queryClient.setQueryData(
        quotationKeys.editDetail(quotation.id),
        quotation,
      );
      queryClient.invalidateQueries({
        queryKey: quotationKeys.preview(quotation.id),
      });
      queryClient.invalidateQueries({
        queryKey: quotationKeys.workflow(quotation.id),
      });
      toast.success('Quotation completed');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useSubmitQuotation(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: {
      force_resubmit?: boolean;
      return_existing?: boolean;
    }) => quotationsApi.submit(id!, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.workflow(id) });
      }
      toast.success('Quotation submitted to TIRAMIS');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useSubmitQuotationForApproval(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => quotationsApi.submitForApproval(id!),
    onSuccess: (quotation) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.setQueryData(quotationKeys.detail(id), quotation);
        queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.preview(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.workflow(id) });
      }
      toast.success('Quotation submitted for approval');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useRequestQuotationPayment(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => quotationsApi.requestPayment(id!),
    onSuccess: (quotation) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.setQueryData(quotationKeys.detail(id), quotation);
        queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.preview(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.workflow(id) });
      }
      toast.success('Payment request created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useRetryQuotationTira(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => quotationsApi.retryTira(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.preview(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.workflow(id) });
      }
      toast.success('TIRAMIS submission retried');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useCancelQuotation(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cancellationReason: string) =>
      quotationsApi.cancel(id!, {
        cancellation_reason: cancellationReason,
      }),
    onSuccess: (quotation) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.setQueryData(quotationKeys.detail(id), quotation);
        queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.preview(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.workflow(id) });
      }
      toast.success('Quotation cancelled');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useTransitionQuotationStatus(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TransitionQuotationStatusPayload) =>
      quotationsApi.transitionStatus(id!, payload),
    onSuccess: (quotation, payload) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.setQueryData(
          quotationKeys.detail(id),
          quotation satisfies QuotationDetailRecord,
        );
        queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.preview(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.workflow(id) });
      }

      const actionMessages: Partial<
        Record<QuotationStatusTransitionAction, string>
      > = {
        EVALUATE_REQUIREMENTS: 'Quotation requirements re-evaluated',
        SUBMIT_FOR_APPROVAL: 'Quotation submitted for approval',
        APPROVE: 'Quotation approved',
        REQUEST_CHANGES: 'Changes requested',
        REJECT_APPROVAL: 'Quotation rejected',
        MARK_PAYMENT_REQUESTED: 'Payment request recorded',
        MARK_PAYMENT_PROCESSING: 'Payment marked as processing',
        MARK_PARTIALLY_PAID: 'Partial payment recorded',
        MARK_PAYMENT_PAID: 'Payment recorded in full',
        MARK_PAYMENT_FAILED: 'Payment marked as failed',
        MARK_PAYMENT_EXPIRED: 'Payment request marked as expired',
        MARK_PAYMENT_REFUNDED: 'Payment marked as refunded',
        CANCEL: 'Quotation cancelled',
      };

      const message =
        actionMessages[payload.action] ||
        `Quotation moved to ${quotation.quotation_status.toLowerCase().replace(/_/g, ' ')}`;

      toast.success(message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useRequestQuotationPremiumOverride(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      riskId,
      payload,
    }: {
      riskId: string;
      payload: RequestQuotationPremiumOverridePayload;
    }) => quotationsApi.requestPremiumOverride(id!, riskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.preview(id) });
      }
      toast.success('Premium override request submitted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useApproveQuotationPremiumOverride(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      riskId,
      overrideId,
      payload,
    }: {
      riskId: string;
      overrideId: string;
      payload?: DecideQuotationPremiumOverridePayload;
    }) =>
      quotationsApi.approvePremiumOverride(id!, riskId, overrideId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.preview(id) });
      }
      toast.success('Premium override approved');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useRejectQuotationPremiumOverride(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      riskId,
      overrideId,
      payload,
    }: {
      riskId: string;
      overrideId: string;
      payload: DecideQuotationPremiumOverridePayload;
    }) => quotationsApi.rejectPremiumOverride(id!, riskId, overrideId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      if (id) {
        queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: quotationKeys.preview(id) });
      }
      toast.success('Premium override rejected');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useQuotationCustomers() {
  return useQuery({
    queryKey: ['quotations', 'customers'],
    queryFn: async () =>
      (await customersApi.getCustomers({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}

export function useQuotationCategories(businessLine?: InsuranceBusinessLine) {
  return useAllActiveCategories(businessLine);
}

export function useQuotationProducts(
  params?:
    | string
    | {
        category_id?: string;
        business_line?: InsuranceBusinessLine;
        supports_fleet?: boolean;
      },
) {
  const normalizedParams =
    typeof params === 'string' ? { category_id: params } : params;

  return useAllActiveProducts({
    category_id:
      normalizedParams?.category_id && normalizedParams.category_id !== 'all'
        ? normalizedParams.category_id
        : undefined,
    business_line: normalizedParams?.business_line,
    supports_fleet: normalizedParams?.supports_fleet,
  });
}

export function useQuotationSubClasses(productId?: string) {
  return useSubClassesByProduct(
    productId && productId !== 'all' ? productId : '',
  );
}

export function useQuotationRisks(productId?: string) {
  return useRisksByProduct({
    product_id: productId && productId !== 'all' ? productId : undefined,
  });
}

export function useQuotationBranches() {
  return useQuery({
    queryKey: ['quotations', 'branches'],
    queryFn: () => branchesApi.getAllBranches(),
    staleTime: 60_000,
  });
}

export function useQuotationDepartments(branchId?: string) {
  return useQuery({
    queryKey: ['quotations', 'departments', branchId ?? 'all'],
    queryFn: async () => {
      const page = await departmentsApi.getDepartments({
        page: 1,
        limit: API_MAX_LIST_LIMIT,
      });
      const all = page.data;
      if (!branchId) return all;
      return all.filter(
        (department) =>
          (department.branch_id ?? department.branch?.id ?? '') === branchId,
      );
    },
    staleTime: 60_000,
  });
}

export function useQuotationSalePoints(branchId?: string) {
  return useQuery({
    queryKey: ['quotations', 'sale-points', branchId ?? 'none'],
    queryFn: () => tiramisApi.getSalePoints(branchId),
    enabled: !!branchId,
    staleTime: 30_000,
  });
}

export function useQuotationVehicles(customerId?: string) {
  return useQuery({
    queryKey: ['quotations', 'vehicles', customerId ?? 'none'],
    queryFn: async () => {
      const page = await motorApi.getVehicles({ limit: API_MAX_LIST_LIMIT });
      if (!customerId) return page.data;
      return page.data.filter((vehicle) => vehicle.customer_id === customerId);
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

export function useQuotationCalculator() {
  const { calculateSingleMutation } = usePricingCalculator();
  return calculateSingleMutation;
}

export function useQuotationCurrentCompanyId() {
  return useAuthStore(
    (state) => state.company?.id ?? state.user?.companyId ?? '',
  );
}

type QuotationChannelType = QuotationFormSchemaValues['channel_type'];

export interface QuotationDistributionChannelRecord {
  id: string;
  channel_type: QuotationChannelType;
  can_quote: boolean;
  status: string;
  product_id: string;
  category_id: string | null;
  sub_class_id: string | null;
  intermediary_company: {
    id: string;
    name: string;
    slug: string;
    company_type: string;
  } | null;
}

export function useQuotationDistributionChannels() {
  const companyId = useQuotationCurrentCompanyId();

  return useQuery({
    queryKey: ['quotations', 'distribution-channels', companyId || 'none'],
    queryFn: () =>
      apiClient
        .get<
          QuotationDistributionChannelRecord[]
        >('/product-distribution/channels')
        .then((response) => response.data),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export interface IntermediaryCompanyOption {
  id: string;
  name: string;
  slug: string;
  company_type: string;
}

/**
 * Tran Company options for a given channel + product, shared by the cover-note step
 * and the quotation start modal so both stay in sync with a single filtering rule.
 */
export function useIntermediaryCompanyOptions(
  channelType: QuotationChannelType | '',
  productId?: string,
): IntermediaryCompanyOption[] {
  const { data: distributionChannels = [] } =
    useQuotationDistributionChannels();

  return useMemo(() => {
    if (!channelType || channelType === 'DIRECT' || !productId) return [];

    const uniqueCompanies = new Map<string, IntermediaryCompanyOption>();

    distributionChannels.forEach((channel) => {
      if (
        channel.channel_type !== channelType ||
        channel.product_id !== productId ||
        channel.status !== 'ACTIVE' ||
        !channel.can_quote ||
        !channel.intermediary_company
      ) {
        return;
      }

      const company = channel.intermediary_company;
      if (!uniqueCompanies.has(company.id)) {
        uniqueCompanies.set(company.id, company);
      }
    });

    return [...uniqueCompanies.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [channelType, distributionChannels, productId]);
}

export { quotationKeys };
export type {
  QuotationDetailRecord,
  QuotationPreviewRecord,
  QuotationSubmitResponse,
};
