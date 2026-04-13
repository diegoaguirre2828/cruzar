import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';

export const WaitTimeVideoSchema = z.object({
  crossings: z.array(
    z.object({
      portId: z.string(),
      name: z.string(),
      wait: z.number(),
      level: z.enum(['low', 'medium', 'high', 'unknown']),
    })
  ),
});

type Props = z.infer<typeof WaitTimeVideoSchema>;

const COLORS = {
  low:     '#22c55e',
  medium:  '#f59e0b',
  high:    '#ef4444',
  unknown: '#6b7280',
};

const LABELS = {
  low:     'Rápido',
  medium:  'Moderado',
  high:    'Lento',
  unknown: 'Sin datos',
};

const TITLE_END_FRAME = 45; // 1.5s
const CARD_STAGGER    = 8;  // frames between each card sliding in
const FOOTER_DURATION = 30; // 1s footer fade

function CrossingCard({
  crossing,
  index,
}: {
  crossing: Props['crossings'][0];
  index: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const startFrame = TITLE_END_FRAME + index * CARD_STAGGER;

  const entrance = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 18, stiffness: 180, mass: 0.7 },
    durationInFrames: 20,
  });

  const translateY = interpolate(entrance, [0, 1], [50, 0]);
  const opacity    = interpolate(entrance, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });

  // Count-up from 0 to actual wait time
  const countStart = startFrame + 5;
  const countEnd   = startFrame + 20;
  const displayed  = Math.round(
    interpolate(frame, [countStart, countEnd], [0, crossing.wait], {
      extrapolateLeft:  'clamp',
      extrapolateRight: 'clamp',
    })
  );

  const color = COLORS[crossing.level];

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 20,
        padding: '22px 36px',
        marginBottom: 14,
        borderLeft: `10px solid ${color}`,
      }}
    >
      <div>
        <div style={{ fontSize: 34, fontWeight: 700, color: 'white', marginBottom: 6 }}>
          {crossing.name}
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, color }}>
          ● {crossing.wait === 0 && crossing.level === 'low' ? 'Sin espera' : LABELS[crossing.level]}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {crossing.level === 'unknown' ? (
          <>
            <div style={{ fontSize: 68, fontWeight: 900, color, lineHeight: 1 }}>--</div>
            <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>minutos</div>
          </>
        ) : crossing.wait === 0 ? (
          <>
            <div style={{ fontSize: 56, fontWeight: 900, color, lineHeight: 1, letterSpacing: 1 }}>LIBRE</div>
            <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>pasa ya</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 68, fontWeight: 900, color, lineHeight: 1 }}>{displayed}</div>
            <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>minutos</div>
          </>
        )}
      </div>
    </div>
  );
}

export const WaitTimeVideo: React.FC<Props> = ({ crossings }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const freeCount = crossings.filter(c => c.wait === 0 && c.level === 'low').length;
  const allClear = freeCount >= Math.ceil(crossings.length * 0.6);

  // Title entrance
  const titleSpring = spring({ frame, fps, config: { damping: 200 } });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleScale   = interpolate(titleSpring, [0, 1], [0.85, 1]);

  // Blinking live dot
  const blinkCycle  = frame % Math.round(fps * 0.9);
  const blinkOpacity = interpolate(
    blinkCycle,
    [0, Math.round(fps * 0.45), Math.round(fps * 0.9)],
    [1, 0.15, 1],
    { extrapolateRight: 'clamp' }
  );

  // Footer fade in
  const footerStartFrame = durationInFrames - FOOTER_DURATION - 30;
  const footerOpacity = interpolate(
    frame,
    [footerStartFrame, footerStartFrame + FOOTER_DURATION],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1a2744 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif',
        padding: '72px 56px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          textAlign: 'center',
          marginBottom: 44,
        }}
      >
        <div
          style={{
            fontSize: 26,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 5,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          cruzar · frontera
        </div>
        <div
          style={{
            fontSize: allClear ? 80 : 72,
            fontWeight: 900,
            color: allClear ? '#22c55e' : 'white',
            lineHeight: 1.05,
            marginBottom: 16,
            whiteSpace: 'pre-line',
          }}
        >
          {allClear ? 'PUENTES\nLIBRES' : 'TIEMPOS\nDE ESPERA'}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#ef4444',
              opacity: blinkOpacity,
            }}
          />
          <span style={{ fontSize: 30, color: '#ef4444', fontWeight: 700 }}>
            EN VIVO
          </span>
          <span style={{ fontSize: 26, color: 'rgba(255,255,255,0.35)' }}>
            · {timeStr}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1 }}>
        {crossings.map((crossing, i) => (
          <CrossingCard key={crossing.portId} crossing={crossing} index={i} />
        ))}
      </div>

      {/* Footer CTA */}
      <div
        style={{
          opacity: footerOpacity,
          textAlign: 'center',
          paddingTop: 28,
          borderTop: '1px solid rgba(255,255,255,0.12)',
          marginTop: 8,
        }}
      >
        <div style={{ fontSize: 38, fontWeight: 800, color: 'white', marginBottom: 8 }}>
          cruzar.app
        </div>
        <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.45)' }}>
          Reporta tu espera · Ayuda a todos 🌉
        </div>
      </div>
    </AbsoluteFill>
  );
};
