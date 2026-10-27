export const Colors = {
  light: {
    primary: '#4F46E5',
    primarySoft: '#EEF2FF',
    background: '#F6F7FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F3F9',
    text: '#0F172A',
    textSecondary: '#5B6475',
    textTertiary: '#98A1B2',
    border: '#E4E7EE',
    success: '#059669',
    successSoft: '#ECFDF5',
    warning: '#B45309',
    warningSoft: '#FFFBEB',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
    onPrimary: '#FFFFFF',
    overlay: 'rgba(15, 23, 42, 0.45)',
  },
  dark: {
    primary: '#818CF8',
    primarySoft: '#1E1B4B',
    background: '#0B1120',
    surface: '#151C2E',
    surfaceAlt: '#1D2539',
    text: '#F1F5F9',
    textSecondary: '#A3AEC2',
    textTertiary: '#6B768C',
    border: '#263049',
    success: '#34D399',
    successSoft: '#052E22',
    warning: '#FBBF24',
    warningSoft: '#2B2008',
    danger: '#F87171',
    dangerSoft: '#2D1215',
    onPrimary: '#0B1120',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
};

export type Palette = typeof Colors.light;

/** Colours offered for subjects. Chosen to stay readable on both themes. */
export const SubjectColors = [
  '#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#64748B',
];

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const Radius = { sm: 8, md: 12, lg: 16, xl: 22, round: 999 };

export const Type = {
  title: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14 },
  stat: { fontSize: 34, fontWeight: '800' as const, lineHeight: 40 },
};