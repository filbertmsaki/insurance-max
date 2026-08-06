import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rateBooksApi } from '@/modules/tenant/product-engine/api/rate-books';
import { getApiErrorMessage } from '@/lib/api-error';
import { peKeys } from './query-keys';
import type {
  RateBookQueryParams,
  CreatePricingRateBookDto,
  UpdatePricingRateBookDto,
  ClonePricingRateBookDto,
} from '@/types/product-engine';

export function useRateBookList(params?: RateBookQueryParams) {
  return useQuery({
    queryKey: peKeys.rateBooks.lists(params),
    queryFn: () => rateBooksApi.list(params),
    staleTime: 30_000,
  });
}

export function useRateBook(id: string | undefined) {
  return useQuery({
    queryKey: peKeys.rateBooks.detail(id ?? ''),
    queryFn: () => rateBooksApi.findOne(id!),
    enabled: Boolean(id),
  });
}

export function useCreateRateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePricingRateBookDto) => rateBooksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.all() });
      toast.success('Rate book created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdateRateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdatePricingRateBookDto;
    }) => rateBooksApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.detail(id) });
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.all() });
      toast.success('Rate book updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useCloneRateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ClonePricingRateBookDto) => rateBooksApi.clone(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.all() });
      toast.success('Rate book cloned into a new draft');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useSubmitRateBookForReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rateBooksApi.submitReview(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.detail(id) });
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.all() });
      toast.success('Rate book submitted for review');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useApproveRateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rateBooksApi.approve(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.detail(id) });
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.all() });
      toast.success('Rate book approved');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRejectRateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      rateBooksApi.reject(id, comments),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.detail(id) });
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.all() });
      toast.success('Rate book rejected');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function usePublishRateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rateBooksApi.publish(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.detail(id) });
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.all() });
      toast.success('Rate book published');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRetireRateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rateBooksApi.retire(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.detail(id) });
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.all() });
      toast.success('Rate book retired');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeleteRateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rateBooksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peKeys.rateBooks.all() });
      toast.success('Rate book deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}
