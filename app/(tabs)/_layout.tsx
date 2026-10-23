import { Tabs } from 'expo-router';
import React from 'react';
import NavigationBar from '@/components/ui/NavigationBar';
import { useCaregiver } from '@/context/CaregiverContext';

// ─────────────────────────────────────────────────────────────────────────────
// Tres destinos, o cuatro si cuidas a alguien. "Agregar" ya no vive aquí — es
// la acción principal de Inicio (FAB extendido → /add).
//
// "Familia" aparece solo cuando hay pacientes vinculados (`href: null` la saca
// de la barra). Es un trabajo distinto y recurrente —"¿se la tomó mi mamá?"—
// y merece su lugar; pero para quien no cuida a nadie, la app no cambia en
// nada. Una cuarta pestaña vacía sería peor que no tenerla.
// ─────────────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { linkedPatients } = useCaregiver();
  const cuidaAAlguien = linkedPatients.length > 0;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <NavigationBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen
        name="care"
        // `undefined` = su ruta normal; `null` la saca de la barra.
        options={{ title: 'Familia', href: cuidaAAlguien ? undefined : null }}
      />
      <Tabs.Screen name="history" options={{ title: 'Historial' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
