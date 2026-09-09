import { setAuthCookie, clearAuthCookie } from '@/store/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
};

class ApiError extends Error {
  constructor(
    public status: number,
    public data: any,
  ) {
    super(data?.message || `API Error ${status}`);
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, params } = options;

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  let res: Response | null = null;
  const maxRetries = 2;
  let lastFetchError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      break; // Request succeeded, exit retry loop
    } catch (err: any) {
      lastFetchError = err;
      // If it's a network error and we have retries left, wait 1s before retrying
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  if (!res) {
    throw new ApiError(0, {
      message: 'Backend server is unreachable or starting up. Please check if the API is running on port 4000.',
    });
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken && !endpoint.includes('/auth/refresh')) {
        try {
          const refreshRes = await request<{ data: { accessToken: string; refreshToken: string } }>(
            '/auth/refresh',
            { method: 'POST', body: { refreshToken } },
          );
          localStorage.setItem('accessToken', refreshRes.data.accessToken);
          localStorage.setItem('refreshToken', refreshRes.data.refreshToken);
          setAuthCookie();
          return request<T>(endpoint, options);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('auth-storage');
          clearAuthCookie();
          window.location.href = '/auth/login';
        }
      }
    }
    throw new ApiError(res.status, errorData);
  }

  const json = await res.json();
  return json;
}

async function uploadRequest<T>(endpoint: string, formData: FormData): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorData);
  }

  return res.json();
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, any>) =>
    request<T>(endpoint, { params }),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body }),
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body }),
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body }),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
  upload: <T>(endpoint: string, formData: FormData) =>
    uploadRequest<T>(endpoint, formData),
};

export { ApiError };
