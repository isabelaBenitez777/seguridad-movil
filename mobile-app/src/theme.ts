import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#0f172a',
  card: '#1e293b',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#2563eb',
  danger: '#dc2626',
  error: '#f87171',
};

export const common = StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 14, justifyContent: 'center', backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 14 },
  error: { color: colors.error },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 8 },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    letterSpacing: 4,
  },
});
