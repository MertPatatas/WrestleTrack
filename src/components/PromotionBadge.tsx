import { StyleSheet, Text, View } from 'react-native';
import { promotions } from '../data/mock';
import type { PromotionId } from '../data/types';
import { colors, radius } from '../theme';

export function PromotionBadge({ id }: { id: PromotionId }) {
  const label = promotions.find((p) => p.id === id)?.short ?? id;
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { color: colors.bg, fontSize: 11, fontWeight: '800' },
});
