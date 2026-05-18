import { API_BASE } from './config';
import type { Bird, User, Photo } from './types';

let _token: string | null = null;

function authHeader(): Record<string, string> {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}

async function jsonReq<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const isJson = options?.body && typeof options.body === 'string';
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? authHeader() : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  setToken(token: string | null) {
    _token = token;
  },

  getUser: (username: string) =>
    jsonReq<User>(`/api/users/${username}`),

  getUserBirds: (username: string) =>
    jsonReq<Bird[]>(`/api/users/${username}/birds`),

  getUserFriends: (username: string) =>
    jsonReq<User[]>(`/api/users/${username}/friends`),

  patchUser: (username: string, body: { region: string }) =>
    jsonReq<User>(`/api/users/${username}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  createUser: (username: string, region: string, password: string) =>
    jsonReq<{ user: User; token: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, region, password }),
    }),

  authUser: (username: string, password: string) =>
    jsonReq<{ user: User; token: string }>(`/api/users/${username}/auth`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  getBird: (username: string, birdId: number) =>
    jsonReq<Bird>(`/api/users/${username}/birds/${birdId}`),

  patchBird: (
    username: string,
    birdId: number,
    body: { discovered?: 0 | 1; field_notes?: string; cover_photo_id?: number | null }
  ) =>
    jsonReq<Bird>(`/api/users/${username}/birds/${birdId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  addFriend: (username: string, friendUsername: string) =>
    jsonReq<User[]>(`/api/users/${username}/friends`, {
      method: 'POST',
      body: JSON.stringify({ friendUsername }),
    }),

  removeFriend: (username: string, friendUsername: string) =>
    jsonReq<User[]>(`/api/users/${username}/friends/${friendUsername}`, {
      method: 'DELETE',
      body: JSON.stringify({}),
    }),

  uploadPhoto: async (
    username: string,
    birdId: number,
    uri: string,
    caption: string
  ): Promise<Photo> => {
    const form = new FormData();
    form.append('photo', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
    form.append('caption', caption);
    const res = await fetch(`${API_BASE}/api/users/${username}/birds/${birdId}/photos`, {
      method: 'POST',
      headers: authHeader(),
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string })?.error ?? `Upload failed: HTTP ${res.status}`);
    }
    return res.json();
  },

  deletePhoto: (username: string, birdId: number, photoId: number) =>
    fetch(`${API_BASE}/api/users/${username}/birds/${birdId}/photos/${photoId}`, {
      method: 'DELETE',
      headers: authHeader(),
    }),

  getQuizCategories: () =>
    jsonReq<string[]>('/api/quiz/categories'),

  getQuizList: (category: string, rarities: string[]) => {
    const params = new URLSearchParams({ category });
    for (const r of rarities) params.append('rarity', r);
    return jsonReq<{ id: number; name: string; category: string }[]>(`/api/quiz/list?${params}`);
  },

  getQuizQuestion: (birdId: number, category: string, mode: string) =>
    jsonReq<{
      media: { type: 'photo' | 'sound'; url: string; attribution: string; observationUrl: string };
      choices: string[];
      answer: string;
      category: string;
    }>(`/api/quiz?birdId=${birdId}&category=${encodeURIComponent(category)}&mode=${mode}`),
};
