import { api } from './api';
import { AuthResponse } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/register', payload);
    return data;
  },

  me: async (): Promise<AuthResponse['user']> => {
    const { data } = await api.get<AuthResponse['user']>('/auth/me');
    return data;
  },
};

export const saveToken = (token: string): void => {
  localStorage.setItem('token', token);
};

export const removeToken = (): void => {
  localStorage.removeItem('token');
};

export const getToken = (): string | null => {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
};
