import { StyleSheet, Text, View } from 'react-native';
import type { Storyline } from '../data/types';
import { timeAgo } from '../lib/dates';
import { colors, radius, spacing } from '../theme';
import { PromotionBadge } from './PromotionBadge';

export function StorylineCard({ item }: { item: Storyline }) {
  const last = item.updates[0];
  return (
    <View style={styles.card}>
      <View style={styles.meta}>
        <PromotionBadge id={item.promotion} />
        <Text style={styles.status}>{item.status === 'en_curso' ? 'En curso' : 'Cerrada'}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
      {last ? (
        <View style={styles.update}>
          <Text style={[styles.verdict, { color: last.advanced ? colors.success : colors.muted }]}>
            {last.advanced ? `Avanzó en ${last.showName}` : `Sin avance en ${last.showName}`}
            {' · '}
            {timeAgo(last.date)}
          </Text>
          <Text style={styles.summary}>{last.summary}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  title: { color: colors.ivory, fontSize: 17, fontWeight: '700' },
  subtitle: { color: colors.silver, fontSize: 14 },
  update: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  verdict: { fontSize: 13, fontWeight: '700' },
  summary: { color: colors.silver, fontSize: 14, lineHeight: 20 },
});
