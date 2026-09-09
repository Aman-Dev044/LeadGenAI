import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedResponse, ApiResponse } from '@/types';

export function useApiQuery<T>(
  key: string[],
  endpoint: string,
  params?: Record<string, any>,
  options?: Omit<UseQueryOptions<ApiResponse<T>>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: [...key, params],
    queryFn: () => api.get<ApiResponse<T>>(endpoint, params),
    ...options,
  });
}

export function usePaginatedQuery<T>(
  key: string[],
  endpoint: string,
  params?: Record<string, any>,
) {
  return useQuery({
    queryKey: [...key, params],
    queryFn: () => api.get<PaginatedResponse<T>>(endpoint, params),
  });
}

export function useApiMutation<TData = any, TVariables = any>(
  endpoint: string,
  method: 'post' | 'patch' | 'put' | 'delete' = 'post',
  options?: {
    invalidateKeys?: string[][];
    onSuccess?: (data: ApiResponse<TData>) => void;
    onError?: (error: any) => void;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TVariables) => {
      const fn = api[method] as any;
      return method === 'delete'
        ? fn(endpoint)
        : fn(endpoint, variables);
    },
    onSuccess: (data: ApiResponse<TData>) => {
      options?.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}
