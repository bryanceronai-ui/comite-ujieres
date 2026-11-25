import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Eraser, ArrowLeft } from 'lucide-react';
import { AjustesPantalla, PantallaRuletaState, RegistroAsistencia } from '../types';
import {
  DEFAULT_AJUSTES_PANTALLA,
  loadAllData,
  loadPantallaActual,
  loadPantallaRuleta,
  PANTALLA_CHANNEL_NAME,
  PantallaSyncMessage,
  sendRuletaToPantalla,
  sendToPantalla,
  STORAGE_KEYS,
} from '../utils/storage';
import { RuletaStage } from './RuletaStage';

interface PantallaViewProps {
  onExit?: () => void;
}

export const PantallaView: React.FC<PantallaViewProps> = ({ onExit }) => {
  const [registro, setRegistro] = useState<RegistroAsistencia | null>(() => loadPantallaActual());
  const [ajustes, setAjustes] = useState<AjustesPantalla>(() => loadAllData().ajustesPantalla);
  const [pantallaRuleta, setPantallaRuleta] = useState<PantallaRuletaState | null>(() =>
    loadPantallaRuleta()
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.PANTALLA_ACTUAL) {
        setRegistro(loadPantallaActual());
      }
      if (e.key === STORAGE_KEYS.AJUSTES_PANTALLA) {
        setAjustes(loadAllData().ajustesPantalla);
      }
      if (e.key === STORAGE_KEYS.PANTALLA_RULETA) {
        setPantallaRuleta(loadPantallaRuleta());
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        sendRuletaToPantalla(null);
        setPantallaRuleta(null);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('keydown', handleKeyDown);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(PANTALLA_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<PantallaSyncMessage>) => {
        if (event.data?.type === 'PANTALLA_REGISTRO') {
          setRegistro(event.data.payload);
        } else if (event.data?.type === 'PANTALLA_AJUSTES') {
          setAjustes({ ...DEFAULT_AJUSTES_PANTALLA, ...event.data.payload });
        } else if (event.data?.type === 'PANTALLA_RULETA') {
          setPantallaRuleta(event.data.payload);
        }
      };
    }

    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
      channel?.close();
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be restricted by browser sandbox
    }
  };

  const handleClear = () => {
    sendToPantalla(null);
    sendRuletaToPantalla(null);
    setRegistro(null);
    setPantallaRuleta(null);
  };

  // Determine lines to render
  const nonZeroGroups =
    registro && registro.modo === 'grupos' && registro.grupos
      ? Object.entries(registro.grupos).filter(([, count]) => count > 0)
      : [];

  const showDetailedGroups =
    Boolean(registro) &&
    registro?.modo === 'grupos' &&
    ajustes.modoGrupos === 'cada-grupo' &&
    nonZeroGroups.length > 0;

  const twoColumns = nonZeroGroups.length > 6;
  const scale = ajustes.tamanoTexto / 100;

  // Compute responsive base font size so at 100% it fills the screen cleanly
  const titleFontSize = `clamp(2rem, ${(3.8 * scale).toFixed(2)}vw, ${(4.6 * scale).toFixed(2)}rem)`;
  const rowFontSize = twoColumns
    ? `clamp(1.25rem, ${(2.2 * scale).toFixed(2)}vw, ${(2.7 * scale).toFixed(2)}rem)`
    : `clamp(1.5rem, ${(2.8 * scale).toFixed(2)}vw, ${(3.4 * scale).toFixed(2)}rem)`;
  const totalRowFontSize = twoColumns
    ? `clamp(1.5rem, ${(2.7 * scale).toFixed(2)}vw, ${(3.3 * scale).toFixed(2)}rem)`
    : `clamp(1.9rem, ${(3.4 * scale).toFixed(2)}vw, ${(4.1 * scale).toFixed(2)}rem)`;
  const bigTotalFontSize = `clamp(4.5rem, ${(14 * scale).toFixed(2)}vw, ${(16 * scale).toFixed(2)}rem)`;

  const showCulto =
    registro && registro.tipoCulto && registro.tipoCulto !== 'Sin especificar';

  const renderCultoBottom = () => {
    if (!showCulto || !registro) return null;

    const textStyle: React.CSSProperties = {
      color: ajustes.colorCulto,
      fontFamily: ajustes.letraCulto,
      fontStyle: ajustes.cursivaCulto ? 'italic' : 'normal',
    };

    if (ajustes.acompanarCon === 'linea-superior') {
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="h-px w-64 opacity-40" style={{ backgroundColor: ajustes.colorCulto }} />
          <p style={textStyle} className="text-2xl md:text-4xl tracking-wide">
            {registro.tipoCulto}
          </p>
        </div>
      );
    }

    if (ajustes.acompanarCon === 'guiones') {
      return (
        <p style={textStyle} className="text-2xl md:text-4xl tracking-wide">
          — {registro.tipoCulto} —
        </p>
      );
    }

    if (ajustes.acompanarCon === 'marco-sutil') {
      return (
        <p
          style={{ ...textStyle, borderColor: `${ajustes.colorCulto}44` }}
          className="rounded-lg border px-8 py-2 text-2xl md:text-4xl tracking-wide"
        >
          {registro.tipoCulto}
        </p>
      );
    }

    return (
      <p style={textStyle} className="text-2xl md:text-4xl tracking-wide">
        {registro.tipoCulto}
      </p>
    );
  };

  return (
    <div
      className="group relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden select-none px-8"
      style={{
        background:
          'radial-gradient(ellipse at 50% 35%, #162749 0%, #0b1428 58%, #050912 100%)',
      }}
    >
      {/* Top-right subtle church watermark logo */}
      <img
        src="/assets/aistudio/Color-Borde-blanco_fcabe59b.png"
        alt="Logo IPUE Barakaldo"
        className="pointer-events-none fixed right-6 top-6 z-10 h-[140px] w-[140px] object-contain opacity-50"
      />

      {/* Subtle hover-only controls */}
      <div className="fixed right-5 top-5 z-20 flex items-center gap-2 opacity-20 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/45 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </button>
        )}
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/45 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70"
          title="Limpiar pantalla"
        >
          <Eraser className="h-3.5 w-3.5" />
          Limpiar
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/45 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70"
          title="Pantalla completa"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {isFullscreen ? 'Salir' : 'Pantalla completa'}
        </button>
      </div>

      {pantallaRuleta?.activa ? (
        <div className="absolute inset-0 z-0">
          <RuletaStage
            fullscreen
            nombres={pantallaRuleta.nombres}
            titulo={pantallaRuleta.titulo}
            fondo={pantallaRuleta.fondo}
            fondoPersonalizado={pantallaRuleta.fondoPersonalizado}
            sonido={pantallaRuleta.sonido}
            confeti={pantallaRuleta.confeti}
            anguloInicial={pantallaRuleta.anguloActual}
            spinPayload={pantallaRuleta.spin}
            ultimoGanador={pantallaRuleta.ultimoGanador}
          />
        </div>
      ) : !registro ? (
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-wide text-white/40 md:text-3xl">
            IPUE Barakaldo
          </p>
          <p className="mt-3 text-sm text-white/25">
            Esperando registro desde «Enviar a pantalla»
          </p>
        </div>
      ) : (
        <div
          className="flex w-full max-w-5xl flex-col items-center"
          style={{ paddingBottom: `${Math.min(180, ajustes.distanciaInferior)}px` }}
        >
          <h1
            className="mb-8 text-center font-bold tracking-tight text-white"
            style={{ fontSize: titleFontSize }}
          >
            Asistencia de hoy
          </h1>

          {showDetailedGroups ? (
            <div className="w-full max-w-4xl">
              <div
                className={
                  twoColumns
                    ? 'grid grid-cols-1 gap-x-14 gap-y-3 md:grid-cols-2'
                    : 'mx-auto max-w-2xl space-y-3'
                }
              >
                {nonZeroGroups.map(([label, count]) => (
                  <div
                    key={label}
                    className="flex items-baseline gap-4 font-semibold text-white"
                    style={{ fontSize: rowFontSize }}
                  >
                    <span className="shrink-0">{label}</span>
                    <span className="flex-1 border-b-2 border-dotted border-white/35" />
                    <span className="shrink-0 font-mono-tabular">{count}</span>
                  </div>
                ))}
              </div>

              <div
                className={`${twoColumns ? 'max-w-4xl' : 'mx-auto max-w-2xl'} mt-6 flex items-baseline gap-4 border-t border-white/15 pt-5 font-bold`}
                style={{ fontSize: totalRowFontSize, color: ajustes.colorTotal }}
              >
                <span className="shrink-0">Total</span>
                <span
                  className="flex-1 border-b-2 border-dotted"
                  style={{ borderColor: `${ajustes.colorTotal}66` }}
                />
                <span className="shrink-0 font-mono-tabular">{registro.total}</span>
              </div>
            </div>
          ) : (
            <div
              className="font-mono-tabular font-bold leading-none tracking-tight"
              style={{ fontSize: bigTotalFontSize, color: ajustes.colorTotal }}
            >
              {registro.total}
            </div>
          )}
        </div>
      )}

      {/* Cult type anchored at configured bottom distance */}
      {!pantallaRuleta?.activa && showCulto && (
        <div
          className="fixed inset-x-0 flex justify-center px-6 text-center"
          style={{ bottom: `${ajustes.distanciaInferior}px` }}
        >
          {renderCultoBottom()}
        </div>
      )}
    </div>
  );
};
