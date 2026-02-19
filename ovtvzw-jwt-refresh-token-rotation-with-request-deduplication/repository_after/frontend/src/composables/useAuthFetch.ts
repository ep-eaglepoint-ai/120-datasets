import { ref, readonly } from 'vue';

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface QueuedRequest {
  resolve: (value: Response) => void;
  reject: (reason: Error) => void;
  url: string;
  options: RequestInit;
}

const tokenStore = ref<TokenStore>({
  accessToken: null,
  refreshToken: null
});

let isRefreshing = false;
let refreshPromise: Promise<RefreshResponse> | null = null;
const failedRequestsQueue: QueuedRequest[] = [];

let baseUrl = '';

export function setBaseUrl(url: string) {
  baseUrl = url;
}

export function setTokens(accessToken: string, refreshToken: string) {
  tokenStore.value.accessToken = accessToken;
  tokenStore.value.refreshToken = refreshToken;
}

export function getTokens(): TokenStore {
  return { ...tokenStore.value };
}

export function clearTokens() {
  tokenStore.value.accessToken = null;
  tokenStore.value.refreshToken = null;
}

async function refreshAccessToken(): Promise<RefreshResponse> {
  const refreshToken = tokenStore.value.refreshToken;
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await fetch(`${baseUrl}/api/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Refresh failed' }));
    throw new Error(error.error || 'Token refresh failed');
  }
  
  const data: RefreshResponse = await response.json();
  
  setTokens(data.accessToken, data.refreshToken);
  
  return data;
}

function processQueue(error: Error | null = null) {
  const queue = [...failedRequestsQueue];
  failedRequestsQueue.length = 0;
  
  queue.forEach(({ resolve, reject, url, options }) => {
    if (error) {
      reject(error);
    } else {
      const newOptions = {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${tokenStore.value.accessToken}`
        }
      };
      
      fetch(url, newOptions)
        .then(resolve)
        .catch(reject);
    }
  });
}

async function handleTokenRefresh(): Promise<RefreshResponse> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  
  refreshPromise = refreshAccessToken()
    .then((result) => {
      isRefreshing = false;
      refreshPromise = null;
      processQueue(null);
      return result;
    })
    .catch((error) => {
      isRefreshing = false;
      refreshPromise = null;
      clearTokens();
      processQueue(error);
      throw error;
    });
  
  return refreshPromise;
}

export function useAuthFetch() {
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  
  async function authFetch<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(tokenStore.value.accessToken && {
          'Authorization': `Bearer ${tokenStore.value.accessToken}`
        })
      }
    };
    
    isLoading.value = true;
    error.value = null;
    
    try {
      let response = await fetch(fullUrl, requestOptions);
      
      if (response.status === 401 && tokenStore.value.refreshToken) {
        if (isRefreshing) {
          return new Promise<T>((resolve, reject) => {
            failedRequestsQueue.push({
              resolve: async (retryResponse: Response) => {
                try {
                  if (!retryResponse.ok) {
                    throw new Error(`Request failed with status ${retryResponse.status}`);
                  }
                  const data = await retryResponse.json();
                  resolve(data as T);
                } catch (err) {
                  reject(err);
                }
              },
              reject,
              url: fullUrl,
              options: requestOptions
            });
          });
        }
        
        try {
          await handleTokenRefresh();
          
          const retryOptions: RequestInit = {
            ...requestOptions,
            headers: {
              ...requestOptions.headers,
              'Authorization': `Bearer ${tokenStore.value.accessToken}`
            }
          };
          
          response = await fetch(fullUrl, retryOptions);
        } catch (refreshError) {
          isLoading.value = false;
          error.value = refreshError as Error;
          throw refreshError;
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      isLoading.value = false;
      return data as T;
      
    } catch (err) {
      isLoading.value = false;
      error.value = err as Error;
      throw err;
    }
  }
  
  async function get<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
    return authFetch<T>(url, { ...options, method: 'GET' });
  }
  
  async function post<T = unknown>(url: string, body?: unknown, options: RequestInit = {}): Promise<T> {
    return authFetch<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }
  
  return {
    authFetch,
    get,
    post,
    isLoading: readonly(isLoading),
    error: readonly(error),
    setTokens,
    getTokens,
    clearTokens,
    setBaseUrl
  };
}

export function getRefreshState() {
  return {
    isRefreshing,
    queueLength: failedRequestsQueue.length
  };
}

export function resetState() {
  isRefreshing = false;
  refreshPromise = null;
  failedRequestsQueue.length = 0;
  clearTokens();
}

export default useAuthFetch;
