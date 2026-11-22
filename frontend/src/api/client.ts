const FALLBACK_BACKEND_URL = 'https://bizmate-id73.onrender.com/api/v1';

const getBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  // If the env var still references the old deleted service 'bizmate-56sa', ignore it
  if (envUrl && !envUrl.includes('bizmate-56sa')) {
    return envUrl;
  }
  return '/api/v1';
};

export interface APIErrorResponse {
  detail?: string;
  error?: string;
  message?: string;
  status_code?: number;
}

export class APIClient {
  private getHeaders(customHeaders: Record<string, string> = {}): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    const token = localStorage.getItem('bizmate_auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const business = localStorage.getItem('bizmate_business');
    if (business) {
      try {
        const parsed = JSON.parse(business);
        if (parsed.id) {
          headers['X-Business-Id'] = parsed.id;
        }
      } catch (e) {}
    }
    return headers;
  }

  private buildUrl(endpoint: string, params?: Record<string, any>, customBase?: string): string {
    const base = customBase || getBaseUrl();
    let url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }
    return url;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (res.status === 204) {
      return {} as T;
    }

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => null);
    }

    if (!res.ok) {
      if (res.status === 401) {
        console.warn('Session expired or unauthorized request. Redirecting to login.');
      }
      const message =
        (typeof data === 'object' && (data?.detail || data?.message || data?.error)) ||
        `HTTP Error ${res.status}: ${res.statusText}`;
      const error: any = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data as T;
  }

  private async execute<T>(
    method: string,
    endpoint: string,
    body?: any,
    params?: Record<string, any>
  ): Promise<T> {
    const primaryUrl = this.buildUrl(endpoint, params);
    try {
      const res = await fetch(primaryUrl, {
        method,
        headers: this.getHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return await this.handleResponse<T>(res);
    } catch (err: any) {
      // If primary request failed and wasn't already calling the direct Render fallback, retry directly
      if (!primaryUrl.startsWith(FALLBACK_BACKEND_URL)) {
        try {
          const fallbackUrl = this.buildUrl(endpoint, params, FALLBACK_BACKEND_URL);
          const fallbackRes = await fetch(fallbackUrl, {
            method,
            headers: this.getHeaders(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });
          return await this.handleResponse<T>(fallbackRes);
        } catch (_fallbackErr) {
          throw err;
        }
      }
      throw err;
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.execute<T>('GET', endpoint, undefined, params);
  }

  async post<T>(endpoint: string, body?: any, params?: Record<string, any>): Promise<T> {
    return this.execute<T>('POST', endpoint, body, params);
  }

  async put<T>(endpoint: string, body?: any, params?: Record<string, any>): Promise<T> {
    return this.execute<T>('PUT', endpoint, body, params);
  }

  async patch<T>(endpoint: string, body?: any, params?: Record<string, any>): Promise<T> {
    return this.execute<T>('PATCH', endpoint, body, params);
  }

  async delete<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.execute<T>('DELETE', endpoint, undefined, params);
  }
}

export const api = new APIClient();
