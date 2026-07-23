import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, TOUCH_TARGET, GRADIENTS, SHADOWS } from '@/lib/theme';
import Button from '@/components/ui/Button';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
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
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
        nextErrors.fullName = 'Ingresa tu nombre.';
      } else if (trimmedName.length < 2) {
        nextErrors.fullName = 'El nombre es demasiado corto.';
      }
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      nextErrors.email = 'Ingresa tu correo electrónico.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Ingresa un correo electrónico válido.';
    }

    if (!password) {
      nextErrors.password = 'Ingresa tu contraseña.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }

    if (!isLogin) {
      if (!confirmPassword) {
        nextErrors.confirmPassword = 'Confirma tu contraseña.';
      } else if (confirmPassword !== password) {
        nextErrors.confirmPassword = 'Las contraseñas no coinciden.';
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
      setFormNotice({ type: 'success', text: '¡Cuenta creada! Entrando...' });
      return;
    }

    setLoading(false);
    setIsLogin(true);
    setPassword('');
    setConfirmPassword('');
    setFullName('');
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
      setResetErrors({ email: 'Ingresa tu correo electrónico.' });
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setResetErrors({ email: 'Ingresa un correo electrónico válido.' });
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
      error ? { type: 'error', text: error } : { type: 'success', text: 'Te enviamos un nuevo código a tu correo.' }
    );
  };

  const handleConfirmReset = async () => {
    setResetNotice(null);
    const nextErrors: ResetErrors = {};
    const trimmedCode = resetCode.trim();

    if (!trimmedCode) {
      nextErrors.code = 'Ingresa el código que te enviamos.';
    } else if (trimmedCode.length < 4) {
      nextErrors.code = 'Revisa el código, parece incompleto.';
    }
    if (!newPassword) {
      nextErrors.newPassword = 'Ingresa tu nueva contraseña.';
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      nextErrors.newPassword = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (!confirmNewPassword) {
      nextErrors.confirmNewPassword = 'Confirma tu nueva contraseña.';
    } else if (confirmNewPassword !== newPassword) {
      nextErrors.confirmNewPassword = 'Las contraseñas no coinciden.';
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.iconContainer}>
              <Text style={styles.iconEmoji}>💊</Text>
            </LinearGradient>
            <Text style={styles.title}>PastilleroApp</Text>
            <Text style={styles.subtitle}>Tu recordatorio de medicamentos</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.duration(450).delay(100)} style={styles.form}>
            <Text style={styles.formTitle}>
              {authView === 'form'
                ? (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')
                : authView === 'forgot-request'
                ? 'Recuperar contraseña'
                : 'Escribe el código'}
            </Text>

            {authView === 'form' && formNotice && (
              <View
                style={[
                  styles.formMessage,
                  formNotice.type === 'success' ? styles.formMessageSuccess : styles.formMessageError,
                ]}
              >
                <Ionicons
                  name={formNotice.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={24}
                  color={formNotice.type === 'success' ? COLORS.success : COLORS.danger}
                  style={styles.formMessageIcon}
                />
                <Text
                  style={[
                    styles.formMessageText,
                    { color: formNotice.type === 'success' ? COLORS.success : COLORS.danger },
                  ]}
                >
                  {formNotice.text}
                </Text>
              </View>
            )}

            {authView !== 'form' && resetNotice && (
              <View
                style={[
                  styles.formMessage,
                  resetNotice.type === 'success' ? styles.formMessageSuccess : styles.formMessageError,
                ]}
              >
                <Ionicons
                  name={resetNotice.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={24}
                  color={resetNotice.type === 'success' ? COLORS.success : COLORS.danger}
                  style={styles.formMessageIcon}
                />
                <Text
                  style={[
                    styles.formMessageText,
                    { color: resetNotice.type === 'success' ? COLORS.success : COLORS.danger },
                  ]}
                >
                  {resetNotice.text}
                </Text>
              </View>
            )}

            {authView === 'forgot-request' && (
              <>
                <Text style={styles.helperText}>
                  Escribe tu correo y te mandamos un código por correo para poner una contraseña nueva.
                </Text>

                <Text style={styles.inputLabel}>Correo electrónico</Text>
                <View style={[styles.inputContainer, resetErrors.email && styles.inputContainerError]}>
                  <Ionicons name="mail-outline" size={26} color={COLORS.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="tucorreo@ejemplo.com"
                    placeholderTextColor={COLORS.textLight}
                    value={resetEmail}
                    onChangeText={(text) => {
                      setResetEmail(text);
                      clearResetFieldError('email');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!resetLoading}
                  />
                </View>
                {resetErrors.email && <Text style={styles.errorText}>{resetErrors.email}</Text>}

                <Button
                  title="Enviar código"
                  onPress={handleRequestReset}
                  loading={resetLoading}
                  style={styles.submitButton}
                />

                <TouchableOpacity
                  onPress={backToLogin}
                  style={styles.switchButton}
                  activeOpacity={0.7}
                  disabled={resetLoading}
                >
                  <Text style={styles.switchText}>Volver a iniciar sesión</Text>
                </TouchableOpacity>
              </>
            )}

            {authView === 'forgot-confirm' && (
              <>
                <Text style={styles.helperText}>
                  Te enviamos un código a {resetEmail}. Escríbelo aquí junto con tu nueva contraseña.
                </Text>

                <Text style={styles.inputLabel}>Código del correo</Text>
                <View style={[styles.inputContainer, resetErrors.code && styles.inputContainerError]}>
                  <Ionicons name="key-outline" size={26} color={COLORS.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Código que te llegó por correo"
                    placeholderTextColor={COLORS.textLight}
                    value={resetCode}
                    onChangeText={(text) => {
                      setResetCode(text.replace(/[^0-9]/g, '').slice(0, 10));
                      clearResetFieldError('code');
                    }}
                    keyboardType="number-pad"
                    editable={!resetLoading}
                  />
                </View>
                {resetErrors.code && <Text style={styles.errorText}>{resetErrors.code}</Text>}

                <Text style={styles.inputLabel}>Nueva contraseña</Text>
                <View style={[styles.inputContainer, resetErrors.newPassword && styles.inputContainerError]}>
                  <Ionicons name="lock-closed-outline" size={26} color={COLORS.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={COLORS.textLight}
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      clearResetFieldError('newPassword');
                    }}
                    secureTextEntry={!showNewPassword}
                    editable={!resetLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeIcon}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={26}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {resetErrors.newPassword && <Text style={styles.errorText}>{resetErrors.newPassword}</Text>}

                <Text style={styles.inputLabel}>Confirmar nueva contraseña</Text>
                <View style={[styles.inputContainer, resetErrors.confirmNewPassword && styles.inputContainerError]}>
                  <Ionicons name="lock-closed-outline" size={26} color={COLORS.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Repite tu nueva contraseña"
                    placeholderTextColor={COLORS.textLight}
                    value={confirmNewPassword}
                    onChangeText={(text) => {
                      setConfirmNewPassword(text);
                      clearResetFieldError('confirmNewPassword');
                    }}
                    secureTextEntry={!showNewPassword}
                    editable={!resetLoading}
                  />
                </View>
                {resetErrors.confirmNewPassword && (
                  <Text style={styles.errorText}>{resetErrors.confirmNewPassword}</Text>
                )}

                <Button
                  title="Cambiar contraseña"
                  onPress={handleConfirmReset}
                  loading={resetLoading}
                  style={styles.submitButton}
                />

                <TouchableOpacity
                  onPress={handleResendCode}
                  style={styles.switchButton}
                  activeOpacity={0.7}
                  disabled={resetLoading}
                >
                  <Text style={styles.switchText}>¿No te llegó? Reenviar código</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={backToLogin}
                  style={styles.switchButtonSecondary}
                  activeOpacity={0.7}
                  disabled={resetLoading}
                >
                  <Text style={styles.switchTextSecondary}>Volver a iniciar sesión</Text>
                </TouchableOpacity>
              </>
            )}

            {authView === 'form' && !isLogin && (
              <>
                <Text style={styles.inputLabel}>Nombre completo</Text>
                <View style={[styles.inputContainer, errors.fullName && styles.inputContainerError]}>
                  <Ionicons name="person-outline" size={26} color={COLORS.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. María González"
                    placeholderTextColor={COLORS.textLight}
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      clearFieldError('fullName');
                    }}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>
                {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
              </>
            )}

            {authView === 'form' && (
              <>
                <Text style={styles.inputLabel}>Correo electrónico</Text>
                <View style={[styles.inputContainer, errors.email && styles.inputContainerError]}>
                  <Ionicons name="mail-outline" size={26} color={COLORS.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="tucorreo@ejemplo.com"
                    placeholderTextColor={COLORS.textLight}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      clearFieldError('email');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

                <Text style={styles.inputLabel}>Contraseña</Text>
                <View style={[styles.inputContainer, errors.password && styles.inputContainerError]}>
                  <Ionicons name="lock-closed-outline" size={26} color={COLORS.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={COLORS.textLight}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      clearFieldError('password');
                    }}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={26}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

                {isLogin && (
                  <TouchableOpacity
                    onPress={openForgotPassword}
                    style={styles.forgotPasswordLink}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
                  </TouchableOpacity>
                )}

                {!isLogin && (
                  <>
                    <Text style={styles.inputLabel}>Confirmar contraseña</Text>
                    <View style={[styles.inputContainer, errors.confirmPassword && styles.inputContainerError]}>
                      <Ionicons name="lock-closed-outline" size={26} color={COLORS.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Repite tu contraseña"
                        placeholderTextColor={COLORS.textLight}
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          clearFieldError('confirmPassword');
                        }}
                        secureTextEntry={!showConfirmPassword}
                        editable={!loading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeIcon}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={26}
                          color={COLORS.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                    {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                  </>
                )}

                <Button
                  title={isLogin ? 'Entrar' : 'Registrarme'}
                  onPress={handleSubmit}
                  loading={loading}
                  style={styles.submitButton}
                />

                <TouchableOpacity
                  onPress={switchMode}
                  style={styles.switchButton}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={styles.switchText}>
                    {isLogin
                      ? '¿No tienes cuenta? Regístrate aquí'
                      : '¿Ya tienes cuenta? Inicia sesión'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.floating,
  },
  iconEmoji: {
    fontSize: 56,
  },
  title: {
    fontSize: FONTS.sizeTitle + 4,
    fontFamily: FONTS.family.extraBold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.medium,
    color: COLORS.textSecondary,
  },
  form: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  formTitle: {
    fontSize: FONTS.sizeXLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  formMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  formMessageError: {
    backgroundColor: COLORS.dangerLight,
  },
  formMessageSuccess: {
    backgroundColor: COLORS.successLight,
  },
  formMessageIcon: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  formMessageText: {
    flex: 1,
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
  },
  inputLabel: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGET.minHeight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputContainerError: {
    borderColor: COLORS.danger,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  eyeIcon: {
    padding: SPACING.sm,
  },
  errorText: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.danger,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  submitButton: {
    marginTop: SPACING.sm,
  },
  switchButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    minHeight: TOUCH_TARGET.minHeight,
    justifyContent: 'center',
  },
  switchText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.secondary,
    textDecorationLine: 'underline',
  },
  switchButtonSecondary: {
    marginTop: SPACING.sm,
    alignItems: 'center',
    minHeight: TOUCH_TARGET.minHeight,
    justifyContent: 'center',
  },
  switchTextSecondary: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.medium,
    color: COLORS.textSecondary,
  },
  helperText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    lineHeight: 28,
    marginBottom: SPACING.lg,
  },
  forgotPasswordLink: {
    alignItems: 'flex-end',
    minHeight: TOUCH_TARGET.minHeight - 20,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  forgotPasswordText: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.secondary,
    textDecorationLine: 'underline',
  },
});
