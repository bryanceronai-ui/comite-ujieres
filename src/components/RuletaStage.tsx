import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FondoRuleta, FondoRuletaPersonalizado, SonidoRuleta, SpinRuletaPayload } from '../types';

export const RULETA_SLICE_COLORS = [
  '#c85103', // burnt orange
  '#ba382c', // crimson red
  '#0f766e', // deep teal
  '#1d4ed8', // royal blue
  '#7c3aed', // violet
  '#b45309', // warm amber
  '#15803d', // emerald
  '#be185d', // magenta
];

export function getSliceColor(index: number, total: number): string {
  const base = RULETA_SLICE_COLORS[index % RULETA_SLICE_COLORS.length];
  // Avoid first and last slice sharing the exact same color when total > 1
  if (total > 1 && index === total - 1 && total % RULETA_SLICE_COLORS.length === 1) {
    return RULETA_SLICE_COLORS[2];
  }
  return base;
}

// Deterministic pseudo-random stars/particles so background doesn't flicker on re-renders
const STAR_ITEMS = Array.from({ length: 42 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const x = ((seed * 17) % 1000) / 10;
  const y = ((seed * 31 + i * 73) % 1000) / 10;
  const size = 6 + (i % 5) * 4;
  const isSpark = i % 3 === 0;
  const opacity = 0.45 + ((i * 19) % 55) / 100;
  return { id: i, x, y, size, isSpark, opacity };
});

const DUST_DOTS = Array.from({ length: 56 }, (_, i) => {
  const x = ((i * 137 + 29) % 980) / 10 + 1;
  const y = ((i * 251 + 61) % 980) / 10 + 1;
  const r = i % 4 === 0 ? 2.5 : 1.5;
  const opacity = 0.25 + ((i * 13) % 60) / 100;
  return { id: i, x, y, r, opacity };
});

const CONFETTI_PIECES = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  left: ((i * 73 + 11) % 94) + 3,
  delay: (i % 10) * 0.08,
  duration: 2.2 + (i % 5) * 0.35,
  color: ['#FFD84D', '#F2A65A', '#EF4444', '#38BDF8', '#4ADE80', '#C084FC'][i % 6],
  drift: ((i % 7) - 3) * 28,
  rot: (i * 47) % 360,
  isCircle: i % 4 === 0,
}));

// Web Audio synthesizer for wheel ticks and win chime
class RuletaAudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    try {
      if (typeof window === 'undefined') return null;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  playTick(sonido: SonidoRuleta) {
    if (sonido === 'silencio') return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (sonido === 'campana') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1180, now);
        osc.frequency.exponentialRampToValueAtTime(860, now + 0.045);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      } else if (sonido === 'suave') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.035);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      } else {
        // clasico
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(720, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Ignore audio failures
    }
  }

  playWin(sonido: SonidoRuleta) {
    if (sonido === 'silencio') return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes =
        sonido === 'campana'
          ? [659.25, 830.61, 987.77, 1318.51]
          : sonido === 'suave'
            ? [392.0, 493.88, 587.33, 783.99]
            : [523.25, 659.25, 783.99, 1046.5];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.08;
        const dur = idx === notes.length - 1 ? 0.55 : 0.25;

        osc.type = sonido === 'campana' ? 'sine' : sonido === 'suave' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(sonido === 'suave' ? 0.08 : 0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {
      // Ignore audio failures
    }
  }
}

const audioEngine = new RuletaAudioEngine();

