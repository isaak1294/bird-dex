export type ThemeColors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  border: string;
  sidebar: string;
  sidebarBorder: string;
  accent: string;
  accentDark: string;
  gold: string;
  success: string;
  successLight: string;
  successBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  header: string;
  tabBar: string;
  tabBorder: string;
};

export const LIGHT: ThemeColors = {
  bg:            '#d8eaf5',
  surface:       '#ffffff',
  surfaceAlt:    '#eaf3fa',
  card:          '#f4f9fd',
  border:        '#b8d0e4',
  sidebar:       '#c8dced',
  sidebarBorder: '#aec8dc',
  accent:        '#cc0000',
  accentDark:    '#990000',
  gold:          '#8a6200',
  success:       '#16a34a',
  successLight:  '#edfaf3',
  successBorder: '#86efac',
  text:          '#1a2f40',
  textSecondary: '#527080',
  textMuted:     '#90aab8',
  header:        '#0d1e2e',
  tabBar:        '#ffffff',
  tabBorder:     '#ccdde8',
};

export const DARK: ThemeColors = {
  bg:            '#0a1520',
  surface:       '#111e2d',
  surfaceAlt:    '#162030',
  card:          '#1a2840',
  border:        '#1e3048',
  sidebar:       '#0e1a28',
  sidebarBorder: '#1a2d42',
  accent:        '#cc3333',
  accentDark:    '#992222',
  gold:          '#d4a820',
  success:       '#27a060',
  successLight:  '#0d2820',
  successBorder: '#1e6040',
  text:          '#d8eaf8',
  textSecondary: '#7aa0c0',
  textMuted:     '#3a6080',
  header:        '#060c14',
  tabBar:        '#0d1828',
  tabBorder:     '#182840',
};

// Legacy alias kept for any stray references
export const COLORS = LIGHT;

export const RARITY = {
  common:    { bg: '#16a34a', color: '#ffffff', label: 'Common' },
  uncommon:  { bg: '#ca8a04', color: '#ffffff', label: 'Uncommon' },
  rare:      { bg: '#2563eb', color: '#ffffff', label: 'Rare' },
  epic:      { bg: '#7c3aed', color: '#ffffff', label: 'Epic' },
  legendary: { bg: '#92400e', color: '#fef3c7', label: 'Legendary' },
} as const;

export function getRarity(frequency: number | null) {
  if (frequency === null) return null;
  if (frequency > 10)  return 'common'    as const;
  if (frequency > 3)   return 'uncommon'  as const;
  if (frequency > 1)   return 'rare'      as const;
  if (frequency > 0.1) return 'epic'      as const;
  return 'legendary' as const;
}

export function padId(id: number) {
  return String(id).padStart(3, '0');
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const REGIONS: Record<string, { label: string; species: number }> = {
  BC: { label: 'British Columbia', species: 564 },
  SK: { label: 'Saskatchewan',     species: 410 },
};
