import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';
import { mascot } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Don Memo — el abuelo robot que acompaña a recordar.
//
// Su cabeza ES el ícono de la app: el compartimento del pastillero, con la
// misma costura de la tapa. No es una ilustración pegada encima del sistema de
// diseño; está hecha de las mismas figuras (ver "Ícono de marca" y "La mascota"
// en DESIGN.md).
//
// DÓNDE VIVE: estado vacío de Inicio, guía de permisos, cierre de tratamiento.
// DÓNDE NO: la pantalla de alarma. A las 3 AM, frente a alguien de 80 años
// recién despertado, un personaje compite con la única información que importa
// y suaviza una urgencia que debe ser nítida.
//
// LO QUE NUNCA HACE: decir un dato médico. Las dosis, las horas y los conteos
// los dice el sistema en voz neutra. Don Memo acompaña, no receta — esa línea
// es la que mantiene el descargo de docs/terminos.html del lado correcto.
//
// Dos piezas, no una: `bust` para momentos grandes y `head` para tamaños
// chicos. Abajo de ~64dp el suéter se vuelve una mancha y sobra.
// ─────────────────────────────────────────────────────────────────────────────

// Geometría en un espacio normalizado donde la cabeza mide 100.
const S = 100;
const CX = 85;
const CY = 75;
const BUST_Y = CY + 55;
const BUST_H = 78;

const EYE_Y = CY - 6;
const EYE_DX = 20;
const EYE_R = 14.5;
const PUPIL_R = 6.8;

const SHOULDER_W = 146;
const SHOULDER_TIP_X = SHOULDER_W * 0.34;
const SHOULDER_TIP_Y = BUST_Y + 17;
const NECK_HALF = 17;
const V_HALF = NECK_HALF * 1.15;
const V_DEPTH = 24;

// Silueta del busto: del cuello baja en diagonal hasta la punta del hombro y
// ahí redondea al brazo vertical. Sin esa diagonal es un rectángulo con cabeza.
const BUST_PATH = [
  `M ${CX - SHOULDER_W / 2} ${BUST_Y + BUST_H}`,
  `L ${CX - SHOULDER_W / 2} ${BUST_Y + 42}`,
  `Q ${CX - SHOULDER_W / 2} ${SHOULDER_TIP_Y + 3} ${CX - SHOULDER_TIP_X} ${SHOULDER_TIP_Y}`,
  `L ${CX - NECK_HALF} ${BUST_Y}`,
  `L ${CX + NECK_HALF} ${BUST_Y}`,
  `L ${CX + SHOULDER_TIP_X} ${SHOULDER_TIP_Y}`,
  `Q ${CX + SHOULDER_W / 2} ${SHOULDER_TIP_Y + 3} ${CX + SHOULDER_W / 2} ${BUST_Y + 42}`,
  `L ${CX + SHOULDER_W / 2} ${BUST_Y + BUST_H}`,
  'Z',
].join(' ');

// Bigote de manubrio. Va alto, justo bajo el puente de los lentes: más abajo
// deja de leer como bigote y lee como barba.
const MW = 30;
const MH = 10;
const MY = CY + 16;
const MUSTACHE_PATH = [
  `M ${CX - MW} ${MY - MH * 0.1}`,
  `Q ${CX - MW * 0.45} ${MY - MH * 1.15} ${CX} ${MY - MH * 0.2}`,
  `Q ${CX + MW * 0.45} ${MY - MH * 1.15} ${CX + MW} ${MY - MH * 0.1}`,
  `Q ${CX + MW * 0.6} ${MY + MH * 1.25} ${CX} ${MY + MH * 0.72}`,
  `Q ${CX - MW * 0.6} ${MY + MH * 1.25} ${CX - MW} ${MY - MH * 0.1}`,
  'Z',
].join(' ');

const SHIRT_PATH = `M ${CX - V_HALF} ${BUST_Y + 1} L ${CX} ${BUST_Y + V_DEPTH} L ${CX + V_HALF} ${BUST_Y + 1} Z`;
const LAPEL_L = `M ${CX - V_HALF} ${BUST_Y + 1} L ${CX} ${BUST_Y + V_DEPTH} L ${CX + 4.5} ${BUST_Y + V_DEPTH - 3.5} L ${CX - V_HALF + 7} ${BUST_Y + 1} Z`;
const LAPEL_R = `M ${CX + V_HALF} ${BUST_Y + 1} L ${CX} ${BUST_Y + V_DEPTH} L ${CX - 4.5} ${BUST_Y + V_DEPTH - 3.5} L ${CX + V_HALF - 7} ${BUST_Y + 1} Z`;

export type MemoGesture = 'none' | 'greet' | 'nod';