export const RuletaFondoLayer: React.FC<{
  fondo: FondoRuleta;
  personalizado?: FondoRuletaPersonalizado;
  compact?: boolean;
}> = ({ fondo, personalizado, compact = false }) => {
  if (fondo === 'personalizado' && personalizado) {
    if (personalizado.tipo === 'imagen' && personalizado.valor) {
      return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={personalizado.valor}
            alt="Fondo personalizado"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/25" />
        </div>
      );
    }
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${personalizado.valor || '#0c1c47'} 0%, #070b14 100%)`,
        }}
      />
    );
  }

  if (fondo === 'fiesta') {
    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, #6b1d7a 0%, #370b4d 52%, #170426 100%)',
        }}
      >
        <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-[#ec4899]/25 blur-3xl" />
        <div className="absolute -bottom-16 -right-12 h-72 w-72 rounded-full bg-[#8b5cf6]/30 blur-3xl" />
        <div className="absolute right-12 top-10 h-40 w-40 rounded-full bg-[#f59e0b]/20 blur-2xl" />
        {!compact &&
          STAR_ITEMS.slice(0, 24).map((s) => (
            <div
              key={s.id}
              className="absolute rounded-full"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${Math.max(4, s.size * 0.6)}px`,
                height: `${Math.max(4, s.size * 0.6)}px`,
                backgroundColor: ['#f472b6', '#fbbf24', '#38bdf8', '#c084fc'][s.id % 4],
                opacity: s.opacity * 0.7,
              }}
            />
          ))}
      </div>
    );
  }

  if (fondo === 'feria') {
    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, #7c2d12 0%, #431407 62%, #1f0803 100%)',
        }}
      >
        <div
          className="absolute inset-[-40%] opacity-40"
          style={{
            background:
              'repeating-conic-gradient(from 0deg, rgba(245, 158, 11, 0.42) 0deg 15deg, rgba(153, 27, 27, 0.25) 15deg 30deg)',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_25%,rgba(15,5,2,0.72)_95%)]" />
      </div>
    );
  }

  if (fondo === 'globos') {
    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 45%, #0f172a 100%)',
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.25),transparent_50%)]" />
        {/* Stylized SVG balloons */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 400 260"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {[
            { cx: 46, cy: 76, r: 22, fill: '#ef4444' },
            { cx: 88, cy: 112, r: 18, fill: '#facc15' },
            { cx: 38, cy: 175, r: 20, fill: '#22c55e' },
            { cx: 344, cy: 68, r: 23, fill: '#ec4899' },
            { cx: 312, cy: 120, r: 17, fill: '#38bdf8' },
            { cx: 358, cy: 178, r: 21, fill: '#f97316' },
            { cx: 115, cy: 48, r: 15, fill: '#a855f7' },
            { cx: 280, cy: 42, r: 14, fill: '#4ade80' },
          ].map((b, idx) => (
            <g key={idx} opacity={compact ? 0.9 : 0.82}>
              <line
                x1={b.cx}
                y1={b.cy + b.r * 1.15}
                x2={b.cx + (idx % 2 === 0 ? 5 : -5)}
                y2={b.cy + b.r * 2.5}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1.2"
              />
              <ellipse cx={b.cx} cy={b.cy} rx={b.r * 0.88} ry={b.r * 1.12} fill={b.fill} />
              <ellipse
                cx={b.cx - b.r * 0.28}
                cy={b.cy - b.r * 0.35}
                rx={b.r * 0.22}
                ry={b.r * 0.36}
                fill="rgba(255,255,255,0.35)"
                transform={`rotate(-20 ${b.cx - b.r * 0.28} ${b.cy - b.r * 0.35})`}
              />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // Default: 'estrellas' (matches reference screenshot closely)
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 50% 45%, #16306e 0%, #0d1d47 58%, #071029 100%)',
      }}
    >
      {/* Soft bokeh glow circles */}
      <div className="absolute left-[10%] top-[18%] h-40 w-40 rounded-full bg-[#38bdf8]/12 blur-xl" />
      <div className="absolute right-[12%] top-[24%] h-44 w-44 rounded-full bg-[#6366f1]/15 blur-xl" />
      <div className="absolute bottom-[14%] left-[20%] h-36 w-36 rounded-full bg-[#8b5cf6]/15 blur-xl" />
      <div className="absolute bottom-[10%] right-[16%] h-48 w-48 rounded-full bg-[#0ea5e9]/12 blur-2xl" />

      {/* Tiny stardust dots */}
      {!compact &&
        DUST_DOTS.map((d) => (
          <div
            key={`dust_${d.id}`}
            className="absolute rounded-full bg-white"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: `${d.r}px`,
              height: `${d.r}px`,
              opacity: d.opacity,
            }}
          />
        ))}

      {/* Golden stars and 4-point sparkles */}
      {(compact ? STAR_ITEMS.slice(0, 14) : STAR_ITEMS).map((s) => (
        <svg
          key={`star_${s.id}`}
          viewBox="0 0 24 24"
          className="absolute"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${compact ? Math.max(6, s.size * 0.55) : s.size}px`,
            height: `${compact ? Math.max(6, s.size * 0.55) : s.size}px`,
            opacity: s.opacity,
          }}
          aria-hidden="true"
        >
          {s.isSpark ? (
            <path
              d="M12 1 L14.4 9.6 L23 12 L14.4 14.4 L12 23 L9.6 14.4 L1 12 L9.6 9.6 Z"
              fill="#FDE68A"
            />
          ) : (
            <path
              d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z"
              fill="#FACC15"
            />
          )}
        </svg>
      ))}
    </div>
  );
};

