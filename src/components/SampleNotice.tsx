import { StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

// Quitar cuando los datos sean reales.
export function SampleNotice() {
  return <Text style={styles.text}>Datos de ejemplo. Los reales llegarán con el backend.</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: colors.muted,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
