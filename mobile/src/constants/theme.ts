export const colors = {
  bg: {
    primary: '#0a0f1a',
    secondary: '#111827',
    card: '#1a2332',
    input: '#141c2b',
    elevated: '#1e2a3a',
    overlay: 'rgba(0,0,0,0.6)',
  },
  border: {
    default: '#2a3545',
    subtle: '#1a2332',
    focus: '#14b8a6',
    divider: '#1e293b',
  },
  text: {
    primary: '#f1f5f9',
    secondary: '#8b9bb5',
    muted: '#5a6a80',
    inverse: '#0a0f1a',
    heading: '#ffffff',
  },
  brand: {
    teal: '#14b8a6',
    tealDark: '#0d9488',
    tealLight: '#2dd4bf',
    gradient: ['#14b8a6', '#0ea5e9'] as readonly string[],
  },
  accent: {
    coral: '#ff6b6b',
    amber: '#f59e0b',
    purple: '#8b5cf6',
    blue: '#3b82f6',
  },
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  tier: {
    new: '#6b7280',
    standard: '#3b82f6',
    elite: '#8b5cf6',
    top_hustler: '#f59e0b',
  },
  category: {
    cleaning: '#14b8a6',
    moving: '#3b82f6',
    organizing: '#8b5cf6',
    rush: '#ef4444',
    sameDay: '#ff6b6b',
    default: '#2a3545',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 28,
  xxl: 40,
  xxxl: 56,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading3: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0.1 },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const, letterSpacing: 0.1 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, letterSpacing: 0.1 },
  caption: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.2 },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 1.0, textTransform: 'uppercase' as const },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  button: {
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const layout = {
  screenPadding: 20,
  cardPadding: 18,
  sectionGap: 16,
  sidebarWidth: 260,
  maxContentWidth: 1200,
  tabBarHeight: { ios: 84, android: 64, web: 60 },
  headerHeight: 56,
  buttonHeight: { default: 52, large: 56 },
} as const;

/** Get the left-border accent color for a job card based on urgency */
export function getCategoryBorderColor(urgencyLevel?: string): string {
  switch (urgencyLevel) {
    case 'same_day': return colors.category.sameDay;
    case 'rush': return colors.category.rush;
    default: return colors.category.default;
  }
}
