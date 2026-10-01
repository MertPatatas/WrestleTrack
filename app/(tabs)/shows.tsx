import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FilterChips, type Filter } from '../../src/components/FilterChips';
import { SampleNotice } from '../../src/components/SampleNotice';
import { Screen } from '../../src/components/Screen';
import { ShowRow } from '../../src/components/ShowRow';
import { shows } from '../../src/data/mock';
import { deviceTimeZone } from '../../src/lib/dates';
import { colors, radius, spacing } from '../../src/theme';

type Tab = 'upcoming' | 'past';

export default function Shows() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [filter, setFilter] = useState<Filter>('all');

  const now = Date.now();
  const items = shows
    .filter((s) => (filter === 'all' ? true : s.promotion === filter))
    .filter((s) => {
      const isFuture = new Date(s.startsAt).getTime() > now;
      return tab === 'upcoming' ? isFuture : !isFuture;
    });
  if (tab === 'past') items.reverse();

  return (
    <Screen title="Calendario de shows">
      <SampleNotice />
      <View style={styles.segment}>
        {(['upcoming', 'past'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t }}
            style={[styles.segmentItem, tab === t && styles.segmentActive]}
          >
            <Text style={[styles.segmentLabel, tab === t && styles.segmentLabelActive]}>
              {t === 'upcoming' ? 'Próximos' : 'Pasados'}
            </Text>
          </Pressable>
        ))}
      </View>
      <FilterChips value={filter} onChange={setFilter} />
      <Text style={styles.tz}>Horas en tu zona horaria ({deviceTimeZone()})</Text>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <ShowRow show={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={<Text style={styles.empty}>No hay shows en esta lista.</Text>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.gold },
  segmentLabel: { color: colors.silver, fontWeight: '700' },
  segmentLabelActive: { color: colors.bg },
  tz: { color: colors.muted, fontSize: 12, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  gap: { height: spacing.sm },
  empty: { color: colors.silver, textAlign: 'center', paddingTop: spacing.xl },
});
