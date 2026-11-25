import React from 'react';
import { MiembroComite, TurnoComite, VistaActiva } from '../types';
import { getTodayMadridISO } from '../utils/dates';

interface HomeViewProps {
  onNavigate: (vista: VistaActiva) => void;
  turnos: TurnoComite[];
  miembros: MiembroComite[];
  pendientesCount: number;
  ejemploCargado?: boolean;
  onImportBackup?: (json: string) => void;
  onDeleteSampleData?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  turnos,
  miembros,
  pendientesCount,
}) => {
  const hoy = getTodayMadridISO();
  const turnosHoy = turnos.filter((t) => t.fecha === hoy);
  const nombresHoy = Array.from(
    new Set(
      turnosHoy.flatMap((t) =>
        t.ujierIds
          .map((id) => miembros.find((m) => m.id === id)?.nombre)
          .filter((n): n is string => Boolean(n))
      )
    )
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1900px] flex-col px-[24px] pt-3">
      <div className="mb-2">
        <span className="text-[14px] font-normal text-[#6b7280] no-underline transition-colors hover:text-[#9ca3af]">
          ‹ Creado por: Bryan Ceron
        </span>
      </div>

      {/* Header row */}
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-[24px]">
          <img
            src="/assets/aistudio/Color-Borde-blanco_fcabe59b.png"
            alt="Logo IPUE Barakaldo"
            className="h-[110px] w-[110px] shrink-0 object-contain md:h-[160px] md:w-[160px]"
          />
          <div>
            <h1 className="text-[44px] font-bold leading-tight tracking-tight text-[#F2A65A]">
              Comité de Ujieres
            </h1>
            <p className="mt-1.5 text-[18px] text-[#9ca3b0]">
              Registro de asistencia, visitas y turnos de servicio de la iglesia
            </p>
          </div>
        </div>

      </div>

      {/* ASISTENCIA section */}
      <section className="mt-10">
        <h2 className="text-[14px] font-semibold tracking-wider text-[#9ca3b0]">ASISTENCIA</h2>

        <div className="mt-4 grid grid-cols-1 gap-[24px] md:grid-cols-3">
          {/* Card 1: Registro por reunión */}
          <button
            type="button"
            onClick={() => onNavigate('registro')}
            className="group relative flex min-h-[240px] flex-col items-start overflow-hidden rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[#F2A65A]/70 focus-visible:outline-2 focus-visible:outline-[#F2A65A]"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(242,166,90,0.06) 0%, rgba(26,29,36,0) 42%)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-[3px] bg-[#F2A65A]" />
            <div className="flex h-[64px] w-[64px] items-center justify-center rounded-xl bg-[#382d24] text-[32px]">
              <span role="img" aria-label="Registro">
                📝
              </span>
            </div>
            <h3 className="mt-6 text-[24px] font-bold text-white transition-colors group-hover:text-[#F2A65A]">
              Registro por reunión
            </h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[#9ca3b0]">
              Anota cuántas personas vinieron a cada reunión, en total o por grupos (hermanos,
              niños, amigos...), con el tipo de culto y una nota. Se suma solo, y el total se puede
              enviar a la pantalla.
            </p>
          </button>

          {/* Card 2: Gráficos */}
          <button
            type="button"
            onClick={() => onNavigate('graficos')}
            className="group relative flex min-h-[240px] flex-col items-start overflow-hidden rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[#E06C65]/80 focus-visible:outline-2 focus-visible:outline-[#E06C65]"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(224,108,101,0.06) 0%, rgba(26,29,36,0) 42%)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-[3px] bg-[#E06C65]" />
            <div className="flex h-[64px] w-[64px] items-center justify-center rounded-xl bg-[#382426] text-[32px]">
              <span role="img" aria-label="Gráficos">
                📊
              </span>
            </div>
            <h3 className="mt-6 text-[24px] font-bold text-white transition-colors group-hover:text-[#E06C65]">
              Gráficos
            </h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[#9ca3b0]">
              Cómo evoluciona la asistencia: la última semana, el mes o el año, todos los cultos o
              uno solo, y el resumen de cada tipo de culto.
            </p>
          </button>

          {/* Card 3: Simpatizantes */}
          <button
            type="button"
            onClick={() => onNavigate('simpatizantes')}
            className="group relative flex min-h-[240px] flex-col items-start overflow-hidden rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[#E8C547]/80 focus-visible:outline-2 focus-visible:outline-[#E8C547]"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(232,197,71,0.06) 0%, rgba(26,29,36,0) 42%)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-[3px] bg-[#E8C547]" />
            <div className="flex w-full items-start justify-between">
              <div className="flex h-[64px] w-[64px] items-center justify-center rounded-xl bg-[#36311d] text-[32px]">
                <span role="img" aria-label="Simpatizantes">
                  🤝
                </span>
              </div>
              {pendientesCount > 0 && (
                <span className="rounded-lg bg-[#E8C547]/15 px-3 py-1.5 text-[15px] font-semibold text-[#E8C547]">
                  {pendientesCount} por revisar
                </span>
              )}
            </div>
            <h3 className="mt-6 text-[24px] font-bold text-white transition-colors group-hover:text-[#E8C547]">
              Simpatizantes
            </h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[#9ca3b0]">
              La base de datos de quienes nos visitan: nombre, dirección, teléfono y visitas. Aquí
              llegan las tarjetas de <strong className="font-semibold text-[#d4d8e0]">Chat → «Añadir asistente»</strong>{' '}
              del móvil, para revisarlas.
            </p>
          </button>
        </div>
      </section>

      {/* COMITÉ section */}
      <section className="mt-10">
        <h2 className="text-[14px] font-semibold tracking-wider text-[#9ca3b0]">COMITÉ</h2>

        <div className="mt-4 grid grid-cols-1 gap-[24px] md:grid-cols-3">
          {/* Card 4: Turnos del comité */}
          <button
            type="button"
            onClick={() => onNavigate('turnos')}
            className="group relative flex min-h-[240px] flex-col items-start overflow-hidden rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[#4ADE80]/75 focus-visible:outline-2 focus-visible:outline-[#4ADE80]"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(74,222,128,0.06) 0%, rgba(26,29,36,0) 42%)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-[3px] bg-[#4ADE80]" />
            <div className="flex h-[64px] w-[64px] items-center justify-center rounded-xl bg-[#1e3429] text-[32px]">
              <span role="img" aria-label="Turnos del comité">
                🗓️
              </span>
            </div>
            <h3 className="mt-6 text-[24px] font-bold text-white transition-colors group-hover:text-[#4ADE80]">
              Turnos del comité
            </h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[#9ca3b0]">
              Los nombres de los ujieres y qué día le toca a cada uno prestar el servicio en el
              culto. Todo editable.
            </p>
            {nombresHoy.length > 0 && (
              <p className="mt-3.5 text-[15px] font-semibold text-[#4ADE80]">
                Hoy sirven: {nombresHoy.join(', ')}
              </p>
            )}
          </button>

          {/* Card 5: Ruleta */}
          <button
            type="button"
            onClick={() => onNavigate('ruleta')}
            className="group relative flex min-h-[240px] flex-col items-start overflow-hidden rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[#E8C547]/80 focus-visible:outline-2 focus-visible:outline-[#E8C547]"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(232,197,71,0.06) 0%, rgba(26,29,36,0) 42%)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-[3px] bg-[#E8C547]" />
            <div className="flex h-[64px] w-[64px] items-center justify-center rounded-xl bg-[#36311d] text-[32px]">
              <span role="img" aria-label="Ruleta">
                🎡
              </span>
            </div>
            <h3 className="mt-6 text-[24px] font-bold text-white transition-colors group-hover:text-[#E8C547]">
              Ruleta
            </h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[#9ca3b0]">
              Escribe los nombres de los hermanos y gírala en la pantalla las veces que quieras
              para que salga uno al azar. Varias listas, y sin repetir si quieres.
            </p>
          </button>
        </div>
      </section>

      <div className="mt-12 border-t border-[#1e222b] pt-6 text-[15px] text-[#6f7685]">
        Asistencia – Comité de Ujieres · IPUE Barakaldo · Datos guardados localmente en este
        navegador.
      </div>

      <footer className="mt-auto pt-[40px] pb-[32px] text-center">
        <span className="text-[15px] font-normal text-[#9ca3af] no-underline">
          ‹ Creado por: Bryan Ceron
        </span>
      </footer>
    </div>
  );
};