interface DonMemoProps {
  /** Lado de la cabeza en dp. El busto crece a partir de esto. */
  size?: number;
  /** `bust` para momentos grandes; `head` abajo de ~64dp. */
  variant?: 'bust' | 'head';
  /** Gesto puntual. */
  gesture?: MemoGesture;
  /**
   * Sube este número para volver a disparar el MISMO gesto: dos dosis
   * confirmadas seguidas son dos asentimientos, no uno.
   */
  gestureKey?: number;
  /** Parpadeo ocioso. Se apaga solo si el sistema pide menos animación. */
  idle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function DonMemo({
  size = 120,
  variant = 'bust',
  gesture = 'none',
  gestureKey = 0,
  idle = true,
  style,
}: DonMemoProps) {
  const { scheme } = useTheme();
  const c = mascot(scheme);
  const isBust = variant === 'bust';

  // Respetar "quitar animaciones" del sistema no es un extra: para parte de
  // este público el movimiento involuntario marea o distrae.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  const animate = !reduceMotion;

  // ─── Parpadeo ───
  // Con estado, no con `useAnimatedProps`: un parpadeo son dos fotogramas
  // (abierto / cerrado), y los props animados de Reanimated sobre SVG no
  // actualizan el atributo en web — comprobado. Esto corre igual en ambas
  // plataformas y el árbol que se re-renderiza son dos elipses.
  const [eyeOpen, setEyeOpen] = useState(true);
  useEffect(() => {
    if (!animate || !idle) {
      setEyeOpen(true);
      return;
    }
    let reopen: ReturnType<typeof setTimeout>;
    const loop = setInterval(() => {
      setEyeOpen(false);
      reopen = setTimeout(() => setEyeOpen(true), 110);
    }, 3600);
    return () => {
      clearInterval(loop);
      clearTimeout(reopen);
    };
  }, [animate, idle]);

  const pupilRy = eyeOpen ? PUPIL_R : PUPIL_R * 0.12;

  // ─── Gestos ───
  const lift = useSharedValue(0);
  const tilt = useSharedValue(0);
  useEffect(() => {
    if (!animate || gesture === 'none') return;
    if (gesture === 'greet') {
      lift.value = withSequence(
        withTiming(-10, { duration: 260, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.back(2)) })
      );
      tilt.value = withSequence(
        withTiming(-5, { duration: 260 }),
        withTiming(0, { duration: 420 })
      );
    } else if (gesture === 'nod') {
      lift.value = withSequence(
        withTiming(6, { duration: 150 }),
        withTiming(-2, { duration: 150 }),
        withTiming(0, { duration: 180 })
      );
    }
  }, [gesture, gestureKey, animate, lift, tilt]);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { rotate: `${tilt.value}deg` }],
  }));

  const vbHeight = isBust ? BUST_Y + BUST_H : CY + 58;
  const vbWidth = isBust ? 170 : 120;
  const vbX = isBust ? 0 : CX - 60;
  const width = size * (vbWidth / S);
  const height = size * (vbHeight / S);

  return (
    <Animated.View style={[{ width, height }, wrapperStyle, style]}>
      <Svg width={width} height={height} viewBox={`${vbX} 0 ${vbWidth} ${vbHeight}`}>
        {/* Cuerpo primero: la cabeza se encima al cuello */}
        {isBust && (
          <G>
            <Rect
              x={CX - 11}
              y={BUST_Y - 12}
              width={22}
              height={18}
              rx={5}
              fill={c.neck}
            />
            <Path d={BUST_PATH} fill={c.body} />
            <Path d={SHIRT_PATH} fill={c.shirt} />
            <Path d={LAPEL_L} fill={c.lapel} />
            <Path d={LAPEL_R} fill={c.lapel} />
            <Circle cx={CX} cy={BUST_Y + 42} r={3.2} fill={c.button} />
            <Circle cx={CX} cy={BUST_Y + 58} r={3.2} fill={c.button} />
          </G>
        )}

        {/* Antena */}
        <Line
          x1={CX}
          y1={CY - 48}
          x2={CX}
          y2={CY - 60}
          stroke={c.body}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <Circle cx={CX} cy={CY - 64.5} r={6.2} fill={c.body} />

        {/* Cabeza — el compartimento del ícono */}
        <Rect x={CX - 50} y={CY - 50} width={S} height={S} rx={28} fill={c.head} />
        <Line
          x1={CX - 25}
          y1={CY - 32}
          x2={CX + 25}
          y2={CY - 32}
          stroke={c.seam}
          strokeWidth={2.8}
          strokeLinecap="round"
        />

        {/* Lentes */}
        <G stroke={c.frame} strokeWidth={3.6} fill="none" strokeLinecap="round">
          <Circle cx={CX - EYE_DX} cy={EYE_Y} r={EYE_R} />
          <Circle cx={CX + EYE_DX} cy={EYE_Y} r={EYE_R} />
          <Line x1={CX - EYE_DX + EYE_R} y1={EYE_Y} x2={CX + EYE_DX - EYE_R} y2={EYE_Y} />
          <Line x1={CX - EYE_DX - EYE_R} y1={EYE_Y} x2={CX - 46} y2={EYE_Y - 3} />
          <Line x1={CX + EYE_DX + EYE_R} y1={EYE_Y} x2={CX + 46} y2={EYE_Y - 3} />
        </G>

        {/* Ojos — elipses para poder achatarlas al parpadear */}
        <Ellipse cx={CX - EYE_DX} cy={EYE_Y} rx={PUPIL_R} ry={pupilRy} fill={c.ink} />
        <Ellipse cx={CX + EYE_DX} cy={EYE_Y} rx={PUPIL_R} ry={pupilRy} fill={c.ink} />

        <Path d={MUSTACHE_PATH} fill={c.frame} />
      </Svg>
    </Animated.View>
  );
}
