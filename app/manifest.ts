import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Isaak's BC BirdDex",
    short_name: 'BirdDex',
    description: 'Personal field guide to British Columbia birds',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0f7ff',
    theme_color: '#c0392b',
    icons: [
      { src: '/cover.png', sizes: 'any', type: 'image/png', purpose: 'any' },
      { src: '/cover.png', sizes: 'any', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
