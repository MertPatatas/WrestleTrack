import { StyleSheet, Text, View } from 'react-native';
import type { Show } from '../data/types';
import { showDateParts } from '../lib/dates';
import { colors, radius, spacing } from '../theme';
import { PromotionBadge } from './PromotionBadge';

export function ShowRow({ show }: { show: Show }) {
  const { day, month, time } = showDateParts(show.startsAt);
  return (
    <View style={styles.row}>
      <View style={styles.date}>
        <Text style={styles.month}>{month}</Text>
        <Text style={styles.day}>{day}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{show.name}</Text>
        <Text style={styles.time}>{show.venue ? `${show.venue} · ${time}` : time}</Text>
      </View>
      <PromotionBadge id={show.promotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.md,
  },
  date: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  month: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  day: { color: colors.ivory, fontSize: 22, fontWeight: '800' },
  info: { flex: 1, gap: 2 },
  name: { color: colors.ivory, fontSize: 16, fontWeight: '700' },
  time: { color: colors.silver, fontSize: 13 },
});
