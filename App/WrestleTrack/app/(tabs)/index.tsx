import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NewsCard } from '../../src/components/NewsCard';
import { SampleNotice } from '../../src/components/SampleNotice';
import { Screen } from '../../src/components/Screen';
import { ShowRow } from '../../src/components/ShowRow';
import { StorylineCard } from '../../src/components/StorylineCard';
import { news, shows, storylines } from '../../src/data/mock';
import { colors, spacing } from '../../src/theme';

function SectionHeader({ title, href }: { title: string; href: '/noticias' | '/storylines' | '/shows' }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Link href={href} style={styles.link}>
        Ver todo
      </Link>
    </View>
  );
}

export default function Home() {
  const now = Date.now();
  const upcoming = shows.filter((s) => new Date(s.startsAt).getTime() > now).slice(0, 3);

  return (
    <Screen title="Inicio">
      <ScrollView contentContainerStyle={styles.content}>
        <SampleNotice />

        <SectionHeader title="Próximos shows" href="/shows" />
        <View style={styles.list}>
          {upcoming.map((s) => (
            <ShowRow key={s.id} show={s} />
          ))}
        </View>

        <SectionHeader title="Últimas noticias" href="/noticias" />
        <View style={styles.list}>
          {news.slice(0, 2).map((n) => (
            <NewsCard key={n.id} item={n} />
          ))}
        </View>

        <SectionHeader title="Storylines en curso" href="/storylines" />
        <View style={styles.list}>
          {storylines.slice(0, 2).map((s) => (
            <StorylineCard key={s.id} item={s} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl * 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { color: colors.ivory, fontSize: 18, fontWeight: '700' },
  link: { color: colors.gold, fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
