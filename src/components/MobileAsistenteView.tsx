import React, { useState } from 'react';
import { CheckCircle2, Send, Users } from 'lucide-react';
import { TarjetaPendiente } from '../types';
import { getTodayMadridISO } from '../utils/dates';
import { generateId } from '../utils/storage';

interface MobileAsistenteViewProps {
  pendientesCount: number;
  onAddTarjeta: (tarjeta: TarjetaPendiente) => void;
  onGoSimpatizantes: () => void;
}

export const MobileAsistenteView: React.FC<MobileAsistenteViewProps> = ({
  pendientesCount,
  onAddTarjeta,
  onGoSimpatizantes,
}) => {
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nota, setNota] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!nombre.trim()) {
      setErrorMsg('El nombre del visitante es obligatorio.');
      return;
    }

    const nueva: TarjetaPendiente = {
      id: generateId('tar'),
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      telefono: telefono.trim(),
      nota: nota.trim() || undefined,
      fecha: getTodayMadridISO(),
      creadoEn: new Date().toISOString(),
    };

    onAddTarjeta(nueva);
    setNombre('');
    setDireccion('');
    setTelefono('');
    setNota('');
    setSentNotice(`Tarjeta de «${nueva.nombre}» enviada a revisión.`);
    setTimeout(() => setSentNotice(null), 4500);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-[24px] py-6">
      <div className="rounded-2xl border border-[#242832] bg-[#1a1d24] p-[28px] shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold tracking-wider text-[#F2A65A]">
              CHAT → AÑADIR ASISTENTE
            </p>
            <h2 className="mt-1 text-[24px] font-bold text-white">Nuevo visitante</h2>
          </div>
          <button
            type="button"
            onClick={onGoSimpatizantes}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#2d3340] bg-[#14171d] px-[28px] text-[17px] font-medium text-[#d4d8e0] hover:text-white md:w-auto"
          >
            <Users className="h-5 w-5 text-[#E8C547]" />
            Revisar ({pendientesCount})
          </button>
        </div>

        <p className="mt-3 text-[16px] leading-relaxed text-[#9ca3b0]">
          Vista rápida para el móvil del ujier. Las tarjetas enviadas aparecen al instante en{' '}
          <strong className="text-[#d4d8e0]">Simpatizantes → Tarjetas por revisar</strong>.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="movil-nombre" className="block text-[15px] font-medium text-[#c7ccd6]">
              Nombre *
            </label>
            <input
              id="movil-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo del visitante"
              className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label htmlFor="movil-direccion" className="block text-[15px] font-medium text-[#c7ccd6]">
              Dirección o de dónde viene
            </label>
            <input
              id="movil-direccion"
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej. Cruces, Barakaldo / Bilbao"
              className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="movil-telefono" className="block text-[15px] font-medium text-[#c7ccd6]">
              Teléfono
            </label>
            <input
              id="movil-telefono"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="600 000 000"
              className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] font-mono-tabular text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="movil-nota" className="block text-[15px] font-medium text-[#c7ccd6]">
              Nota (opcional)
            </label>
            <textarea
              id="movil-nota"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Observaciones, quién le invitó..."
              className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
            />
          </div>

          {errorMsg && <p className="text-[15px] font-medium text-red-400">{errorMsg}</p>}

          {sentNotice && (
            <div className="flex items-center gap-2 rounded-[12px] border border-emerald-500/30 bg-emerald-500/10 p-4 text-[16px] text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>{sentNotice}</span>
            </div>
          )}

          <button
            type="submit"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473]"
          >
            <Send className="h-5 w-5" />
            Enviar a tarjetas por revisar
          </button>
        </form>
      </div>
    </div>
  );
};
