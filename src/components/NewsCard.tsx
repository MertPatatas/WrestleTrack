import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NewsItem } from '../data/types';
import { timeAgo } from '../lib/dates';
import { colors, radius, spacing } from '../theme';
import { PromotionBadge } from './PromotionBadge';

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(item.url)}
      accessibilityRole="link"
      style={styles.card}
    >
      <View style={styles.meta}>
        <PromotionBadge id={item.promotion} />
        <Text style={styles.time}>{timeAgo(item.publishedAt)}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.excerpt}>{item.excerpt}</Text>
      <Text style={styles.source}>{item.source}</Text>
    </Pressable>
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
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { color: colors.muted, fontSize: 12 },
  title: { color: colors.ivory, fontSize: 17, fontWeight: '700' },
  excerpt: { color: colors.silver, fontSize: 14, lineHeight: 20 },
  source: { color: colors.muted, fontSize: 12 },
});
