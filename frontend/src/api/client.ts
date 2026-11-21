const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

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

  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    let url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
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
        // Token expired or invalid
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

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res);
  }

  async post<T>(endpoint: string, body?: any, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async put<T>(endpoint: string, body?: any, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async patch<T>(endpoint: string, body?: any, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async delete<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res);
  }
}

export const api = new APIClient();
