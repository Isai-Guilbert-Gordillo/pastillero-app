// ─────────────────────────────────────────────────────────────────────────────
// PROTOTIPO — Pantalla de adherencia a medicamentos (mock estático de alta
// fidelidad). Réplica 1:1 del diseño de referencia: dark-mode azul profundo,
// acento violeta, tarjeta principal de cristal esmerilado con arte lineal de
// cápsula integrado, y barra de navegación inferior de tres destinos.
//
// Ruta de acceso: /prototype (exenta del guard de autenticación: es contenido
// estático sin datos de usuario).
// ─────────────────────────────────────────────────────────────────────────────

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Paleta del prototipo ────────────────────────────────────────────────────
const C = {
  bgTop: '#10142B',
  bgMid: '#0A0E1A',
  bgBottom: '#070A14',
  text: '#FFFFFF',
  textSoft: '#9CA3B8',
  textMuted: '#7C84A0',
  violet: '#8B5CF6',
  violetDeep: '#7C3AED',
  violetSoft: '#A78BFA',
  violetBorder: 'rgba(167, 139, 250, 0.35)',
  glass: 'rgba(255, 255, 255, 0.055)',
  listCard: 'rgba(17, 21, 38, 0.92)',
  listBorder: 'rgba(167, 139, 250, 0.22)',
  chipBg: 'rgba(139, 92, 246, 0.16)',
  dashedBorder: 'rgba(255, 255, 255, 0.14)',
  navBg: 'rgba(12, 16, 30, 0.94)',
} as const;

const FONT = {
  regular: 'Poppins_400Regular',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extraBold: 'Poppins_800ExtraBold',
} as const;

// ─── Barra de estado simulada (marco del mock) ───────────────────────────────
function StatusBarMock() {
  return (
    <View style={styles.statusBar}>
      <Text style={styles.statusTime}>12:48</Text>
      <View style={styles.statusRight}>
        <Ionicons name="cellular" size={13} color={C.text} />
        <Text style={styles.statusNetwork}>4G</Text>
        <Ionicons name="wifi" size={13} color={C.text} />
        <Ionicons name="battery-full" size={15} color={C.text} />
        <Text style={styles.statusBattery}>86%</Text>
      </View>
    </View>
  );
}

