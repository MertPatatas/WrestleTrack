import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { promotions } from '../../src/data/mock';
import type { PromotionId } from '../../src/data/types';
import { deviceTimeZone } from '../../src/lib/dates';
import { colors, radius, spacing } from '../../src/theme';

export default function Perfil() {
  // Solo estado local por ahora; se guardará en el dispositivo/backend más adelante.
  const [favorites, setFavorites] = useState<Record<PromotionId, boolean>>({
    wwe: true,
    aew: true,
    cmll: true,
    aaa: true,
    njpw: true,
    other: true,
  });

  return (
    <Screen title="Perfil">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Promociones que sigo</Text>
        <View style={styles.card}>
          {promotions.map((p, i) => (
            <View key={p.id} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.label}>{p.name}</Text>
              <Switch
                value={favorites[p.id]}
                onValueChange={(v) => setFavorites((f) => ({ ...f, [p.id]: v }))}
                trackColor={{ true: colors.gold, false: colors.line }}
                thumbColor={colors.ivory}
              />
            </View>
          ))}
        </View>

        <Text style={styles.section}>Zona horaria</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{deviceTimeZone()}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.sm },
  section: { color: colors.silver, fontSize: 14, fontWeight: '600', marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  label: { color: colors.ivory, fontSize: 16 },
});
