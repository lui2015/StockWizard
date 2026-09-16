import { api } from './base'
import type { SaveData } from '../data/types'

const TOKEN_KEY = 'stock-wizard-token'

export interface AuthUser {
  id: string
  username: string
  createdAt: number
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token: string) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(api(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  const json = (await res.json()) as T & { ok?: boolean; error?: string }
  if (!res.ok || json.ok === false) throw new Error(json.error ?? '账号服务出错')
  return json
}

export function register(username: string, password: string) {
  return call<{ ok: true; token: string; user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function login(username: string, password: string) {
  return call<{ ok: true; token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function me() {
  return call<{ ok: true; user: AuthUser }>('/api/auth/me')
}

export function logout() {
  return call<{ ok: true }>('/api/auth/logout', { method: 'POST' })
}

export function fetchCloudSave() {
  return call<{ ok: true; save: SaveData | null }>('/api/save')
}

export function putCloudSave(save: SaveData) {
  return call<{ ok: true; updatedAt: number }>('/api/save', {
    method: 'PUT',
    body: JSON.stringify({ save }),
  })
}
