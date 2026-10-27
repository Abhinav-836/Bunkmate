import { Tabs } from 'expo-router';
import React from 'react';
import { Icon, type IconName } from '@/components/ui';
import { useApp } from '@/context/AppContext';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Today', icon: 'today' },
  { name: 'attendance', title: 'Attendance', icon: 'fact-check' },
  { name: 'timetable', title: 'Timetable', icon: 'calendar-view-week' },
  { name: 'deadlines', title: 'Deadlines', icon: 'assignment' },
  { name: 'more', title: 'More', icon: 'grid-view' },
];

export default function TabLayout() {
  const { colors } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{ title: t.title, tabBarIcon: ({ color }) => <Icon name={t.icon} size={24} color={color} /> }}
        />
      ))}
    </Tabs>
  );
}