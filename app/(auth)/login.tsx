import BrandMark from '@/components/BrandMark';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import TextField from '@/components/ui/TextField';
import { useAuth } from '@/context/AuthContext';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { LINKS } from '@/lib/links';
import { ColorScheme, MOTION, SCREEN_MARGIN, SHAPE, SPACING, TOUCH } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

// ─────────────────────────────────────────────────────────────────────────────
// Entrada a la app.
//
// La primera pantalla ya no es un emoji de 56px dentro de un círculo con
// degradado. Es la marca dicha en serio —una píldora dibujada con el ícono del
// sistema dentro del contenedor primario— y debajo, una sola cosa que hacer.
//
// Los campos usan el mismo TextField outlined que el resto de la app, con la
// etiqueta arriba y quieta, y el error bajo el campo que lo causó. Antes cada
// pantalla tenía su propio estilo de input; ahora entrar a la app se ve como
// usar la app.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  legal?: string;
};

type ResetErrors = {
  email?: string;
  code?: string;
  newPassword?: string;
  confirmNewPassword?: string;
};

type AuthView = 'form' | 'forgot-request' | 'forgot-confirm';

export default function LoginScreen() {
  const { signIn, signUp, requestPasswordReset, confirmPasswordReset } = useAuth();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formNotice, setFormNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // ─── "Olvidé mi contraseña" — código numérico por correo ───
  const [authView, setAuthView] = useState<AuthView>('form');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetErrors, setResetErrors] = useState<ResetErrors>({});
  const [resetNotice, setResetNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const clearFieldError = (field: keyof FieldErrors) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = (): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (!isLogin) {
      const trimmedName = fullName.trim();
      if (!trimmedName) {
        nextErrors.fullName = 'Escribe tu nombre.';
      } else if (trimmedName.length < 2) {
        nextErrors.fullName = 'El nombre es demasiado corto.';
      }
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      nextErrors.email = 'Escribe tu correo electrónico.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Ese correo no parece completo. Revisa que tenga @ y un punto.';
    }

    if (!password) {
      nextErrors.password = 'Escribe tu contraseña.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }

    if (!isLogin) {
      if (!confirmPassword) {
        nextErrors.confirmPassword = 'Repite tu contraseña.';
      } else if (confirmPassword !== password) {
        nextErrors.confirmPassword = 'Las dos contraseñas no son iguales.';
      }

      if (!acceptedLegal) {
        nextErrors.legal = 'Marca la casilla para poder crear tu cuenta.';
      }
    }

    return nextErrors;
  };

  const handleSubmit = async () => {
    setFormNotice(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email.trim().toLowerCase(), password);
      setLoading(false);
      if (error) setFormNotice({ type: 'error', text: error });
      return;
    }

    const { error, needsEmailConfirmation } = await signUp(
      email.trim().toLowerCase(),
      password,
      fullName.trim()
    );

    if (error) {
      setLoading(false);
      setFormNotice({ type: 'error', text: error });
      return;
    }

    if (!needsEmailConfirmation) {
      // Ya quedó con sesión activa — el layout raíz va a detectarla y entrar
      // solo a la app en un momento. No hace falta tocar el formulario.
      setFormNotice({ type: 'success', text: '¡Cuenta creada! Entrando…' });
      return;
    }

    setLoading(false);
    setIsLogin(true);
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setAcceptedLegal(false);
    setErrors({});
    setFormNotice({
      type: 'success',
      text: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.',
    });
  };

  const switchMode = () => {
    setIsLogin((prev) => !prev);
    setErrors({});
    setFormNotice(null);
    setPassword('');
    setConfirmPassword('');
    // El consentimiento se vuelve a pedir en cada intento de registro: nunca
    // debe quedar marcado de una sesión anterior del formulario.
    setAcceptedLegal(false);
  };

  const clearResetFieldError = (field: keyof ResetErrors) => {
    setResetErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const openForgotPassword = () => {
    setResetEmail(email.trim());
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetErrors({});
    setResetNotice(null);
    setAuthView('forgot-request');
  };

  const backToLogin = () => {
    setAuthView('form');
    setResetErrors({});
    setResetNotice(null);
  };

  const handleRequestReset = async () => {
    setResetNotice(null);
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) {
      setResetErrors({ email: 'Escribe tu correo electrónico.' });
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setResetErrors({ email: 'Ese correo no parece completo. Revisa que tenga @ y un punto.' });
      return;
    }
    setResetErrors({});
    setResetLoading(true);
    const { error } = await requestPasswordReset(trimmedEmail.toLowerCase());
    setResetLoading(false);

    if (error) {
      setResetNotice({ type: 'error', text: error });
      return;
    }
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setAuthView('forgot-confirm');
  };

  const handleResendCode = async () => {
    setResetNotice(null);
    setResetLoading(true);
    const { error } = await requestPasswordReset(resetEmail.trim().toLowerCase());
    setResetLoading(false);
    setResetNotice(
      error ? { type: 'error', text: error } : { type: 'success', text: 'Te enviamos un código nuevo a tu correo.' }
    );
  };

  const handleConfirmReset = async () => {
    setResetNotice(null);
    const nextErrors: ResetErrors = {};
    const trimmedCode = resetCode.trim();

    if (!trimmedCode) {
      nextErrors.code = 'Escribe el código que te enviamos por correo.';
    } else if (trimmedCode.length < 4) {
      nextErrors.code = 'El código parece incompleto. Revísalo en tu correo.';
    }
    if (!newPassword) {
      nextErrors.newPassword = 'Escribe tu nueva contraseña.';
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      nextErrors.newPassword = `La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (!confirmNewPassword) {
      nextErrors.confirmNewPassword = 'Repite tu nueva contraseña.';
    } else if (confirmNewPassword !== newPassword) {
      nextErrors.confirmNewPassword = 'Las dos contraseñas no son iguales.';
    }

    setResetErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setResetLoading(true);
    const { error } = await confirmPasswordReset(resetEmail.trim().toLowerCase(), trimmedCode, newPassword);
    setResetLoading(false);

    if (error) {
      setResetNotice({ type: 'error', text: error });
      return;
    }
    // Éxito: confirmPasswordReset ya deja una sesión activa — el layout raíz
    // detecta el usuario autenticado y navega solo a la app principal.
  };

  const EyeToggle = ({ shown, onToggle }: { shown: boolean; onToggle: () => void }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
      onPress={onToggle}
      hitSlop={8}
      style={styles.eye}
    >
      <Ionicons
        name={shown ? 'eye-off-outline' : 'eye-outline'}
        size={26}
        color={scheme.onSurfaceVariant}
      />
    </Pressable>
  );

  const Notice = ({ notice }: { notice: { type: 'error' | 'success'; text: string } }) => (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        {
          backgroundColor: notice.type === 'success' ? scheme.successContainer : scheme.errorContainer,
        },
      ]}
    >
      <Ionicons
        name={notice.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
        size={26}
        color={notice.type === 'success' ? scheme.onSuccessContainer : scheme.onErrorContainer}
      />
      <Text
        variant="bodySmall"
        tone={notice.type === 'success' ? 'onSuccessContainer' : 'onErrorContainer'}
        style={styles.noticeText}
      >
        {notice.text}
      </Text>
    </View>
  );

  const formTitle =
    authView === 'form'
      ? isLogin ? 'Iniciar sesión' : 'Crear cuenta'
      : authView === 'forgot-request' ? 'Recuperar contraseña'
      : 'Escribe el código';

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + SPACING.xxl, paddingBottom: insets.bottom + SPACING.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Marca ─── */}
          <View style={styles.brand}>
            <View style={[styles.mark, { backgroundColor: scheme.primaryContainer }]}>
              <BrandMark size={56} />
            </View>
            <Text variant="displaySmall" tone="primary" center style={styles.brandName}>
              TeRecuerda
            </Text>
            <Text variant="bodyMedium" tone="variant" center>
              Tu medicina suena a su hora, aunque la app esté cerrada
            </Text>
          </View>

          {/* ─── Formulario ─── */}
          <Surface level={1} padded>
            <Text variant="headlineSmall" style={styles.formTitle}>
              {formTitle}
            </Text>

            {authView === 'form' && formNotice && <Notice notice={formNotice} />}
            {authView !== 'form' && resetNotice && <Notice notice={resetNotice} />}

            {/* ─── Pedir código ─── */}
            {authView === 'forgot-request' && (
              <>
                <Text variant="bodySmall" tone="variant" style={styles.helper}>
                  Escribe tu correo y te mandamos un código para poner una contraseña nueva.
                </Text>

                <TextField
                  label="Correo electrónico"
                  placeholder="tucorreo@ejemplo.com"
                  value={resetEmail}
                  onChangeText={(text) => {
                    setResetEmail(text);
                    clearResetFieldError('email');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!resetLoading}
                  error={resetErrors.email}
                  leadingIcon={<Ionicons name="mail-outline" size={26} color={scheme.onSurfaceVariant} />}
                />

                <Button
                  title="Enviar código"
                  icon="paper-plane-outline"
                  emphasis
                  onPress={handleRequestReset}
                  loading={resetLoading}
                  style={styles.submit}
                />
                <Button title="Volver a iniciar sesión" variant="text" onPress={backToLogin} />
              </>
            )}

            {/* ─── Confirmar código ─── */}
            {authView === 'forgot-confirm' && (
              <>
                <Text variant="bodySmall" tone="variant" style={styles.helper}>
                  Te enviamos un código a {resetEmail}. Escríbelo aquí junto con tu contraseña nueva.
                </Text>

                <TextField
                  label="Código del correo"
                  placeholder="123456"
                  value={resetCode}
                  onChangeText={(text) => {
                    setResetCode(text.replace(/[^0-9]/g, '').slice(0, 10));
                    clearResetFieldError('code');
                  }}
                  keyboardType="number-pad"
                  editable={!resetLoading}
                  error={resetErrors.code}
                  leadingIcon={<Ionicons name="key-outline" size={26} color={scheme.onSurfaceVariant} />}
                />

                <TextField
                  label="Nueva contraseña"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    clearResetFieldError('newPassword');
                  }}
                  secureTextEntry={!showNewPassword}
                  editable={!resetLoading}
                  error={resetErrors.newPassword}
                  leadingIcon={<Ionicons name="lock-closed-outline" size={26} color={scheme.onSurfaceVariant} />}
                  trailing={<EyeToggle shown={showNewPassword} onToggle={() => setShowNewPassword(!showNewPassword)} />}
                  style={styles.fieldGap}
                />

                <TextField
                  label="Repite la nueva contraseña"
                  placeholder="La misma de arriba"
                  value={confirmNewPassword}
                  onChangeText={(text) => {
                    setConfirmNewPassword(text);
                    clearResetFieldError('confirmNewPassword');
                  }}
                  secureTextEntry={!showNewPassword}
                  editable={!resetLoading}
                  error={resetErrors.confirmNewPassword}
                  leadingIcon={<Ionicons name="lock-closed-outline" size={26} color={scheme.onSurfaceVariant} />}
                  style={styles.fieldGap}
                />

                <Button
                  title="Cambiar contraseña"
                  icon="checkmark-circle"
                  emphasis
                  onPress={handleConfirmReset}
                  loading={resetLoading}
                  style={styles.submit}
                />
                <Button title="¿No te llegó? Reenviar código" variant="text" onPress={handleResendCode} />
                <Button title="Volver a iniciar sesión" variant="text" onPress={backToLogin} />
              </>
            )}

            {/* ─── Entrar / registrarse ─── */}
            {authView === 'form' && (
              <>
                {!isLogin && (
                  <TextField
                    label="Nombre completo"
                    placeholder="María González"
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      clearFieldError('fullName');
                    }}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!loading}
                    error={errors.fullName}
                    leadingIcon={<Ionicons name="person-outline" size={26} color={scheme.onSurfaceVariant} />}
                    style={styles.fieldGapFirst}
                  />
                )}

                <TextField
                  label="Correo electrónico"
                  placeholder="tucorreo@ejemplo.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    clearFieldError('email');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  error={errors.email}
                  leadingIcon={<Ionicons name="mail-outline" size={26} color={scheme.onSurfaceVariant} />}
                  style={isLogin ? undefined : styles.fieldGap}
                />

                <TextField
                  label="Contraseña"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    clearFieldError('password');
                  }}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  error={errors.password}
                  leadingIcon={<Ionicons name="lock-closed-outline" size={26} color={scheme.onSurfaceVariant} />}
                  trailing={<EyeToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
                  style={styles.fieldGap}
                />

                {isLogin && (
                  <View style={styles.forgotRow}>
                    <Button
                      title="¿Olvidaste tu contraseña?"
                      variant="text"
                      fullWidth={false}
                      onPress={openForgotPassword}
                    />
                  </View>
                )}

                {!isLogin && (
                  <TextField
                    label="Repite la contraseña"
                    placeholder="La misma de arriba"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      clearFieldError('confirmPassword');
                    }}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                    error={errors.confirmPassword}
                    leadingIcon={<Ionicons name="lock-closed-outline" size={26} color={scheme.onSurfaceVariant} />}
                    trailing={
                      <EyeToggle shown={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />
                    }
                    style={styles.fieldGap}
                  />
                )}

                {/* Consentimiento expreso, no implícito: la app guarda datos
                    de salud, que casi toda ley de datos trata como categoría
                    especial. Una casilla que hay que marcar a mano —nunca
                    premarcada— es lo que distingue "expreso" de "por usar la
                    app ya aceptaste". Ver docs/terminos.html. */}
                {!isLogin && (
                  <Checkbox
                    checked={acceptedLegal}
                    onToggle={() => {
                      setAcceptedLegal((prev) => !prev);
                      clearFieldError('legal');
                    }}
                    disabled={loading}
                    error={errors.legal}
                    accessibilityLabel="He leído y acepto los términos de uso y el aviso de privacidad, entiendo que esta app no sustituye el consejo médico, y autorizo el tratamiento de mis datos de salud"
                    label={
                      <Text variant="bodyMedium">
                        He leído y acepto los{' '}
                        <Text
                          variant="bodyMedium"
                          tone="primary"
                          style={styles.legalLink}
                          onPress={() => WebBrowser.openBrowserAsync(LINKS.terminos).catch(() => {})}
                        >
                          términos de uso
                        </Text>
                        , y entiendo que{' '}
                        <Text variant="labelLarge" tone="default">
                          esta app es solo una ayuda para recordar y no sustituye el consejo de mi médico
                        </Text>
                        . Autorizo que PastilleroApp guarde mis datos de salud —los medicamentos y
                        horarios que registre— como se explica en el{' '}
                        <Text
                          variant="bodyMedium"
                          tone="primary"
                          style={styles.legalLink}
                          onPress={() => WebBrowser.openBrowserAsync(LINKS.privacidad).catch(() => {})}
                        >
                          aviso de privacidad
                        </Text>
                        .
                      </Text>
                    }
                    style={styles.legalCheckbox}
                  />
                )}

                <Button
                  title={isLogin ? 'Entrar' : 'Crear mi cuenta'}
                  icon={isLogin ? 'log-in-outline' : 'person-add-outline'}
                  emphasis
                  onPress={handleSubmit}
                  loading={loading}
                  style={isLogin ? styles.submitTight : styles.submit}
                />
              </>
            )}
          </Surface>

          {authView === 'form' && (
            <View style={styles.switchBlock}>
              <Text variant="bodySmall" tone="variant" center>
                {isLogin ? '¿Todavía no tienes cuenta?' : '¿Ya tienes cuenta?'}
              </Text>
              <Button
                title={isLogin ? 'Crear una cuenta' : 'Iniciar sesión'}
                variant="outlined"
                onPress={switchMode}
                disabled={loading}
                style={styles.switchButton}
              />
            </View>
          )}

          {/* ─── Descargo médico: disponible, no en el camino ───
              El texto legal que de verdad autoriza el registro vive en la
              casilla de consentimiento de arriba (con sus propios enlaces a
              términos y privacidad); esto es el refuerzo en lenguaje llano.
              Antes se mostraba siempre abierto encima del formulario —
              empujaba "Entrar" fuera de la vista en cada inicio de sesión,
              para alguien que ya lo aceptó una vez. Ahora vive plegado al
              final: un toque para quien lo quiera leer, cero estorbo para
              quien solo quiere entrar. */}
          {authView === 'form' && (
            <View style={styles.disclaimerSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showDisclaimer ? 'Ocultar el aviso médico y de privacidad' : 'Mostrar el aviso médico y de privacidad'}
                accessibilityState={{ expanded: showDisclaimer }}
                onPress={() => setShowDisclaimer((prev) => !prev)}
                style={({ pressed }) => [styles.disclaimerToggle, pressed && styles.disclaimerTogglePressed]}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={scheme.onSurfaceMuted} />
                <Text variant="labelMedium" tone="muted" style={styles.disclaimerToggleText}>
                  Aviso médico y de privacidad
                </Text>
                <Ionicons
                  name={showDisclaimer ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={scheme.onSurfaceMuted}
                />
              </Pressable>

              {showDisclaimer && (
                <Animated.View entering={FadeInDown.duration(MOTION.duration.medium)} exiting={FadeOut.duration(MOTION.duration.short)}>
                  <MedicalDisclaimer
                    onReadTerms={() => WebBrowser.openBrowserAsync(LINKS.terminos).catch(() => {})}
                    style={styles.disclaimer}
                  />
                </Animated.View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (t: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: SCREEN_MARGIN,
    },
    // ─── Marca ───
    brand: {
      alignItems: 'center',
      marginBottom: SPACING.xxl,
    },
    mark: {
      width: 96,
      height: 96,
      borderRadius: SHAPE.extraLarge,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    brandName: {
      marginBottom: SPACING.xs,
    },
    // ─── Descargo médico (plegado, al final) ───
    disclaimerSection: {
      marginTop: SPACING.xxl,
    },
    disclaimerToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      minHeight: TOUCH.min,
      borderRadius: SHAPE.small,
      paddingHorizontal: SPACING.sm,
    },
    disclaimerTogglePressed: {
      opacity: 0.6,
    },
    disclaimerToggleText: {
      textDecorationLine: 'underline',
    },
    disclaimer: {
      marginTop: SPACING.sm,
    },
    // ─── Formulario ───
    formTitle: {
      marginBottom: SPACING.xl,
    },
    helper: {
      marginBottom: SPACING.xl,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      borderRadius: SHAPE.medium,
      padding: SPACING.lg,
      marginBottom: SPACING.xl,
    },
    noticeText: {
      flex: 1,
    },
    fieldGap: {
      marginTop: SPACING.xl,
    },
    fieldGapFirst: {
      marginBottom: 0,
    },
    eye: {
      width: 48,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: SPACING.sm,
    },
    forgotRow: {
      alignItems: 'flex-end',
      marginTop: SPACING.sm,
    },
    submit: {
      marginTop: SPACING.xl,
    },
    // ─── Consentimiento ───
    legalCheckbox: {
      marginTop: SPACING.xl,
    },
    legalLink: {
      textDecorationLine: 'underline',
    },
    submitTight: {
      marginTop: SPACING.md,
    },
    // ─── Cambiar de modo ───
    switchBlock: {
      alignItems: 'center',
      marginTop: SPACING.xxl,
      gap: SPACING.md,
    },
    switchButton: {
      minHeight: TOUCH.min,
    },
  });
