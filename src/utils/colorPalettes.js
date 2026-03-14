/**
 * 🎨 ATHLOS Color Palette System
 * Premium, harmonious color schemes for personalization
 * Each palette includes: background, cards, text, and accent colors
 */

export const COLOR_PALETTES = [
  {
    id: 'premium-dark',
    name: '🏆 Premium Dark',
    description: 'Classic Dark with Gold Accents',
    dark: '#0F0F0F',      // Charcoal black
    card: '#1A1A1A',      // Dark gray card backgrounds
    text: '#FFFFFF',      // White text
    accent: '#D4AF37',    // Gold accent
    secondary: '#2A2A2A', // Secondary dark
    gradient: 'from-amber-500 to-yellow-600',
  },
  {
    id: 'ocean-blue',
    name: '🌊 Ocean Blue',
    description: 'Deep Ocean with Azure Highlights',
    dark: '#0A1628',      // Deep navy
    card: '#0F2847',      // Ocean blue cards
    text: '#E8F0FF',      // Light blue-white
    accent: '#00D9FF',    // Cyan accent
    secondary: '#1A3A52', // Secondary blue
    gradient: 'from-cyan-400 to-blue-600',
  },
  {
    id: 'forest-green',
    name: '🌲 Forest Green',
    description: 'Natural Green with Earth Tones',
    dark: '#0B2E1B',      // Deep forest
    card: '#134F2D',      // Forest green cards
    text: '#E8F5E8',      // Light mint
    accent: '#4AFF6F',    // Bright lime
    secondary: '#1B5E3F', // Secondary green
    gradient: 'from-green-400 to-emerald-600',
  },
  {
    id: 'sunset-orange',
    name: '🌅 Sunset Orange',
    description: 'Warm Sunset with Fire Tones',
    dark: '#2B1500',      // Deep brown
    card: '#4A2A1A',      // Warm brown cards
    text: '#FFE8D1',      // Warm cream
    accent: '#FF7A45',    // Warm orange
    secondary: '#6B3A2A', // Secondary brown
    gradient: 'from-orange-400 to-red-600',
  },
  {
    id: 'amethyst-purple',
    name: '💎 Amethyst Purple',
    description: 'Royal Purple with Violet Accents',
    dark: '#1A0F33',      // Deep purple
    card: '#2D1B52',      // Purple cards
    text: '#F0E8FF',      // Light lavender
    accent: '#BB86FC',    // Bright purple
    secondary: '#3D2B6B', // Secondary purple
    gradient: 'from-purple-400 to-indigo-600',
  },
  {
    id: 'rose-gold',
    name: '✨ Rose Gold',
    description: 'Elegant Rose with Gold Shimmer',
    dark: '#2B1A1F',      // Deep rose
    card: '#3D2530',      // Rose cards
    text: '#FFF0F5',      // Light rose
    accent: '#F4A261',    // Rose gold
    secondary: '#5B354F', // Secondary rose
    gradient: 'from-rose-400 to-pink-600',
  },
  {
    id: 'cyber-neon',
    name: '⚡ Cyber Neon',
    description: 'Bold Neon with High Contrast',
    dark: '#0B0E27',      // Cyber black
    card: '#1A1F4D',      // Neon blue cards
    text: '#E0E8FF',      // Neon white
    accent: '#00FFFF',    // Bright cyan
    secondary: '#2A3F7F', // Secondary neon
    gradient: 'from-cyan-300 to-purple-600',
  },
  {
    id: 'mint-cool',
    name: '❄️ Mint Cool',
    description: 'Fresh Mint with Cool Blues',
    dark: '#0D2B2B',      // Teal black
    card: '#155E63',      // Teal cards
    text: '#E0F9F7',      // Mint white
    accent: '#2ECCC9',    // Bright mint
    secondary: '#235C62', // Secondary teal
    gradient: 'from-cyan-400 to-teal-600',
  },
  {
    id: 'blood-red',
    name: '🔥 Blood Red',
    description: 'Intense Red with Dark Edges',
    dark: '#2B0B0B',      // Deep red
    card: '#4D1515',      // Red cards
    text: '#FFE8E8',      // Light red
    accent: '#FF4444',    // Bright red
    secondary: '#6B2525', // Secondary red
    gradient: 'from-red-500 to-rose-700',
  },
];

/**
 * Get palette by ID
 */
export const getPaletteById = (id) => {
  return COLOR_PALETTES.find(p => p.id === id) || COLOR_PALETTES[0];
};

/**
 * Get all palette names for dropdown
 */
export const getPaletteOptions = () => {
  return COLOR_PALETTES.map(p => ({
    id: p.id,
    label: p.name,
    description: p.description,
  }));
};

/**
 * Convert palette to Tailwind-compatible structure
 */
export const getPaletteTailwind = (palette) => {
  return {
    bg: `[${palette.dark}]`,
    card: `[${palette.card}]`,
    text: `[${palette.text}]`,
    accent: `[${palette.accent}]`,
    secondary: `[${palette.secondary}]`,
  };
};

/**
 * Apply palette to entire document (CSS variables)
 */
export const applyPaletteGlobally = (palette) => {
  const root = document.documentElement;
  root.style.setProperty('--color-dark', palette.dark);
  root.style.setProperty('--color-card', palette.card);
  root.style.setProperty('--color-text', palette.text);
  root.style.setProperty('--color-accent', palette.accent);
  root.style.setProperty('--color-secondary', palette.secondary);
};