export default function PrototypeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <LinearGradient colors={[C.bgTop, C.bgMid, C.bgBottom]} style={StyleSheet.absoluteFill} />

      {/* Resplandores ambientales de fondo */}
      <View style={styles.glowTop} pointerEvents="none">
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.28)', 'rgba(139, 92, 246, 0)']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.glowBottom} pointerEvents="none">
        <LinearGradient
          colors={['rgba(124, 58, 237, 0.16)', 'rgba(124, 58, 237, 0)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6 }]}
        showsVerticalScrollIndicator={false}
      >
        <StatusBarMock />

        {/* ─── Encabezado: avatar · saludo · campana ─── */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={['#E9E2FF', '#CBB8FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Ionicons name="person" size={22} color="#6D28D9" />
            </LinearGradient>
          </View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greetingName}>Hola, Isai</Text>
            <Text style={styles.greetingDate}>viernes, 31 de julio</Text>
          </View>

          <View style={styles.bellCard}>
            <Ionicons name="notifications-outline" size={22} color="#C7C9E0" />
          </View>
        </View>

        {/* ─── Tarjeta principal: cristal con cápsula de línea ─── */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.pillArt} pointerEvents="none">
            <View style={styles.pill}>
              <View style={styles.pillDivider} />
              <View style={styles.pillTip} />
            </View>
          </View>

          <View style={styles.heroHeader}>
            <View style={styles.pendingChip}>
              <Ionicons name="time-outline" size={13} color={C.violetSoft} />
              <Text style={styles.pendingChipText}>Pendiente de confirmar</Text>
            </View>
            <Ionicons name="ellipsis-horizontal" size={20} color="#C7C9E0" />
          </View>

          <Text style={styles.heroName}>Paracetamol</Text>
          <Text style={styles.heroDose}>500 mg · 06:00</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ya la tomé"
            style={({ pressed }) => [styles.takeButton, pressed && styles.pressed]}
          >
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            <Text style={styles.takeButtonText}>Ya la tomé</Text>
          </Pressable>
        </View>

        {/* ─── Sección: TU MEDICAMENTO ─── */}
        <Text style={styles.sectionLabel}>TU MEDICAMENTO</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Paracetamol, detalle"
          style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={['#8B5CF6', '#6D28D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBox}
          >
            <Ionicons name="medical" size={26} color="#FFFFFF" />
          </LinearGradient>

          <View style={styles.medInfo}>
            <Text style={styles.medName}>Paracetamol</Text>
            <Text style={styles.medDetail}>500 mg · cada 12 h</Text>
            <View style={styles.nextChip}>
              <Ionicons name="time-outline" size={12} color={C.violetSoft} />
              <Text style={styles.nextChipText}>Próxima 18:00</Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
        </Pressable>

        {/* ─── Agregar medicamento (borde punteado) ─── */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar medicamento"
          style={({ pressed }) => [styles.addCard, pressed && styles.pressed]}
        >
          <View style={styles.plusBadge}>
            <Ionicons name="add" size={22} color={C.violetSoft} />
          </View>
          <Text style={styles.addText}>Agregar medicamento</Text>
        </Pressable>

        {/* ─── Espacio publicitario (borde punteado) ─── */}
        <View style={styles.adCard}>
          <Ionicons name="star-outline" size={18} color={C.textMuted} />
          <Text style={styles.adText}>Espacio publicitario</Text>
        </View>
      </ScrollView>

      {/* ─── Barra de navegación inferior ─── */}
      <View style={[styles.navBar, { paddingBottom: insets.bottom }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          accessibilityLabel="Inicio"
          style={styles.navItem}
          onPress={() => router.push('/(tabs)')}
        >
          <View style={styles.navIconActive}>
            <Ionicons name="home" size={24} color={C.violetSoft} />
          </View>
          <Text style={styles.navLabelActive}>Inicio</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: false }}
          accessibilityLabel="Historial"
          style={styles.navItem}
          onPress={() => router.push('/history')}
        >
          <Ionicons name="calendar-outline" size={24} color={C.textMuted} />
          <Text style={styles.navLabel}>Historial</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: false }}
          accessibilityLabel="Perfil"
          style={styles.navItem}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person-outline" size={24} color={C.textMuted} />
          <Text style={styles.navLabel}>Perfil</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Estilos del prototipo ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgBottom,
  },
  glowTop: {
    position: 'absolute',
    top: -140,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    overflow: 'hidden',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -120,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  // ─── Barra de estado simulada ───
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 22,
    marginBottom: 14,
  },
  statusTime: {
    fontFamily: FONT.semiBold,
    fontSize: 13,
    color: C.text,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusNetwork: {
    fontFamily: FONT.semiBold,
    fontSize: 12,
    color: C.text,
  },
  statusBattery: {
    fontFamily: FONT.semiBold,
    fontSize: 12,
    color: C.text,
  },
  // ─── Encabezado ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E9E2FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingBlock: {
    flex: 1,
    marginLeft: 14,
  },
  greetingName: {
    fontFamily: FONT.bold,
    fontSize: 24,
    lineHeight: 30,
    color: C.text,
  },
  greetingDate: {
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 20,
    color: C.textSoft,
  },
  bellCard: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(21, 26, 46, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  // ─── Tarjeta principal ───
  heroCard: {
    borderRadius: 28,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.violetBorder,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  // Arte lineal de la cápsula, integrado a la textura del cristal
  pillArt: {
    position: 'absolute',
    top: -26,
    right: -14,
    opacity: 0.9,
  },
  pill: {
    width: 64,
    height: 128,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-18deg' }],
  },
  pillDivider: {
    position: 'absolute',
    width: 1,
    height: 128,
    backgroundColor: 'rgba(167, 139, 250, 0.28)',
  },
  pillTip: {
    position: 'absolute',
    top: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.38)',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.chipBg,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  pendingChipText: {
    fontFamily: FONT.semiBold,
    fontSize: 13,
    color: C.violetSoft,
  },
  heroName: {
    fontFamily: FONT.extraBold,
    fontSize: 34,
    lineHeight: 42,
    color: C.text,
  },
  heroDose: {
    fontFamily: FONT.regular,
    fontSize: 16,
    lineHeight: 24,
    color: '#B9C0D4',
    marginTop: 2,
    marginBottom: 20,
  },
  takeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 56,
    borderRadius: 999,
    backgroundColor: C.violetDeep,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  takeButtonText: {
    fontFamily: FONT.bold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.88,
  },
  // ─── Sección ───
  sectionLabel: {
    fontFamily: FONT.semiBold,
    fontSize: 13,
    letterSpacing: 2.2,
    color: '#8A92A8',
    marginTop: 28,
    marginBottom: 12,
  },
  // ─── Tarjeta de medicamento ───
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.listCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.listBorder,
    padding: 14,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  medInfo: {
    flex: 1,
    marginLeft: 14,
  },
  medName: {
    fontFamily: FONT.semiBold,
    fontSize: 18,
    lineHeight: 24,
    color: C.text,
  },
  medDetail: {
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 20,
    color: C.textSoft,
    marginTop: 1,
  },
  nextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: C.chipBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  nextChipText: {
    fontFamily: FONT.semiBold,
    fontSize: 12,
    color: C.violetSoft,
  },
  // ─── Agregar ───
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(167, 139, 250, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginTop: 12,
  },
  plusBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addText: {
    fontFamily: FONT.semiBold,
    fontSize: 16,
    color: C.text,
  },
  // ─── Publicidad ───
  adCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.dashedBorder,
    marginTop: 12,
  },
  adText: {
    fontFamily: FONT.regular,
    fontSize: 14,
    color: C.textMuted,
  },
  // ─── Barra de navegación ───
  navBar: {
    flexDirection: 'row',
    backgroundColor: C.navBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 58,
  },
  navIconActive: {
    width: 46,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  navLabel: {
    fontFamily: FONT.semiBold,
    fontSize: 12,
    color: C.textMuted,
  },
  navLabelActive: {
    fontFamily: FONT.semiBold,
    fontSize: 12,
    color: C.violetSoft,
  },
});
