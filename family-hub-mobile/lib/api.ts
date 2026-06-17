import { Platform } from 'react-native';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export async function getToken() {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('family_hub_token');
      }
      return null;
    }
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync('family_hub_token');
  } catch (e) {
    console.error('Token storage read error', e);
    return null;
  }
}

export async function setToken(token: string) {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('family_hub_token', token);
      }
      return;
    }
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync('family_hub_token', token);
  } catch (e) {
    console.error('Token storage write error', e);
  }
}

export async function removeToken() {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('family_hub_token');
      }
      return;
    }
    const SecureStore = require('expo-secure-store');
    await SecureStore.deleteItemAsync('family_hub_token');
  } catch (e) {
    console.error('Token storage remove error', e);
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type UnauthorizedCallback = () => void;
let onUnauthorized: UnauthorizedCallback | null = null;

export function setUnauthorizedCallback(cb: UnauthorizedCallback) {
  onUnauthorized = cb;
}

function joinApiUrl(endpoint: string) {
  if (!API_BASE_URL) {
    throw new ApiError('Missing EXPO_PUBLIC_API_BASE_URL', 500);
  }
  if (endpoint.startsWith('http')) return endpoint;

  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = joinApiUrl(endpoint);

  try {
    const response = await fetch(url, { ...options, headers });
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const trimmedText = text.trim().toLowerCase();

    if (trimmedText.startsWith('<!doctype html>') || trimmedText.startsWith('<html') || contentType.includes('text/html')) {
      throw new ApiError(`API trả về HTML: ${url} status ${response.status}`, response.status);
    }

    if (response.status === 401) {
      await removeToken();
      if (onUnauthorized) onUnauthorized();
    }

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiError(`API returned non-JSON: ${url} status ${response.status}`, response.status);
    }

    if (!response.ok || data.ok === false) {
      throw new ApiError(data.error || data.message || `Server error (${response.status})`, response.status);
    }

    return data;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;

    const message = error?.message || String(error);
    throw new ApiError(`API request failed: ${options.method || 'GET'} ${url}. ${message}`, 500);
  }
}

export const api = {
  get: (endpoint: string) => fetchWithAuth(endpoint, { method: 'GET' }),
  post: (endpoint: string, body?: any) => fetchWithAuth(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (endpoint: string, body?: any) => fetchWithAuth(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (endpoint: string) => fetchWithAuth(endpoint, { method: 'DELETE' }),
};
