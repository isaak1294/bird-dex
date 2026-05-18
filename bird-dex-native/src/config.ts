export const API_BASE = 'https://bird.jimmer.dev';

export function resolveUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}
