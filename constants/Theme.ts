export const Palette = {
  background: '#FDFCF8', // Ivory Paper
  text: '#1A1A1A',
  textMuted: '#666666',
  accent: '#7D8C69', // Muted Sage
  accentLight: '#DAD7CD',
  border: '#EBE9E1',
  surface: 'rgba(255, 255, 255, 0.9)', // Glassy surface
  glass: 'rgba(255, 255, 255, 0.7)',
  shadow: 'rgba(0,0,0,0.06)',
  ink: '#344E41',
  paper: '#F5F2E8',
  white: '#FFFFFF',
};

export const Theme = {
  colors: Palette,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 28,
    full: 9999,
  },
  typography: {
    family: {
      serif: 'Serif', 
      sans: 'Sans',
    },
    size: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 28,
      xxl: 44,
    },
    weight: {
      light: '300' as const,
      regular: '400' as const,
      medium: '500' as const,
      bold: '700' as const,
    }
  }
};
