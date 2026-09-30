import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { promotions } from '../data/mock';
import type { PromotionId } from '../data/types';
import { colors, radius, spacing } from '../theme';

export type Filter = PromotionId | 'all';

export function FilterChips({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (next: Filter) => void;
}) {
  const options: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    ...promotions.map((p) => ({ id: p.id as Filter, label: p.name })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  label: { color: colors.silver, fontWeight: '600' },
  labelActive: { color: colors.bg },
});
