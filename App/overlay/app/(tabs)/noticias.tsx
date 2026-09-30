import { useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { FilterChips, type Filter } from '../../src/components/FilterChips';
import { NewsCard } from '../../src/components/NewsCard';
import { SampleNotice } from '../../src/components/SampleNotice';
import { Screen } from '../../src/components/Screen';
import { news } from '../../src/data/mock';
import { colors, spacing } from '../../src/theme';

export default function Noticias() {
  const [filter, setFilter] = useState<Filter>('all');
  const items = filter === 'all' ? news : news.filter((n) => n.promotion === filter);

  return (
    <Screen title="Noticias">
      <SampleNotice />
      <FilterChips value={filter} onChange={setFilter} />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NewsCard item={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <Text style={styles.gap} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No hay noticias de esta promoción por ahora.</Text>
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
