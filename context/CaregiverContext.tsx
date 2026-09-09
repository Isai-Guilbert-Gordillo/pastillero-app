import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

const ACTIVE_PATIENT_KEY = 'active_patient';
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I, se prestan a confusión

export interface LinkedPatient {
  patientId: string;
  patientEmail: string;
}

export interface MyCaregiver {
  linkId: string;
  caregiverEmail: string;
}

interface CaregiverContextType {
  activePatientId: string | null;
  activePatientLabel: string;
  isViewingOther: boolean;
  linkedPatients: LinkedPatient[];
  myCaregivers: MyCaregiver[];
  pendingInviteCode: string | null;
  loadingLinks: boolean;
  switchToSelf: () => void;
  switchToPatient: (patientId: string, patientEmail: string) => void;
  createInvite: () => Promise<{ code: string | null; error: string | null }>;
  redeemInvite: (code: string) => Promise<{ patientEmail: string | null; error: string | null }>;
  removeCaregiver: (linkId: string) => Promise<{ error: string | null }>;
  leavePatient: (patientId: string) => Promise<{ error: string | null }>;
  refreshLinks: () => Promise<void>;
}

const CaregiverContext = createContext<CaregiverContextType>({
  activePatientId: null,
  activePatientLabel: 'Tu cuenta',
  isViewingOther: false,
  linkedPatients: [],
  myCaregivers: [],
  pendingInviteCode: null,
  loadingLinks: true,
  switchToSelf: () => {},
  switchToPatient: () => {},
  createInvite: async () => ({ code: null, error: null }),
  redeemInvite: async () => ({ patientEmail: null, error: null }),
  removeCaregiver: async () => ({ error: null }),
  leavePatient: async () => ({ error: null }),
  refreshLinks: async () => {},
});

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

export function CaregiverProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [activePatientLabel, setActivePatientLabel] = useState('Tu cuenta');
  const [linkedPatients, setLinkedPatients] = useState<LinkedPatient[]>([]);
  const [myCaregivers, setMyCaregivers] = useState<MyCaregiver[]>([]);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);

  const refreshLinks = useCallback(async () => {
    if (!user) {
      setLinkedPatients([]);
      setMyCaregivers([]);
      setPendingInviteCode(null);
      setLoadingLinks(false);
      return;
    }

    const [caringForRes, caredByRes, pendingRes] = await Promise.all([
      supabase
        .from('caregiver_links')
        .select('patient_user_id, patient_email')
        .eq('caregiver_user_id', user.id)
        .eq('status', 'accepted'),
      supabase
        .from('caregiver_links')
        .select('id, caregiver_email')
        .eq('patient_user_id', user.id)
        .eq('status', 'accepted'),
      supabase
        .from('caregiver_links')
        .select('invite_code')
        .eq('patient_user_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setLinkedPatients(
      (caringForRes.data ?? []).map((r: { patient_user_id: string; patient_email: string }) => ({
        patientId: r.patient_user_id,
        patientEmail: r.patient_email,
      }))
    );
    setMyCaregivers(
      (caredByRes.data ?? []).map((r: { id: string; caregiver_email: string }) => ({
        linkId: r.id,
        caregiverEmail: r.caregiver_email,
      }))
    );
    setPendingInviteCode(pendingRes.data?.invite_code ?? null);
    setLoadingLinks(false);
  }, [user]);

  // Al cambiar de usuario (login/logout), recupera a quién estaba viendo (si aplica) y refresca vínculos.
  useEffect(() => {
    setLoadingLinks(true);
    if (!user) {
      setActivePatientId(null);
      setActivePatientLabel('Tu cuenta');
      refreshLinks();
      return;
    }

    (async () => {
      const saved = await AsyncStorage.getItem(ACTIVE_PATIENT_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as { id: string; label: string };
          setActivePatientId(parsed.id);
          setActivePatientLabel(parsed.label);
        } catch {
          setActivePatientId(user.id);
          setActivePatientLabel('Tu cuenta');
        }
      } else {
        setActivePatientId(user.id);
        setActivePatientLabel('Tu cuenta');
      }
      await refreshLinks();
    })();
  }, [user, refreshLinks]);

  const switchToSelf = () => {
    if (!user) return;
    setActivePatientId(user.id);
    setActivePatientLabel('Tu cuenta');
    AsyncStorage.removeItem(ACTIVE_PATIENT_KEY).catch(() => {});
  };

  const switchToPatient = (patientId: string, patientEmail: string) => {
    setActivePatientId(patientId);
    setActivePatientLabel(patientEmail);
    AsyncStorage.setItem(ACTIVE_PATIENT_KEY, JSON.stringify({ id: patientId, label: patientEmail })).catch(() => {});
  };

  const createInvite = async (): Promise<{ code: string | null; error: string | null }> => {
    if (!user) return { code: null, error: 'No hay sesión activa.' };

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      const { error } = await supabase.from('caregiver_links').insert({
        patient_user_id: user.id,
        patient_email: user.email ?? '',
        invite_code: code,
        status: 'pending',
      });
      if (!error) {
        setPendingInviteCode(code);
        return { code, error: null };
      }
      if (!error.message?.toLowerCase().includes('duplicate')) {
        return { code: null, error: 'No se pudo generar el código. Intenta de nuevo.' };
      }
      // colisión de código — reintenta con uno nuevo
    }
    return { code: null, error: 'No se pudo generar el código. Intenta de nuevo.' };
  };

  const redeemInvite = async (code: string): Promise<{ patientEmail: string | null; error: string | null }> => {
    if (!user) return { patientEmail: null, error: 'No hay sesión activa.' };
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { patientEmail: null, error: 'Ingresa el código de invitación.' };

    const { data, error } = await supabase.rpc('redeem_caregiver_invite', { p_code: trimmed });

    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('invalid_or_used_code')) {
        return { patientEmail: null, error: 'Ese código no es válido o ya se usó.' };
      }
      if (msg.includes('cannot_link_self')) {
        return { patientEmail: null, error: 'No puedes usar tu propio código.' };
      }
      if (msg.includes('too_many_attempts')) {
        return { patientEmail: null, error: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.' };
      }
      return { patientEmail: null, error: 'No se pudo vincular. Intenta de nuevo.' };
    }

    const row = Array.isArray(data) ? data[0] : data;
    await refreshLinks();
    return { patientEmail: row?.patient_email ?? null, error: null };
  };

  const removeCaregiver = async (linkId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('caregiver_links').delete().eq('id', linkId);
    if (error) return { error: 'No se pudo quitar el acceso.' };
    await refreshLinks();
    return { error: null };
  };

  const leavePatient = async (patientId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'No hay sesión activa.' };
    const { error } = await supabase
      .from('caregiver_links')
      .delete()
      .eq('patient_user_id', patientId)
      .eq('caregiver_user_id', user.id);
    if (error) return { error: 'No se pudo dejar de cuidar esta cuenta.' };
    if (activePatientId === patientId) switchToSelf();
    await refreshLinks();
    return { error: null };
  };

  return (
    <CaregiverContext.Provider
      value={{
        activePatientId,
        activePatientLabel,
        isViewingOther: !!user && activePatientId !== null && activePatientId !== user.id,
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
        refreshLinks,
      }}
    >
      {children}
    </CaregiverContext.Provider>
  );
}

export const useCaregiver = () => useContext(CaregiverContext);