function describePieSlice(
  cx: number,
  cy: number,
  r: number,
  startDegClockwiseFromTop: number,
  endDegClockwiseFromTop: number
): string {
  const startRad = ((startDegClockwiseFromTop - 90) * Math.PI) / 180;
  const endRad = ((endDegClockwiseFromTop - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endDegClockwiseFromTop - startDegClockwiseFromTop > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

interface RuletaStageProps {
  nombres: string[];
  titulo?: string;
  fondo: FondoRuleta;
  fondoPersonalizado?: FondoRuletaPersonalizado;
  sonido: SonidoRuleta;
  confeti: boolean;
  anguloInicial?: number;
  spinPayload?: SpinRuletaPayload | null;
  ultimoGanador?: string | null;
  onSpinEnd?: (finalAngle: number, winner: string) => void;
  fullscreen?: boolean;
}

export const RuletaStage: React.FC<RuletaStageProps> = ({
  nombres,
  titulo,
  fondo,
  fondoPersonalizado,
  sonido,
  confeti,
  anguloInicial = 0,
  spinPayload,
  ultimoGanador,
  onSpinEnd,
  fullscreen = false,
}) => {
  const [angle, setAngle] = useState<number>(anguloInicial);
  const [showConfetti, setShowConfetti] = useState(false);
  const [displayWinner, setDisplayWinner] = useState<string | null>(ultimoGanador || null);
  const [confettiKey, setConfettiKey] = useState(0);

  const lastHandledSpinIdRef = useRef<string | null>(null);
  const onSpinEndRef = useRef(onSpinEnd);
  onSpinEndRef.current = onSpinEnd;

  useEffect(() => {
    if (!spinPayload) {
      setAngle(anguloInicial);
      setDisplayWinner(ultimoGanador || null);
    }
  }, [anguloInicial, ultimoGanador, spinPayload]);

  useEffect(() => {
    if (!spinPayload) return;
    if (lastHandledSpinIdRef.current === spinPayload.id) return;
    lastHandledSpinIdRef.current = spinPayload.id;

    setShowConfetti(false);
    setDisplayWinner(null);

    const { startAngle, targetAngle, durationMs, winner } = spinPayload;
    const totalDelta = targetAngle - startAngle;
    const sliceDeg = nombres.length > 0 ? 360 / nombres.length : 360;
    let lastTickBucket = Math.floor(startAngle / sliceDeg);
    let animId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutQuint(progress);
      const current = startAngle + totalDelta * eased;

      setAngle(current);

      if (nombres.length > 1) {
        const currentBucket = Math.floor(current / sliceDeg);
        if (currentBucket !== lastTickBucket) {
          lastTickBucket = currentBucket;
          audioEngine.playTick(sonido);
        }
      }

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setAngle(targetAngle);
        setDisplayWinner(winner);
        audioEngine.playWin(sonido);
        if (confeti) {
          setConfettiKey((k) => k + 1);
          setShowConfetti(true);
        }
        onSpinEndRef.current?.(targetAngle, winner);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [spinPayload, nombres.length, sonido, confeti]);

  // Auto-hide confetti after animation completes
  useEffect(() => {
    if (!showConfetti) return;
    const t = setTimeout(() => setShowConfetti(false), 3800);
    return () => clearTimeout(t);
  }, [showConfetti]);

  const count = nombres.length;
  const sliceDeg = count > 0 ? 360 / count : 360;

  const labelFontSize = useMemo(() => {
    if (count <= 2) return 26;
    if (count <= 4) return 23;
    if (count <= 8) return 18;
    if (count <= 14) return 14;
    if (count <= 24) return 11;
    if (count <= 40) return 8.5;
    if (count <= 70) return 6.5;
    return 5;
  }, [count]);

  const maxLabelChars = useMemo(() => {
    if (count <= 8) return 18;
    if (count <= 24) return 15;
    if (count <= 60) return 13;
    return 11;
  }, [count]);

  return (
    <div
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden ${
        fullscreen ? 'h-full min-h-screen px-6 py-8' : 'h-full min-h-[440px] rounded-xl border border-[#2a2f3a] px-4 py-5'
      }`}
    >
      <RuletaFondoLayer fondo={fondo} personalizado={fondoPersonalizado} />

      {/* Confetti overlay */}
      {showConfetti && (
        <div
          key={confettiKey}
          className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
          aria-hidden="true"
        >
          {CONFETTI_PIECES.map((c) => (
            <span
              key={c.id}
              className="ruleta-confetti-piece absolute -top-4"
              style={
                {
                  left: `${c.left}%`,
                  width: c.isCircle ? '10px' : '11px',
                  height: c.isCircle ? '10px' : '6px',
                  borderRadius: c.isCircle ? '9999px' : '2px',
                  backgroundColor: c.color,
                  animationDelay: `${c.delay}s`,
                  animationDuration: `${c.duration}s`,
                  '--drift': `${c.drift}px`,
                  '--rot': `${c.rot}deg`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Optional title on screen */}
      {titulo && titulo.trim().length > 0 && (
        <div className="relative z-10 mb-3 text-center">
          <h2
            className={`font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)] ${
              fullscreen ? 'text-3xl md:text-5xl' : 'text-[22px] md:text-[26px]'
            }`}
          >
            {titulo}
          </h2>
        </div>
      )}

      {/* Wheel container */}
      <div
        className={`relative z-10 flex items-center justify-center ${
          fullscreen
            ? 'w-[min(82vw,76vh)] max-w-[780px]'
            : 'w-[min(100%,480px)]'
        }`}
      >
        <svg viewBox="0 0 500 500" className="h-auto w-full drop-shadow-[0_14px_34px_rgba(0,0,0,0.55)]">
          {/* Outer golden rim */}
          <circle cx="250" cy="250" r="238" fill="#E6B84C" />
          <circle cx="250" cy="250" r="230" fill="#111622" />

          {/* Rotating wheel group */}
          <g transform={`rotate(${angle} 250 250)`}>
            {count === 0 ? (
              <circle cx="250" cy="250" r="228" fill="#181c26" stroke="#2d3340" strokeWidth="2" />
            ) : count === 1 ? (
              <g>
                <circle cx="250" cy="250" r="228" fill={getSliceColor(0, 1)} />
                <text
                  x="250"
                  y="130"
                  fill="#FFFFFF"
                  fontSize="26"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.65)' }}
                >
                  {nombres[0].slice(0, 22)}
                </text>
              </g>
            ) : (
              nombres.map((nombre, idx) => {
                const startDeg = idx * sliceDeg;
                const endDeg = (idx + 1) * sliceDeg;
                const midDeg = startDeg + sliceDeg / 2;
                const fill = getSliceColor(idx, count);
                const truncated =
                  nombre.length > maxLabelChars
                    ? `${nombre.slice(0, maxLabelChars - 1)}…`
                    : nombre;

                // Keep text readable radially along the slice
                const flipText = midDeg > 180;
                const textRot = midDeg - 90;

                return (
                  <g key={`${idx}_${nombre}`}>
                    <path
                      d={describePieSlice(250, 250, 228, startDeg, endDeg)}
                      fill={fill}
                      stroke="rgba(255,255,255,0.22)"
                      strokeWidth={count > 40 ? 0.6 : 1.2}
                    />
                    <g transform={`rotate(${textRot} 250 250)`}>
                      <text
                        x={flipText ? 462 : 462}
                        y="250"
                        fill="#FFFFFF"
                        fontSize={labelFontSize}
                        fontWeight="700"
                        textAnchor={flipText ? 'start' : 'end'}
                        dominantBaseline="central"
                        transform={flipText ? 'rotate(180 462 250)' : undefined}
                        style={{
                          textShadow: '0 1px 3px rgba(0,0,0,0.75)',
                        }}
                      >
                        {truncated}
                      </text>
                    </g>
                  </g>
                );
              })
            )}

            {/* Inner golden hub ring */}
            <circle cx="250" cy="250" r="32" fill="#E6B84C" />
            <circle cx="250" cy="250" r="27" fill="#111622" />
          </g>

          {/* Top fixed golden pointer triangle at 12 o'clock */}
          <polygon
            points="250,40 232,6 268,6"
            fill="#F4C542"
            stroke="#854D0E"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>

        {count === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
            <span className="rounded-xl bg-[#0d0f14]/80 px-5 py-3 text-[16px] font-medium text-[#9ca3b0]">
              Añade nombres en la lista
            </span>
          </div>
        )}
      </div>

      {/* Winner callout badge */}
      {displayWinner && (
        <div
          className={`relative z-20 mt-4 flex items-center gap-3 rounded-xl border border-[#F4C542]/70 bg-[#0d0f14]/90 px-6 py-3 shadow-2xl backdrop-blur-sm ${
            fullscreen ? 'text-2xl md:text-4xl' : 'text-[20px]'
          }`}
        >
          <span aria-hidden="true">🎉</span>
          <span className="font-bold text-[#FFD84D]">{displayWinner}</span>
        </div>
      )}
    </div>
  );
};
