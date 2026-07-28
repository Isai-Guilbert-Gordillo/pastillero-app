import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { LEGAL_VERSION } from '@/lib/links';
import { clearPhotoCache } from '@/lib/photos';
import { unregisterDeviceToken } from '@/lib/push';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<{ error: string | null }>;
}

function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (normalized.includes('user already registered') || normalized.includes('already registered')) {
    return 'Ya existe una cuenta con este correo. Intenta iniciar sesión.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.';
  }
  if (normalized.includes('password should be at least')) {
    return 'La contraseña es demasiado corta.';
  }
  if (
    normalized.includes('unable to validate email address') ||
    normalized.includes('invalid email') ||
    (normalized.includes('email address') && normalized.includes('is invalid'))
  ) {
    return 'El correo electrónico no es válido.';
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'No se pudo conectar. Revisa tu conexión a internet.';
  }
  if (
    normalized.includes('rate limit') ||
    normalized.includes('for security purposes') ||
    (normalized.includes('only request this') && normalized.includes('seconds'))
  ) {
    return 'Espera un momento antes de volver a intentarlo (por seguridad, hay un límite de tiempo entre intentos).';
  }
  if (normalized.includes('token has expired') || normalized.includes('otp expired')) {
    return 'El código venció. Solicita uno nuevo.';
  }
  if ((normalized.includes('invalid') && normalized.includes('token')) || normalized.includes('invalid otp') || normalized.includes('token not found')) {
    return 'El código es incorrecto. Revísalo e intenta de nuevo.';
  }
  return 'Ocurrió un error. Inténtalo de nuevo.';
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null, needsEmailConfirmation: false }),
  signOut: async () => {},
  requestPasswordReset: async () => ({ error: null }),
  confirmPasswordReset: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateAuthError(error.message) : null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    // El consentimiento se guarda CON la versión de los documentos y la fecha.
    // La ley mexicana pide consentimiento expreso para datos sensibles (los de
    // salud lo son) y "aceptó los términos" sin decir cuáles ni cuándo no
    // demuestra nada en cuanto el texto cambie. Va en user_metadata para que
    // quede atado a la cuenta desde el instante de su creación.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          legal_version: LEGAL_VERSION,
          legal_accepted_at: new Date().toISOString(),
          health_data_consent: true,
        },
      },
    });
    // Si el proyecto de Supabase tiene desactivada la confirmación por correo,
    // signUp ya deja una sesión activa (data.session) — no hay nada que confirmar.
    return {
      error: error ? translateAuthError(error.message) : null,
      needsEmailConfirmation: !error && !data.session,
    };
  };

  const signOut = async () => {
    // Antes del signOut: después ya no hay permiso de RLS para borrar la fila
    // y este teléfono seguiría recibiendo avisos de una cuenta ajena.
    await unregisterDeviceToken();
    clearPhotoCache();
    await supabase.auth.signOut();
  };

  // Paso 1 de "Olvidé mi contraseña": envía un código de 6 dígitos por correo.
  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error ? translateAuthError(error.message) : null };
  };

  // Paso 2: valida el código y establece la nueva contraseña. Si todo sale bien,
  // verifyOtp ya deja una sesión activa, así que updateUser aplica sobre esa sesión
  // y la persona queda con sesión iniciada (sin tener que volver a escribir su correo).
  const confirmPasswordReset = async (email: string, code: string, newPassword: string) => {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (verifyError) {
      return { error: translateAuthError(verifyError.message) };
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    return { error: updateError ? translateAuthError(updateError.message) : null };
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signOut, requestPasswordReset, confirmPasswordReset }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
