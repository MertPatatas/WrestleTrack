import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { colors } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Inicio', icon: 'home-outline' },
  { name: 'noticias', title: 'Noticias', icon: 'newspaper-outline' },
  { name: 'storylines', title: 'Storylines', icon: 'git-network-outline' },
  { name: 'shows', title: 'Shows', icon: 'calendar-outline' },
  { name: 'perfil', title: 'Perfil', icon: 'person-outline' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.silver,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
