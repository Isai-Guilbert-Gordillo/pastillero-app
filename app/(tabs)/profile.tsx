import { useFeedback } from '@/components/Feedback';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import IconBadge from '@/components/ui/IconBadge';
import ListItem, { ListDivider } from '@/components/ui/ListItem';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import TextField from '@/components/ui/TextField';
import TopAppBar from '@/components/ui/TopAppBar';
import { useAuth } from '@/context/AuthContext';
import { useCaregiver } from '@/context/CaregiverContext';
import { ThemePreference, useTheme, useThemedStyles } from '@/context/ThemeContext';
import { LINKS } from '@/lib/links';
import { cancelAllNotifications } from '@/lib/notifications';
import {
    ColorScheme,
    SCREEN_MARGIN,
    SHAPE,
    SPACING,
    STATE_LAYER,
    TOUCH,
    withAlpha,
} from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    View,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Perfil.
//
// Antes eran nueve tarjetas blancas seguidas bajo un encabezado con degradado y
// un avatar de 100px: la versión de la app y "quién te está cuidando" pesaban
// exactamente lo mismo. Ahora hay grupos con encabezado —Mi cuenta, Apariencia,
// Cuidado compartido, Alarmas, Acerca de— y dentro de cada grupo, filas de lista
// que no se disfrazan de decisiones.
//
// "Apariencia" es nueva: el modo oscuro no se puede dejar solo al ajuste del
// sistema cuando el público son personas de 80 años que no saben dónde está ese
// ajuste, ni que existe.
// ─────────────────────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const {
    activePatientId,
    isViewingOther,
    linkedPatients,
    myCaregivers,
    pendingInviteCode,
    loadingLinks,
    switchToSelf,
    switchToPatient,
    createInvite,
    redeemInvite,
    removeCaregiver,
    leavePatient,
  } = useCaregiver();
  const { scheme, preference, setPreference } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { alert, snack } = useFeedback();

  const [redeemCode, setRedeemCode] = useState('');
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const fullName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const userName = fullName || user?.email?.split('@')[0] || 'Usuario';
  const initial = userName.charAt(0).toUpperCase();

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    const { code, error } = await createInvite();
    setGeneratingInvite(false);
    if (error || !code) {
      snack(error ?? 'No se pudo generar el código. Revisa tu conexión.', { tone: 'error' });
      return;
    }
    Share.share({
      message: `Te invito a ayudarme en PastilleroApp. Abre la app, ve a Perfil → "Tengo un código de invitación" y escribe: ${code}`,
    }).catch(() => {});
  };

  const handleRedeemInvite = async () => {
    if (!redeemCode.trim()) {
      setRedeemError('Escribe el código de 6 letras que te compartieron.');
      return;
    }
    setRedeemError(null);
    setRedeeming(true);
    const { patientEmail, error } = await redeemInvite(redeemCode);
    setRedeeming(false);
    if (error) {
      setRedeemError(error);
      return;
    }
    setRedeemCode('');
    snack(`Listo. Ya puedes administrar la cuenta de ${patientEmail}.`, { tone: 'success' });
  };

  const handleRemoveCaregiver = (linkId: string, email: string) => {
    alert('Quitar acceso', `${email} ya no podrá ver ni administrar tu cuenta.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar acceso', style: 'destructive', onPress: () => removeCaregiver(linkId) },
    ]);
  };

  const handleLeavePatient = (patientId: string, email: string) => {
    alert('Dejar de cuidar esta cuenta', `Ya no vas a ver ni administrar la cuenta de ${email}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Dejar de cuidar', style: 'destructive', onPress: () => leavePatient(patientId) },
    ]);
  };

  const handleSignOut = () => {
    alert(
      'Cerrar sesión',
      'Las alarmas de este teléfono se van a apagar hasta que vuelvas a entrar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await cancelAllNotifications();
            await signOut();
          },
        },
      ]
    );
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 4 !== scrolled) setScrolled(y > 4);
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <View style={styles.container}>
      <TopAppBar title="Perfil" scrolled={scrolled} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={32}
        // Ni el inset inferior ni el alto de la barra de navegación: el área de
        // una pestaña ya termina arriba de la barra, y la barra ya absorbe el
        // inset. Sumarlos aquí dejaba ~104dp de espacio muerto al final.
        contentContainerStyle={[styles.scroll, { paddingBottom: SPACING.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Identidad ─── */}
        <Surface level={1} padded style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: scheme.primaryContainer }]}>
            <Text variant="headlineMedium" tone="onPrimaryContainer">
              {initial}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text variant="titleLarge" numberOfLines={1}>
              {userName}
            </Text>
            <Text variant="bodySmall" tone="variant" numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
          </View>
        </Surface>

        {/* ─── Mi cuenta ─── */}
        <Text variant="labelMedium" tone="variant" style={styles.sectionLabel}>
          MI CUENTA
        </Text>
        <Surface level={1} padded>
          <ListItem
            leading={<IconBadge name="mail" color={scheme.primary} backgroundColor={scheme.primaryContainer} size={48} />}
            overline="Correo electrónico"
            headline={user?.email ?? '—'}
          />
          <ListDivider />
          <ListItem
            leading={<IconBadge name="calendar" color={scheme.secondary} backgroundColor={scheme.secondaryContainer} size={48} />}
            overline="Miembro desde"
            headline={memberSince}
          />
        </Surface>

        {/* ─── Apariencia ─── */}
        <Text variant="labelMedium" tone="variant" style={styles.sectionLabel}>
          APARIENCIA
        </Text>
        <Surface level={1} padded>
          <Text variant="titleSmall">Modo de color</Text>
          <Text variant="bodySmall" tone="variant" style={styles.sectionHint}>
            &quot;Automático&quot; sigue el ajuste de tu teléfono. El modo oscuro cansa menos la vista
            de noche, cuando suena una alarma.
          </Text>
          <View style={styles.chipRow}>
            {THEME_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={preference === opt.value}
                onPress={() => setPreference(opt.value)}
              />
            ))}
          </View>
        </Surface>

        {/* ─── Cuidado compartido ─── */}
        <Text variant="labelMedium" tone="variant" style={styles.sectionLabel}>
          CUIDADO COMPARTIDO
        </Text>

        {!loadingLinks && linkedPatients.length > 0 && (
          <Surface level={1} padded style={styles.group}>
            <Text variant="titleSmall">Cuentas que cuidas</Text>
            {isViewingOther && (
              <Text variant="bodySmall" tone="variant" style={styles.sectionHint}>
                Estás viendo una cuenta que no es la tuya. Lo que agregues o cambies aquí no va a
                sonar en ese teléfono hasta que esa persona abra la app.
              </Text>
            )}
            {linkedPatients.map((p, index) => {
              const isActive = activePatientId === p.patientId;
              return (
                <View key={p.patientId}>
                  {index > 0 && <ListDivider inset={false} />}
                  <View style={styles.linkRow}>
                    <View style={styles.linkInfo}>
                      <Text variant="titleSmall" numberOfLines={1}>
                        {p.patientEmail}
                      </Text>
                      {isActive && (
                        <Text variant="labelSmall" tone="secondary">
                          Viendo esta cuenta
                        </Text>
                      )}
                    </View>
                    <Button
                      title={isActive ? 'Salir' : 'Ver'}
                      variant={isActive ? 'outlined' : 'tonal'}
                      fullWidth={false}
                      onPress={() => (isActive ? switchToSelf() : switchToPatient(p.patientId, p.patientEmail))}
                      style={styles.linkButton}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Dejar de cuidar la cuenta de ${p.patientEmail}`}
                      onPress={() => handleLeavePatient(p.patientId, p.patientEmail)}
                      style={({ pressed }) => [
                        styles.iconAction,
                        pressed && { backgroundColor: withAlpha(scheme.error, STATE_LAYER.pressed) },
                      ]}
                    >
                      <Ionicons name="close-circle-outline" size={26} color={scheme.error} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </Surface>
        )}

        <Surface level={1} padded style={styles.group}>
          <Text variant="titleSmall">Tengo un código de invitación</Text>
          <Text variant="bodySmall" tone="variant" style={styles.sectionHint}>
            Alguien te compartió un código para que le ayudes con sus medicamentos.
          </Text>
          <TextField
            label="Código"
            placeholder="AB12CD"
            value={redeemCode}
            onChangeText={(t) => {
              setRedeemCode(t.toUpperCase());
              if (redeemError) setRedeemError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            editable={!redeeming}
            error={redeemError}
          />
          <Button
            title="Vincular cuenta"
            icon="link"
            variant="tonal"
            loading={redeeming}
            onPress={handleRedeemInvite}
            style={styles.groupAction}
          />
        </Surface>

        <Surface level={1} padded style={styles.group}>
          <Text variant="titleSmall">Invita a alguien para que te ayude</Text>
          <Text variant="bodySmall" tone="variant" style={styles.sectionHint}>
            Genera un código y compártelo con un familiar. Va a poder ver y administrar tus
            medicamentos como si fueras tú.
          </Text>

          {pendingInviteCode && (
            <View style={[styles.codeBox, { backgroundColor: scheme.primaryContainer }]}>
              <Text variant="labelSmall" tone="onPrimaryContainer">
                CÓDIGO SIN USAR
              </Text>
              <Text variant="displaySmall" tone="onPrimaryContainer" style={styles.codeValue}>
                {pendingInviteCode}
              </Text>
            </View>
          )}

          <Button
            title={pendingInviteCode ? 'Generar otro código' : 'Generar código'}
            icon="share-social"
            variant="tonal"
            loading={generatingInvite}
            onPress={handleGenerateInvite}
            style={styles.groupAction}
          />

          {!loadingLinks && myCaregivers.length > 0 && (
            <>
              <View style={[styles.separator, { backgroundColor: scheme.outlineVariant }]} />
              <Text variant="titleSmall">Quién te está cuidando</Text>
              {myCaregivers.map((c) => (
                <View key={c.linkId} style={styles.linkRow}>
                  <Text variant="bodyMedium" style={styles.linkInfo} numberOfLines={1}>
                    {c.caregiverEmail}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Quitarle el acceso a ${c.caregiverEmail}`}
                    onPress={() => handleRemoveCaregiver(c.linkId, c.caregiverEmail)}
                    style={({ pressed }) => [
                      styles.iconAction,
                      pressed && { backgroundColor: withAlpha(scheme.error, STATE_LAYER.pressed) },
                    ]}
                  >
                    <Ionicons name="close-circle-outline" size={26} color={scheme.error} />
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </Surface>

        {/* ─── Alarmas ─── */}
        {Platform.OS === 'android' && (
          <>
            <Text variant="labelMedium" tone="variant" style={styles.sectionLabel}>
              ALARMAS
            </Text>
            <Surface level={1} padded>
              <ListItem
                leading={
                  <IconBadge
                    name="shield-checkmark"
                    color={scheme.onWarningContainer}
                    backgroundColor={scheme.warningContainer}
                    size={48}
                  />
                }
                headline="Permisos del teléfono"
                supporting="Revisa que nada esté bloqueando las alarmas"
                onPress={() => router.push('/permissions-guide' as any)}
                navigates
              />
            </Surface>
          </>
        )}

        {/* ─── Acerca de ─── */}
        <Text variant="labelMedium" tone="variant" style={styles.sectionLabel}>
          ACERCA DE
        </Text>
        <Surface level={1} padded>
          <ListItem
            leading={
              <IconBadge
                name="medical"
                color={scheme.onTertiaryContainer}
                backgroundColor={scheme.tertiaryContainer}
                size={48}
              />
            }
            headline="PastilleroApp"
            supporting="Tu recordatorio de medicamentos · versión 1.0.0"
          />
          <ListDivider />
          <ListItem
            leading={
              <IconBadge
                name="lock-closed"
                color={scheme.secondary}
                backgroundColor={scheme.secondaryContainer}
                size={48}
              />
            }
            headline="Política de privacidad"
            supporting="Qué datos guardamos y con quién se comparten"
            onPress={() => WebBrowser.openBrowserAsync(LINKS.privacidad).catch(() => {})}
            navigates
          />
          <ListDivider />
          <ListItem
            leading={
              <IconBadge
                name="document-text"
                color={scheme.onSurfaceVariant}
                backgroundColor={scheme.surfaceContainer}
                size={48}
              />
            }
            headline="Términos de uso"
            supporting="Qué hace la app, qué no hace y sus límites"
            onPress={() => WebBrowser.openBrowserAsync(LINKS.terminos).catch(() => {})}
            navigates
          />
        </Surface>

        <Button
          title="Cerrar sesión"
          icon="log-out-outline"
          variant="destructive"
          onPress={handleSignOut}
          style={styles.signOut}
        />

        {/* Eliminar la cuenta va aparte y en texto, no como botón rojo: es la
            única acción irreversible de la app y no debe competir visualmente
            con "Cerrar sesión", que es lo que casi siempre se busca aquí. */}
        <Button
          title="Eliminar mi cuenta"
          variant="text"
          onPress={() => router.push('/delete-account' as any)}
          style={styles.deleteAccount}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    scroll: {
      paddingHorizontal: SCREEN_MARGIN,
    },
    // ─── Identidad ───
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      padding: SPACING.lg,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: SHAPE.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    identityText: {
      flex: 1,
    },
    // ─── Secciones ───
    sectionLabel: {
      marginTop: SPACING.xxl,
      marginBottom: SPACING.md,
    },
    sectionHint: {
      marginTop: SPACING.xs,
      marginBottom: SPACING.md,
    },
    group: {
      marginBottom: SPACING.md,
    },
    groupAction: {
      marginTop: SPACING.lg,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    separator: {
      height: 1,
      marginVertical: SPACING.xl,
    },
    // ─── Vínculos de cuidado ───
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minHeight: TOUCH.min,
      paddingVertical: SPACING.sm,
    },
    linkInfo: {
      flex: 1,
    },
    linkButton: {
      minWidth: 96,
    },
    iconAction: {
      width: 56,
      height: 56,
      borderRadius: SHAPE.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // ─── Código de invitación ───
    codeBox: {
      alignItems: 'center',
      borderRadius: SHAPE.medium,
      paddingVertical: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    codeValue: {
      letterSpacing: 6,
      marginTop: SPACING.xs,
    },
    signOut: {
      marginTop: SPACING.xxxl,
    },
    deleteAccount: {
      marginTop: SPACING.sm,
    },
  });
