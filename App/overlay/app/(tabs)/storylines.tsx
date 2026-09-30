import { useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { FilterChips, type Filter } from '../../src/components/FilterChips';
import { SampleNotice } from '../../src/components/SampleNotice';
import { Screen } from '../../src/components/Screen';
import { StorylineCard } from '../../src/components/StorylineCard';
import { storylines } from '../../src/data/mock';
import { colors, spacing } from '../../src/theme';

export default function Storylines() {
  const [filter, setFilter] = useState<Filter>('all');
  const items = filter === 'all' ? storylines : storylines.filter((s) => s.promotion === filter);

  return (
    <Screen title="Storylines">
      <SampleNotice />
      <FilterChips value={filter} onChange={setFilter} />
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <StorylineCard item={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <Text style={styles.gap} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Todavía no seguimos storylines de esta promoción.</Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  gap: { height: spacing.md },
  empty: { color: colors.silver, textAlign: 'center', paddingTop: spacing.xl },
});
