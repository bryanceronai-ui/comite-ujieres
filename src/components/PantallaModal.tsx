import React, { useState, useEffect } from 'react';
import { AjustesPantalla, AcompanarCulto, ModoPantallaGrupos, RegistroAsistencia } from '../types';
import { DEFAULT_AJUSTES_PANTALLA } from '../utils/storage';

interface PantallaModalProps {
  open: boolean;
  ajustes: AjustesPantalla;
  registro?: RegistroAsistencia | null;
  mode?: 'config' | 'send';
  onSave: (next: AjustesPantalla) => void;
  onSend?: (registro: RegistroAsistencia, next: AjustesPantalla) => void;
  onClose: () => void;
}

const SAMPLE_GROUPS = [
  { label: 'Hermanos', value: 120 },
  { label: 'Niños', value: 45 },
  { label: 'Jóvenes', value: 32 },
  { label: 'Amigos', value: 18 },
];

const FONT_OPTIONS = [
  'Georgia',
  'Lora',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Times New Roman',
  'Arial',
];

export const PantallaModal: React.FC<PantallaModalProps> = ({
  open,
  ajustes,
  registro,
  mode = 'config',
  onSave,
  onSend,
  onClose,
}) => {
  const [draft, setDraft] = useState<AjustesPantalla>(ajustes);

  useEffect(() => {
    if (open) {
      setDraft(ajustes);
    }
  }, [open, ajustes]);

  if (!open) return null;

  const scaleFactor = draft.tamanoTexto / 100;
  const previewBottomPx = Math.max(8, Math.round((draft.distanciaInferior / 1080) * 260));

  // Use real record data if provided, otherwise sample preview data
  const usingRealRecord = Boolean(registro);
  const previewGroups =
    registro && registro.modo === 'grupos' && registro.grupos
      ? Object.entries(registro.grupos)
          .filter(([, value]) => value > 0)
          .map(([label, value]) => ({ label, value }))
      : !registro
      ? SAMPLE_GROUPS
      : [];

  const previewTotal = registro ? registro.total : 215;
  const previewCulto = registro
    ? registro.tipoCulto && registro.tipoCulto !== 'Sin especificar'
      ? registro.tipoCulto
      : ''
    : 'Culto de damas Dorcas';

  const showDetailedGroups =
    draft.modoGrupos === 'cada-grupo' &&
    (!registro || registro.modo === 'grupos') &&
    previewGroups.length > 0;

  const twoColumns = previewGroups.length > 6;

  const renderCultoPreview = () => {
    if (!previewCulto) return null;

    const textStyle: React.CSSProperties = {
      color: draft.colorCulto,
      fontFamily: draft.letraCulto,
      fontStyle: draft.cursivaCulto ? 'italic' : 'normal',
    };

    const label = previewCulto;

    if (draft.acompanarCon === 'linea-superior') {
      return (
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-px w-36 bg-current opacity-40" style={{ color: draft.colorCulto }} />
          <span style={textStyle} className="text-[18px] sm:text-[20px] tracking-wide">
            {label}
          </span>
        </div>
      );
    }

    if (draft.acompanarCon === 'guiones') {
      return (
        <span style={textStyle} className="text-[18px] sm:text-[20px] tracking-wide">
          — {label} —
        </span>
      );
    }

    if (draft.acompanarCon === 'marco-sutil') {
      return (
        <span
          style={{
            ...textStyle,
            borderColor: `${draft.colorCulto}44`,
          }}
          className="rounded border px-4 py-1 text-[17px] sm:text-[19px] tracking-wide"
        >
          {label}
        </span>
      );
    }

    return (
      <span style={textStyle} className="text-[18px] sm:text-[20px] tracking-wide">
        {label}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pantalla-modal-title"
    >
      <div className="w-full max-w-[1060px] max-h-[92vh] overflow-y-auto rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl">
        <div className="mb-6">
          <h2 id="pantalla-modal-title" className="text-[24px] font-semibold text-white">
            Cómo se ve en pantalla
          </h2>
          <p className="mt-1.5 text-[17px] text-[#9ca3b0]">
            {usingRealRecord
              ? 'Vista previa con los datos de este registro. Ajusta el estilo antes de proyectar.'
              : 'Al pulsar «Enviar a pantalla» en un registro. La vista previa es aproximada.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-12">
          {/* Left: Live preview + rules */}
          <div className="flex flex-col justify-between lg:col-span-6">
            <div>
              <div
                className="relative flex aspect-[16/10] w-full flex-col items-center justify-center overflow-hidden rounded-[12px] border border-[#2a3142] px-6 shadow-inner"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 35%, #162544 0%, #0b1326 60%, #060a14 100%)',
                }}
              >
                <div
                  className={`flex w-full ${twoColumns ? 'max-w-[92%]' : 'max-w-[82%]'} flex-col items-center transition-transform duration-150`}
                  style={{
                    transform: `scale(${Math.min(1.12, Math.max(0.55, scaleFactor))})`,
                    marginBottom: `${Math.min(54, previewBottomPx + 20)}px`,
                  }}
                >
                  <div className="mb-2.5 text-[20px] sm:text-[22px] font-bold tracking-tight text-white">
                    Asistencia de hoy
                  </div>

                  {showDetailedGroups ? (
                    <div className="w-full">
                      <div
                        className={
                          twoColumns
                            ? 'grid grid-cols-2 gap-x-5 gap-y-1 text-[13px] sm:text-[14px] font-semibold'
                            : 'space-y-1 text-[16px] sm:text-[18px] font-semibold'
                        }
                      >
                        {previewGroups.map((g) => (
                          <div key={g.label} className="flex items-baseline gap-2 text-white">
                            <span className="shrink-0">{g.label}</span>
                            <span className="flex-1 overflow-hidden border-b border-dotted border-white/35" />
                            <span className="shrink-0 font-mono-tabular">{g.value}</span>
                          </div>
                        ))}
                      </div>
                      <div
                        className="mt-2 flex items-baseline gap-2 border-t border-white/15 pt-1.5 text-[20px] sm:text-[22px] font-bold"
                        style={{ color: draft.colorTotal }}
                      >
                        <span className="shrink-0">Total</span>
                        <span
                          className="flex-1 overflow-hidden border-b border-dotted"
                          style={{ borderColor: `${draft.colorTotal}66` }}
                        />
                        <span className="shrink-0 font-mono-tabular">{previewTotal}</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="font-mono-tabular text-[68px] sm:text-[78px] font-bold leading-none tracking-tight"
                      style={{ color: draft.colorTotal }}
                    >
                      {previewTotal}
                    </div>
                  )}
                </div>

                <div
                  className="absolute inset-x-0 flex justify-center px-4 text-center"
                  style={{ bottom: `${previewBottomPx}px` }}
                >
                  {renderCultoPreview()}
                </div>
              </div>

              <p className="mt-3.5 text-[15px] leading-relaxed text-[#8f96a4]">
                Por grupos: un renglón por grupo (los que están en 0 no salen) y el total debajo;
                con más de 6 grupos, en dos columnas. Un registro de solo el total envía siempre el
                total. Al 100 %, el texto es el mayor que cabe en la pantalla.
              </p>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setDraft(DEFAULT_AJUSTES_PANTALLA)}
                className="min-h-[44px] text-[15px] font-medium text-[#9ca3b0] underline decoration-[#555c6b] underline-offset-4 transition-colors hover:text-[#F2A65A]"
              >
                Valores de fábrica
              </button>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex flex-col justify-between gap-5 lg:col-span-6">
            <div className="space-y-5">
              {/* Group 1: Texto */}
              <fieldset className="rounded-[12px] border border-[#2a2f3a] px-5 pb-5 pt-3">
                <legend className="px-2 text-[15px] font-medium text-[#9ca3b0]">Texto</legend>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2 md:grid md:grid-cols-12 md:items-center md:gap-3">
                    <label
                      htmlFor="ajuste-modo-grupos"
                      className="text-[15px] text-[#c7ccd6] md:col-span-5"
                    >
                      De un registro por grupos
                    </label>
                    <select
                      id="ajuste-modo-grupos"
                      value={draft.modoGrupos}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          modoGrupos: e.target.value as ModoPantallaGrupos,
                        }))
                      }
                      className="min-h-[56px] w-full rounded-[12px] border border-[#343a47] bg-[#12151b] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden md:col-span-7"
                    >
                      <option value="cada-grupo">Cada grupo y el total</option>
                      <option value="solo-total">Solo el total</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2 md:grid md:grid-cols-12 md:items-center md:gap-3">
                    <label
                      htmlFor="ajuste-tamano-texto"
                      className="text-[15px] text-[#c7ccd6] md:col-span-5"
                    >
                      Tamaño del texto
                    </label>
                    <div className="flex items-center gap-3 md:col-span-7">
                      <input
                        id="ajuste-tamano-texto"
                        type="range"
                        min={50}
                        max={110}
                        step={5}
                        value={draft.tamanoTexto}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            tamanoTexto: Number(e.target.value),
                          }))
                        }
                        className="h-2 flex-1 cursor-pointer accent-[#7fb3f5]"
                      />
                      <span className="w-14 text-right font-mono-tabular text-[16px] text-[#e6e8ec]">
                        {draft.tamanoTexto} %
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:grid md:grid-cols-12">
                    <label
                      htmlFor="ajuste-color-total"
                      className="text-[15px] text-[#c7ccd6] md:col-span-5"
                    >
                      Color del total
                    </label>
                    <div className="flex justify-end md:col-span-7">
                      <input
                        id="ajuste-color-total"
                        type="color"
                        value={draft.colorTotal}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, colorTotal: e.target.value }))
                        }
                        className="h-11 w-16 cursor-pointer rounded-[12px] border border-[#343a47] bg-[#12151b] p-1"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Group 2: Tipo de culto (abajo) */}
              <fieldset className="rounded-[12px] border border-[#2a2f3a] px-5 pb-5 pt-3">
                <legend className="px-2 text-[15px] font-medium text-[#9ca3b0]">
                  Tipo de culto (abajo)
                </legend>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 md:grid md:grid-cols-12">
                    <label
                      htmlFor="ajuste-color-culto"
                      className="text-[15px] text-[#c7ccd6] md:col-span-5"
                    >
                      Color
                    </label>
                    <div className="flex justify-end md:col-span-7">
                      <input
                        id="ajuste-color-culto"
                        type="color"
                        value={draft.colorCulto}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, colorCulto: e.target.value }))
                        }
                        className="h-11 w-16 cursor-pointer rounded-[12px] border border-[#343a47] bg-[#12151b] p-1"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 md:grid md:grid-cols-12 md:items-center md:gap-3">
                    <label
                      htmlFor="ajuste-letra-culto"
                      className="text-[15px] text-[#c7ccd6] md:col-span-5"
                    >
                      Letra
                    </label>
                    <select
                      id="ajuste-letra-culto"
                      value={draft.letraCulto}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, letraCulto: e.target.value }))
                      }
                      className="min-h-[56px] w-full rounded-[12px] border border-[#343a47] bg-[#12151b] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden md:col-span-7"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <input
                      id="ajuste-cursiva-culto"
                      type="checkbox"
                      checked={draft.cursivaCulto}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, cursivaCulto: e.target.checked }))
                      }
                      className="h-5 w-5 cursor-pointer rounded border-[#343a47] accent-[#7fb3f5]"
                    />
                    <label
                      htmlFor="ajuste-cursiva-culto"
                      className="cursor-pointer text-[16px] text-[#c7ccd6]"
                    >
                      Cursiva
                    </label>
                  </div>

                  <div className="flex flex-col gap-2 md:grid md:grid-cols-12 md:items-center md:gap-3">
                    <label
                      htmlFor="ajuste-acompanar"
                      className="text-[15px] text-[#c7ccd6] md:col-span-5"
                    >
                      Acompañarlo con
                    </label>
                    <select
                      id="ajuste-acompanar"
                      value={draft.acompanarCon}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          acompanarCon: e.target.value as AcompanarCulto,
                        }))
                      }
                      className="min-h-[56px] w-full rounded-[12px] border border-[#343a47] bg-[#12151b] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden md:col-span-7"
                    >
                      <option value="ninguno">Ninguno</option>
                      <option value="linea-superior">Línea superior</option>
                      <option value="guiones">Guiones laterales</option>
                      <option value="marco-sutil">Marco sutil</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2 md:grid md:grid-cols-12 md:items-center md:gap-3">
                    <label
                      htmlFor="ajuste-distancia"
                      className="text-[15px] text-[#c7ccd6] md:col-span-5"
                    >
                      Distancia desde el borde inferior
                    </label>
                    <div className="flex items-center gap-2 md:col-span-7">
                      <input
                        id="ajuste-distancia"
                        type="range"
                        min={15}
                        max={160}
                        step={5}
                        value={draft.distanciaInferior}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            distanciaInferior: Number(e.target.value),
                          }))
                        }
                        className="h-2 flex-1 cursor-pointer accent-[#7fb3f5]"
                      />
                      <input
                        type="number"
                        min={0}
                        max={300}
                        value={draft.distanciaInferior}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(300, Number(e.target.value) || 0));
                          setDraft((prev) => ({ ...prev, distanciaInferior: val }));
                        }}
                        className="min-h-[56px] w-24 rounded-[12px] border border-[#343a47] bg-[#12151b] p-[16px] text-right font-mono-tabular text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                      />
                      <span className="text-[15px] text-[#9ca3b0]">px</span>
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#242832] px-[28px] text-[17px] font-medium text-[#d4d8e0] transition-colors hover:bg-[#2d323e] hover:text-white whitespace-nowrap md:w-auto shrink-0"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onSave(draft)}
                className="min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] whitespace-nowrap md:w-auto shrink-0"
              >
                {mode === 'send' && registro ? 'Guardar ajustes' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
