export const colors = {
  bg: {
    primary: '#0f1b2d',
    card: '#1e293b',
    input: '#1e293b',
    elevated: '#253448',
  },
  border: {
    default: '#334155',
    subtle: '#1e293b',
    focus: '#14b8a6',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    muted: '#64748b',
    inverse: '#0f172a',
  },
  brand: {
    teal: '#14b8a6',
    tealDark: '#0d9488',
    tealLight: '#2dd4bf',
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
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  heading1: { fontSize: 28, fontWeight: '800' as const },
  heading2: { fontSize: 22, fontWeight: '800' as const },
  heading3: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '700' as const },
  caption: { fontSize: 13, fontWeight: '600' as const },
  micro: { fontSize: 11, fontWeight: '600' as const },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
