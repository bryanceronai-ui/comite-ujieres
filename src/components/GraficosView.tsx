import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { RegistroAsistencia } from '../types';
import { addDaysISO, formatFechaCorta, formatFechaLarga, getTodayMadridISO } from '../utils/dates';

interface GraficosViewProps {
  registros: RegistroAsistencia[];
  tiposCulto: string[];
  onGoRegistro: () => void;
}

const RANGOS = [
  { dias: 7, label: '7 días' },
  { dias: 15, label: '15 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' },
  { dias: 365, label: '365 días' },
];

function computeNiceMax(val: number): number {
  if (val <= 0) return 100;
  if (val <= 50) return Math.ceil(val / 10) * 10;
  if (val <= 200) return Math.ceil(val / 50) * 50;
  if (val <= 500) return Math.ceil(val / 100) * 100;
  return Math.ceil(val / 200) * 200;
}

export const GraficosView: React.FC<GraficosViewProps> = ({
  registros,
  tiposCulto,
  onGoRegistro,
}) => {
  const [rangoDias, setRangoDias] = useState<number>(30);
  const [cultoFiltro, setCultoFiltro] = useState<string>('Todos');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hoy = getTodayMadridISO();
  const fechaInicio = addDaysISO(hoy, -(rangoDias - 1));

  // Filter records by date range and cult type, sorted oldest -> newest for chart
  const filtrados = useMemo(() => {
    return registros
      .filter((r) => {
        if (r.fecha < fechaInicio || r.fecha > hoy) return false;
        if (cultoFiltro !== 'Todos' && r.tipoCulto !== cultoFiltro) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.creadoEn.localeCompare(b.creadoEn);
      });
  }, [registros, fechaInicio, hoy, cultoFiltro]);

  // Stats
  const totalRegistros = filtrados.length;
  const promedio = totalRegistros
    ? Math.round(filtrados.reduce((acc, r) => acc + r.total, 0) / totalRegistros)
    : 0;
  const maximo = totalRegistros ? Math.max(...filtrados.map((r) => r.total)) : 0;

  // Summary grouped by cult type
  const resumenPorCulto = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of filtrados) {
      const key = r.tipoCulto || 'Sin especificar';
      const arr = map.get(key) || [];
      arr.push(r.total);
      map.set(key, arr);
    }

    return Array.from(map.entries())
      .map(([tipo, totals]) => {
        const sum = totals.reduce((a, b) => a + b, 0);
        const max = Math.max(...totals);
        const avg = Math.round(sum / totals.length);
        return {
          tipo,
          reuniones: totals.length,
          promedio: avg,
          maximo: max,
          total: sum,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [filtrados]);

  // Cult options available in dropdown (Todos + all cult types except maybe include Sin especificar if used)
  const cultOptions = useMemo(() => {
    const set = new Set(tiposCulto.filter((t) => t !== 'Sin especificar'));
    registros.forEach((r) => {
      if (r.tipoCulto && r.tipoCulto !== 'Sin especificar') set.add(r.tipoCulto);
    });
    const list = ['Todos', ...Array.from(set)];
    if (registros.some((r) => r.tipoCulto === 'Sin especificar')) {
      list.push('Sin especificar');
    }
    return list;
  }, [tiposCulto, registros]);

  // SVG Chart dimensions
  const svgWidth = 1280;
  const svgHeight = 480;
  const padLeft = 60;
  const padRight = 28;
  const padTop = 40;
  const padBottom = 48;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const yMax = computeNiceMax(maximo);
  const yTicks = [0, Math.round(yMax / 2), yMax];

  const barCount = filtrados.length;
  const slotWidth = barCount > 0 ? plotWidth / barCount : plotWidth;
  const barWidth = Math.min(36, Math.max(12, slotWidth * 0.42));

  return (
    <div className="mx-auto w-full max-w-[1900px] px-[24px] py-6">
      <div className="rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px]">
        {/* Top Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-[24px] font-bold text-white">Asistencia</h2>
          <p className="font-mono-tabular text-[16px] text-[#9ca3b0]">
            {totalRegistros} {totalRegistros === 1 ? 'registro' : 'registros'} · Promedio:{' '}
            <strong className="font-semibold text-white">{promedio}</strong> · Máximo:{' '}
            <strong className="font-semibold text-white">{maximo}</strong>
          </p>
        </div>

        {/* Filters Row */}
        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            {RANGOS.map((r) => {
              const active = rangoDias === r.dias;
              return (
                <button
                  key={r.dias}
                  type="button"
                  onClick={() => setRangoDias(r.dias)}
                  className={`inline-flex h-[46px] items-center justify-center rounded-full border px-5 text-[16px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[#F2A65A] bg-[#F2A65A]/15 text-[#F2A65A]'
                      : 'border-[#2d3340] bg-[#14171d] text-[#9ca3b0] hover:border-[#41495b] hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <label htmlFor="graficos-culto" className="text-[15px] text-[#9ca3b0]">
              Culto
            </label>
            <select
              id="graficos-culto"
              value={cultoFiltro}
              onChange={(e) => setCultoFiltro(e.target.value)}
              className="min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden md:w-auto md:min-w-[260px]"
            >
              {cultOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart Area */}
        {filtrados.length === 0 ? (
          <div className="mt-8 flex min-h-[480px] flex-col items-center justify-center rounded-xl border border-dashed border-[#2a2f3a] bg-[#14171d] px-6 py-16 text-center">
            <BarChart3 className="h-12 w-12 text-[#555c6b]" />
            <p className="mt-4 text-[19px] font-medium text-[#d4d8e0]">
              No hay registros en este rango o filtro
            </p>
            <p className="mt-2 text-[17px] text-[#8a91a0]">
              Prueba ampliando el rango de días, seleccionando «Todos» los cultos o registrando una
              nueva reunión.
            </p>
            <button
              type="button"
              onClick={onGoRegistro}
              className="mt-6 min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] md:w-auto"
            >
              Ir a Registro por reunión
            </button>
          </div>
        ) : (
          <>
            <div className="relative mt-7 w-full overflow-x-auto">
              <div className="min-w-[600px]">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="min-h-[480px] h-[480px] w-full overflow-visible"
                  role="img"
                  aria-label="Gráfico de barras de asistencia"
                >
                  {/* Y axis guide lines */}
                  {yTicks.map((tick) => {
                    const y = padTop + plotHeight - (tick / yMax) * plotHeight;
                    return (
                      <g key={tick}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={svgWidth - padRight}
                          y2={y}
                          stroke="#262b36"
                          strokeWidth={1}
                        />
                        <text
                          x={padLeft - 12}
                          y={y + 5}
                          textAnchor="end"
                          fill="#7c8393"
                          fontSize="15"
                          className="font-mono-tabular"
                        >
                          {tick}
                        </text>
                      </g>
                    );
                  })}

                  {/* Bars */}
                  {filtrados.map((reg, idx) => {
                    const xCenter = padLeft + slotWidth * idx + slotWidth / 2;
                    const barHeight = Math.max(6, (reg.total / yMax) * plotHeight);
                    const x = xCenter - barWidth / 2;
                    const y = padTop + plotHeight - barHeight;
                    const isMax = reg.total === maximo;
                    const isHovered = hoveredIdx === idx;
                    const radius = Math.min(5, barWidth / 2, barHeight / 2);

                    const pathD = `
                      M ${x} ${y + barHeight}
                      L ${x} ${y + radius}
                      Q ${x} ${y} ${x + radius} ${y}
                      L ${x + barWidth - radius} ${y}
                      Q ${x + barWidth} ${y} ${x + barWidth} ${y + radius}
                      L ${x + barWidth} ${y + barHeight}
                      Z
                    `;

                    const step = barCount > 18 ? Math.ceil(barCount / 14) : 1;
                    const showXLabel = idx % step === 0 || idx === barCount - 1;

                    return (
                      <g
                        key={reg.id}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={padLeft + slotWidth * idx}
                          y={padTop}
                          width={slotWidth}
                          height={plotHeight + padBottom}
                          fill="transparent"
                        />

                        <path
                          d={pathD}
                          fill={isHovered ? '#f7b878' : '#F2A65A'}
                          className="transition-colors duration-150"
                        />

                        {(isMax || isHovered) && (
                          <text
                            x={xCenter}
                            y={y - 10}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="15"
                            fontWeight="700"
                            className="font-mono-tabular"
                          >
                            {reg.total}
                          </text>
                        )}

                        {showXLabel && (
                          <text
                            x={xCenter}
                            y={padTop + plotHeight + 28}
                            textAnchor="middle"
                            fill={isHovered ? '#ffffff' : '#8a91a0'}
                            fontSize="15"
                          >
                            {formatFechaCorta(reg.fecha)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Hover Tooltip */}
                {hoveredIdx !== null && filtrados[hoveredIdx] && (
                  <div
                    className="pointer-events-none absolute top-2 z-10 rounded-[12px] border border-[#343a47] bg-[#12151b]/95 px-4 py-3 shadow-xl backdrop-blur-xs"
                    style={{
                      left: `${Math.min(
                        80,
                        Math.max(
                          6,
                          ((padLeft + slotWidth * hoveredIdx + slotWidth / 2) / svgWidth) * 100
                        )
                      )}%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <p className="text-[16px] font-semibold text-white">
                      {formatFechaLarga(filtrados[hoveredIdx].fecha)}
                    </p>
                    <p className="mt-0.5 text-[16px] text-[#F2A65A] font-mono-tabular font-semibold">
                      Total: {filtrados[hoveredIdx].total} personas
                    </p>
                    <p className="mt-0.5 text-[15px] text-[#9ca3b0]">
                      {filtrados[hoveredIdx].tipoCulto || 'Sin especificar'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Table by Cult Type */}
            <div className="mt-8 overflow-x-auto border-t border-[#242832] pt-5">
              <table className="w-full min-w-[600px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#242832] text-[14px] font-semibold uppercase tracking-wider text-[#8a91a0]">
                    <th className="py-3.5 pr-4">Tipo de culto</th>
                    <th className="px-4 py-3.5 text-right">Reuniones</th>
                    <th className="px-4 py-3.5 text-right">Promedio</th>
                    <th className="px-4 py-3.5 text-right">Máximo</th>
                    <th className="py-3.5 pl-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222630]">
                  {resumenPorCulto.map((row) => (
                    <tr key={row.tipo} className="transition-colors hover:bg-[#20242d]">
                      <td className="py-[18px] pr-4 text-[16px] font-medium text-[#e6e8ec]">
                        {row.tipo}
                      </td>
                      <td className="px-4 py-[18px] text-right font-mono-tabular text-[16px] text-[#c7ccd6]">
                        {row.reuniones}
                      </td>
                      <td className="px-4 py-[18px] text-right font-mono-tabular text-[16px] text-[#c7ccd6]">
                        {row.promedio}
                      </td>
                      <td className="px-4 py-[18px] text-right font-mono-tabular text-[16px] text-[#c7ccd6]">
                        {row.maximo}
                      </td>
                      <td className="py-[18px] pl-4 text-right font-mono-tabular text-[20px] font-bold text-white">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
