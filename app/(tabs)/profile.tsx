import { useAppAlert } from '@/components/AppAlert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import { useAuth } from '@/context/AuthContext';
import { useCaregiver } from '@/context/CaregiverContext';
import { cancelAllNotifications } from '@/lib/notifications';
import { BORDER_RADIUS, COLORS, FONTS, GRADIENTS, SPACING, TOUCH_TARGET } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

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
  const router = useRouter();
  const { alert } = useAppAlert();

  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const fullName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const userName = fullName || user?.email?.split('@')[0] || 'Usuario';

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    const { code, error } = await createInvite();
    setGeneratingInvite(false);
    if (error || !code) {
      alert('Error', error ?? 'No se pudo generar el código.');
      return;
    }
    Share.share({
      message: `Te invito a ayudarme en PastilleroApp. Abre la app, ve a Perfil → "Tengo un código de invitación" y escribe: ${code}`,
    }).catch(() => {});
  };

  const handleRedeemInvite = async () => {
    if (!redeemCode.trim()) {
      alert('Error', 'Ingresa el código de invitación.');
      return;
    }
    setRedeeming(true);
    const { patientEmail, error } = await redeemInvite(redeemCode);
    setRedeeming(false);
    if (error) {
      alert('Error', error);
      return;
    }
    setRedeemCode('');
    alert('✅ ¡Vinculado!', `Ya puedes ver y administrar la cuenta de ${patientEmail}. Búscala en "Cuentas que cuidas".`);
  };

  const handleRemoveCaregiver = (linkId: string, email: string) => {
    alert('Quitar acceso', `¿Quitarle el acceso a ${email}? Ya no podrá ver ni administrar tu cuenta.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => removeCaregiver(linkId) },
    ]);
  };

  const handleLeavePatient = (patientId: string, email: string) => {
    alert('Dejar de cuidar esta cuenta', `¿Ya no quieres ver ni administrar la cuenta de ${email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Dejar de cuidar', style: 'destructive', onPress: () => leavePatient(patientId) },
    ]);
  };

  const handleSignOut = () => {
    alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={52} color={COLORS.white} />
            </View>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.email}>{user?.email ?? ''}</Text>
          </LinearGradient>
        </Animated.View>

        {/* Options */}
        <Animated.View entering={FadeInUp.duration(400).delay(80)} style={styles.section}>
          <Text style={styles.sectionTitle}>Mi cuenta</Text>

          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <IconBadge name="mail" color={COLORS.primary} backgroundColor={COLORS.primaryBg} size={44} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Correo electrónico</Text>
                <Text style={styles.infoValue}>{user?.email ?? '-'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <IconBadge name="calendar" color={COLORS.secondary} backgroundColor={COLORS.secondaryLight} size={44} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Miembro desde</Text>
                <Text style={styles.infoValue}>
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '-'}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ─── Cuidado compartido ─── */}
        <Animated.View entering={FadeInUp.duration(400).delay(110)} style={styles.section}>
          <Text style={styles.sectionTitle}>Cuidado compartido</Text>

          {!loadingLinks && linkedPatients.length > 0 && (
            <Card style={[styles.infoCard, styles.caregiverCard]}>
              <Text style={styles.caregiverCardTitle}>Cuentas que cuidas</Text>
              {linkedPatients.map((p) => {
                const isActive = activePatientId === p.patientId;
                return (
                  <View key={p.patientId} style={styles.linkRow}>
                    <View style={styles.linkRowInfo}>
                      <Text style={styles.linkRowEmail} numberOfLines={1}>{p.patientEmail}</Text>
                      {isActive && <Text style={styles.linkRowActiveTag}>Viendo esta cuenta</Text>}
                    </View>
                    {!isActive ? (
                      <TouchableOpacity
                        style={styles.linkRowBtn}
                        onPress={() => switchToPatient(p.patientId, p.patientEmail)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.linkRowBtnText}>Ver</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.linkRowBtn} onPress={switchToSelf} activeOpacity={0.7}>
                        <Text style={styles.linkRowBtnText}>Salir</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.linkRowBtnDanger}
                      onPress={() => handleLeavePatient(p.patientId, p.patientEmail)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              {isViewingOther && (
                <Text style={styles.caregiverHint}>
                  Estás viendo y editando una cuenta que no es la tuya. Los medicamentos que agregues o cambies aquí no
                  van a sonar en ese teléfono hasta que esa persona abra la app.
                </Text>
              )}
            </Card>
          )}

          <Card style={styles.infoCard}>
            <Text style={styles.caregiverCardTitle}>Tengo un código de invitación</Text>
            <Text style={styles.caregiverHint}>Alguien te compartió un código para ayudarle con sus medicamentos.</Text>
            <View style={styles.redeemRow}>
              <TextInput
                style={styles.redeemInput}
                placeholder="Ej. AB12CD"
                placeholderTextColor={COLORS.textLight}
                value={redeemCode}
                onChangeText={(t) => setRedeemCode(t.toUpperCase())}
                autoCapitalize="characters"
                editable={!redeeming}
              />
              <TouchableOpacity
                style={[styles.redeemBtn, redeeming && { opacity: 0.7 }]}
                onPress={handleRedeemInvite}
                activeOpacity={0.7}
                disabled={redeeming}
              >
                {redeeming ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.redeemBtnText}>Vincular</Text>}
              </TouchableOpacity>
            </View>
          </Card>

          <Card style={styles.infoCard}>
            <Text style={styles.caregiverCardTitle}>Invita a alguien para que te ayude</Text>
            <Text style={styles.caregiverHint}>
              Genera un código y compártelo con un familiar. Va a poder ver y administrar tus medicamentos como si
              fueras tú.
            </Text>
            {pendingInviteCode && (
              <View style={styles.inviteCodeBox}>
                <Text style={styles.inviteCodeLabel}>Código sin usar:</Text>
                <Text style={styles.inviteCodeText}>{pendingInviteCode}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.redeemBtn, styles.generateBtnFull, generatingInvite && { opacity: 0.7 }]}
              onPress={handleGenerateInvite}
              activeOpacity={0.7}
              disabled={generatingInvite}
            >
              {generatingInvite ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.redeemBtnText}>
                  {pendingInviteCode ? 'Generar otro código' : 'Generar código'}
                </Text>
              )}
            </TouchableOpacity>

            {!loadingLinks && myCaregivers.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.caregiverCardTitle}>Quién te está cuidando</Text>
                {myCaregivers.map((c) => (
                  <View key={c.linkId} style={styles.linkRow}>
                    <Text style={[styles.linkRowEmail, { flex: 1 }]} numberOfLines={1}>{c.caregiverEmail}</Text>
                    <TouchableOpacity
                      style={styles.linkRowBtnDanger}
                      onPress={() => handleRemoveCaregiver(c.linkId, c.caregiverEmail)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(140)} style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>

          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <IconBadge name="information-circle" color={COLORS.primary} backgroundColor={COLORS.primaryBg} size={44} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Versión</Text>
                <Text style={styles.infoValue}>1.0.0</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.emojiBadge}>
                <Text style={{ fontSize: 22 }}>💊</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>PastilleroApp</Text>
                <Text style={styles.infoValue}>Tu recordatorio de medicamentos</Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Botón para configurar permisos (Android) */}
        {Platform.OS === 'android' && (
          <Animated.View entering={FadeInUp.duration(400).delay(180)}>
            <TouchableOpacity
              style={styles.permissionsButton}
              onPress={() => router.push('/permissions-guide' as any)}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={28} color={COLORS.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionsButtonText}>Configurar Permisos</Text>
                <Text style={styles.permissionsButtonSub}>Para que las alarmas funcionen bien</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Sign Out */}
        <Animated.View entering={FadeInUp.duration(400).delay(220)} style={styles.signOutWrap}>
          <Button title="Cerrar Sesión" icon="log-out-outline" variant="destructive" onPress={handleSignOut} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  userName: {
    fontSize: FONTS.sizeTitle,
    fontFamily: FONTS.family.bold,
    color: COLORS.white,
  },
  email: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.medium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    // padding/shadow provided by Card
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 4,
    gap: SPACING.md,
  },
  emojiBadge: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.accentGold + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.text,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  // ─── Cuidado compartido ───
  caregiverCard: {
    marginBottom: SPACING.md,
  },
  caregiverCardTitle: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  caregiverHint: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  linkRowInfo: {
    flex: 1,
  },
  linkRowEmail: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.text,
  },
  linkRowActiveTag: {
    fontSize: FONTS.sizeSmall - 3,
    fontFamily: FONTS.family.bold,
    color: COLORS.secondary,
    marginTop: 2,
  },
  linkRowBtn: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm,
  },
  linkRowBtnText: {
    fontSize: FONTS.sizeSmall - 2,
    fontFamily: FONTS.family.bold,
    color: COLORS.primary,
  },
  linkRowBtnDanger: {
    padding: 4,
  },
  redeemRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  redeemInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGET.minHeight - 10,
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.text,
    letterSpacing: 2,
  },
  redeemBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    minHeight: TOUCH_TARGET.minHeight - 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redeemBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
  },
  generateBtnFull: {
    width: '100%',
    paddingHorizontal: 0,
  },
  inviteCodeBox: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  inviteCodeLabel: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
  },
  inviteCodeText: {
    fontSize: FONTS.sizeXLarge,
    fontFamily: FONTS.family.extraBold,
    color: COLORS.primary,
    letterSpacing: 4,
    marginTop: 4,
  },
  signOutWrap: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  permissionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    minHeight: 70,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    elevation: 3,
  },
  permissionsButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
  },
  permissionsButtonSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FONTS.sizeSmall - 2,
    fontFamily: FONTS.family.regular,
    marginTop: 2,
  },
});
