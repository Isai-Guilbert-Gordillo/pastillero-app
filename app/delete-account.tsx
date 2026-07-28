import { useFeedback } from '@/components/Feedback';
import Button from '@/components/ui/Button';
import IconBadge from '@/components/ui/IconBadge';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import TextField from '@/components/ui/TextField';
import TopAppBar from '@/components/ui/TopAppBar';
import { useAuth } from '@/context/AuthContext';
import { useCaregiver } from '@/context/CaregiverContext';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { cancelAllNotifications } from '@/lib/notifications';
import { clearPhotoCache } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { ColorScheme, SCREEN_MARGIN, SPACING } from '@/lib/theme';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Eliminar mi cuenta.
//
// Google Play exige que toda app que deja crear una cuenta deje también
// borrarla desde adentro, sin escribirle a nadie. Es requisito de publicación,
// pero también es lo correcto: quien confió sus datos de salud a la app tiene
// que poder retirarlos.
//
// Es una PANTALLA y no un diálogo porque hay algo que explicar antes de
// decidir: qué se borra, qué pasa con quien te cuida, y que no hay vuelta
// atrás. Un alert de dos líneas no alcanza para eso, y menos con este público.
//
// La confirmación es escribir ELIMINAR. Suena áspero para una app pensada
// para personas de 80 años, y por eso mismo se sostiene: es la única acción
// irreversible de toda la app, y quien llega aquí por accidente —buscando
// "cerrar sesión"— no va a escribir una palabra al azar. Un botón rojo más sí
// se toca por accidente.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIRM_WORD = 'ELIMINAR';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { linkedPatients, myCaregivers } = useCaregiver();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { alert, snack } = useFeedback();

  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const runDeletion = async () => {
    setDeleting(true);

    const { error: rpcError } = await supabase.rpc('delete_my_account');

    if (rpcError) {
      setDeleting(false);
      snack('No se pudo eliminar la cuenta. Revisa tu conexión e inténtalo otra vez.', {
        tone: 'error',
      });
      return;
    }

    // Apagar las alarmas de ESTE teléfono antes de soltar la sesión: si no,
    // seguirían sonando recordatorios de una cuenta que ya no existe.
    await cancelAllNotifications();
    clearPhotoCache();

    // Cierre LOCAL a propósito: el borrado de auth.users ya se llevó la sesión
    // del servidor en cascada, así que un logout global solo puede fallar
    // contra un token muerto y dejar al usuario atrapado en esta pantalla.
    // Al limpiarse la sesión, onAuthStateChange manda solo al login.
    await supabase.auth.signOut({ scope: 'local' });
    snack('Tu cuenta y tus datos se eliminaron.', { tone: 'success' });
  };

  const handleDelete = () => {
    if (!confirmed) {
      setError(`Escribe ${CONFIRM_WORD} para confirmar.`);
      return;
    }
    alert(
      '¿Eliminar tu cuenta?',
      'Se borran tus medicamentos, tu historial y tus fotos. Esto no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, eliminar', style: 'destructive', onPress: runDeletion },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar title="Eliminar mi cuenta" variant="small" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Surface level={1} padded style={styles.card}>
          <IconBadge
            name="warning"
            color={scheme.onErrorContainer}
            backgroundColor={scheme.errorContainer}
            size={56}
          />
          <Text variant="titleMedium" style={styles.cardTitle}>
            Esto no se puede deshacer
          </Text>
          <Text variant="bodyMedium" tone="variant">
            Si solo quieres dejar de usar la app por un tiempo, cierra sesión en vez de eliminar la
            cuenta. Al cerrar sesión tus datos siguen ahí cuando vuelvas.
          </Text>
        </Surface>

        <Text variant="labelMedium" tone="variant" style={styles.sectionLabel}>
          QUÉ SE BORRA
        </Text>
        <Surface level={1} padded>
          <Text variant="bodyMedium" style={styles.bullet}>
            · Tu cuenta ({user?.email ?? '—'}) y tu contraseña.
          </Text>
          <Text variant="bodyMedium" style={styles.bullet}>
            · Todos tus medicamentos y sus horarios.
          </Text>
          <Text variant="bodyMedium" style={styles.bullet}>
            · Todo tu historial de tomas.
          </Text>
          <Text variant="bodyMedium" style={styles.bullet}>
            · Las fotos que subiste de tus medicamentos.
          </Text>
          {myCaregivers.length > 0 && (
            <Text variant="bodyMedium" style={styles.bullet}>
              · El acceso de quienes te cuidan ({myCaregivers.length}): dejan de ver tu cuenta.
            </Text>
          )}
          {linkedPatients.length > 0 && (
            <Text variant="bodyMedium" style={styles.bullet}>
              · Tu acceso a las {linkedPatients.length} cuenta(s) que cuidas. Esas cuentas y sus
              medicamentos NO se borran — solo dejas de verlas.
            </Text>
          )}
        </Surface>

        <Text variant="labelMedium" tone="variant" style={styles.sectionLabel}>
          ALGO QUE HACER ANTES
        </Text>
        <Surface level={1} padded>
          <Text variant="bodyMedium" tone="variant">
            Las alarmas que se crearon en la app de Reloj de tu teléfono no se borran desde aquí —
            Android no lo permite. Si tienes alarmas de medicamentos ahí, bórralas a mano en el
            Reloj o van a seguir sonando.
          </Text>
        </Surface>

        <Text variant="labelMedium" tone="variant" style={styles.sectionLabel}>
          CONFIRMA
        </Text>
        <Surface level={1} padded>
          <Text variant="bodyMedium" tone="variant" style={styles.confirmHint}>
            Escribe {CONFIRM_WORD} en el recuadro para poder continuar.
          </Text>
          <TextField
            label="Escribe ELIMINAR"
            placeholder={CONFIRM_WORD}
            value={confirmText}
            onChangeText={(t) => {
              setConfirmText(t.toUpperCase());
              if (error) setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
            error={error}
          />
        </Surface>

        <Button
          title="Eliminar mi cuenta para siempre"
          icon="trash-outline"
          variant="destructive"
          disabled={!confirmed || deleting}
          loading={deleting}
          onPress={handleDelete}
          style={styles.deleteButton}
        />
        <Button
          title="Mejor no, regresar"
          variant="text"
          disabled={deleting}
          onPress={() => router.back()}
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
      paddingBottom: SPACING.xxxl,
    },
    card: {
      alignItems: 'center',
      gap: SPACING.sm,
    },
    cardTitle: {
      marginTop: SPACING.sm,
    },
    sectionLabel: {
      marginTop: SPACING.xxl,
      marginBottom: SPACING.md,
    },
    bullet: {
      marginBottom: SPACING.sm,
    },
    confirmHint: {
      marginBottom: SPACING.md,
    },
    deleteButton: {
      marginTop: SPACING.xxxl,
      marginBottom: SPACING.sm,
    },
  });
