import { Platform } from 'react-native';

const LAN_IP = '192.168.1.104'; // Default fallback
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'web' ? 'http://localhost:3000' : `http://${LAN_IP}:3000`);

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

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      await removeToken();
      throw new ApiError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 401);
    }
    
    let data;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      if (__DEV__) {
        throw new ApiError(`Lỗi parse JSON: ${text.substring(0, 100)}`, response.status);
      } else {
        throw new ApiError('Lỗi định dạng dữ liệu từ máy chủ.', response.status);
      }
    }

    if (!response.ok || data.ok === false) {
      throw new ApiError(data.error || data.message || `Lỗi máy chủ (${response.status})`, response.status);
    }
    
    return data;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    
    // TypeError usually means network error, DNS, or CORS blocked it entirely before returning status
    if (error instanceof TypeError && error.message.toLowerCase().includes('network')) {
      throw new ApiError(
        `Không kết nối được API hoặc bị CORS chặn:\n${options.method || 'GET'} ${url}\n\nHãy kiểm tra Web App (Next.js) đã chạy ở port 3000 chưa.`, 
        500
      );
    }
    
    console.error(`[API Error] ${endpoint}:`, error);
    throw new ApiError(
      `Lỗi kết nối:\n${options.method || 'GET'} ${url}\nLỗi: ${error.message || error}`, 
      500
    );
  }
}

export const api = {
  get: (endpoint: string) => fetchWithAuth(endpoint, { method: 'GET' }),
  post: (endpoint: string, body?: any) => fetchWithAuth(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (endpoint: string, body?: any) => fetchWithAuth(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (endpoint: string) => fetchWithAuth(endpoint, { method: 'DELETE' }),
};
