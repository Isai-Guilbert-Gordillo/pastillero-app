import { Tabs } from 'expo-router';
import React from 'react';
import NavigationBar from '@/components/ui/NavigationBar';

// ─────────────────────────────────────────────────────────────────────────────
// Tres destinos. "Agregar" ya no vive aquí — es la acción principal de Inicio
// (FAB extendido → /add). Ver components/ui/NavigationBar.tsx.
// ─────────────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <NavigationBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="history" options={{ title: 'Historial' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
