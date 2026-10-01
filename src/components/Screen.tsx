import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export function Wordmark() {
  return (
    <Text style={styles.wordmark}>
      <Text style={{ color: colors.ivory }}>Wrestle</Text>
      <Text style={{ color: colors.gold }}>Track</Text>
    </Text>
  );
}

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Wordmark />
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  wordmark: { fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  title: {
    color: colors.ivory,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  body: { flex: 1 },
});
