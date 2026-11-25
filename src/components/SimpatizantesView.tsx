import React, { useMemo, useState } from 'react';
import { Pencil, X, Check, UserPlus, Copy } from 'lucide-react';
import { Simpatizante, TarjetaPendiente } from '../types';
import { formatFechaMedia, getTodayMadridISO } from '../utils/dates';
import { generateId } from '../utils/storage';
import { ConfirmModal } from './ConfirmModal';

interface SimpatizantesViewProps {
  simpatizantes: Simpatizante[];
  tarjetasPendientes: TarjetaPendiente[];
  onSaveSimpatizantes: (next: Simpatizante[]) => void;
  onSaveTarjetasPendientes: (next: TarjetaPendiente[]) => void;
}

type LeftFormMode =
  | { type: 'add' }
  | { type: 'edit-card'; cardId: string }
  | { type: 'edit-person'; personId: string; personName: string };

function normalizePhone(tel: string): string {
  return tel.replace(/\D+/g, '').trim();
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const SimpatizantesView: React.FC<SimpatizantesViewProps> = ({
  simpatizantes,
  tarjetasPendientes,
  onSaveSimpatizantes,
  onSaveTarjetasPendientes,
}) => {
  const hoy = getTodayMadridISO();

  const [filtroTab, setFiltroTab] = useState<'hoy' | 'todos'>('todos');
  const [busqueda, setBusqueda] = useState('');

  // Left form state
  const [formMode, setFormMode] = useState<LeftFormMode>({ type: 'add' });
  const [showAddForm, setShowAddForm] = useState<boolean>(true);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nota, setNota] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);

  // Confirmations
  const [deletePerson, setDeletePerson] = useState<Simpatizante | null>(null);
  const [discardCard, setDiscardCard] = useState<TarjetaPendiente | null>(null);

  const countHoy = useMemo(
    () => simpatizantes.filter((s) => s.ultimaVisita === hoy).length,
    [simpatizantes, hoy]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return [...simpatizantes]
      .filter((s) => {
        if (filtroTab === 'hoy' && s.ultimaVisita !== hoy) return false;
        if (!q) return true;
        return (
          s.nombre.toLowerCase().includes(q) ||
          s.direccion.toLowerCase().includes(q) ||
          s.telefono.toLowerCase().includes(q) ||
          (s.nota || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.ultimaVisita !== b.ultimaVisita) {
          return b.ultimaVisita.localeCompare(a.ultimaVisita);
        }
        return a.nombre.localeCompare(b.nombre, 'es');
      });
  }, [simpatizantes, filtroTab, hoy, busqueda]);

  const resetForm = () => {
    setFormMode({ type: 'add' });
    setNombre('');
    setDireccion('');
    setTelefono('');
    setNota('');
    setErrorMsg(null);
  };

  const handleCopyNames = async () => {
    const names = filtrados.map((s) => s.nombre.trim()).filter(Boolean);
    const text = names.join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopiedMsg(`${names.length} nombres copiados`);
    setTimeout(() => setCopiedMsg(null), 3500);
  };

  /**
   * Inserts or merges a visitor into the database without duplicating existing phone or name.
   */
  const upsertVisitor = (
    data: { nombre: string; direccion: string; telefono: string; nota?: string },
    visitDate: string
  ): { nextList: Simpatizante[]; merged: boolean } => {
    const cleanName = data.nombre.trim();
    const normName = normalizeName(cleanName);
    const normTel = normalizePhone(data.telefono);

    const existingIdx = simpatizantes.findIndex((s) => {
      if (normTel && normalizePhone(s.telefono) === normTel) return true;
      return normalizeName(s.nombre) === normName;
    });

    if (existingIdx >= 0) {
      const prev = simpatizantes[existingIdx];
      const updated: Simpatizante = {
        ...prev,
        direccion: data.direccion.trim() || prev.direccion,
        telefono: data.telefono.trim() || prev.telefono,
        nota: data.nota?.trim() || prev.nota,
        visitas: prev.visitas + 1,
        ultimaVisita: visitDate >= prev.ultimaVisita ? visitDate : prev.ultimaVisita,
      };
      const nextList = [...simpatizantes];
      nextList[existingIdx] = updated;
      return { nextList, merged: true };
    }

    const nuevo: Simpatizante = {
      id: generateId('sim'),
      nombre: cleanName,
      direccion: data.direccion.trim(),
      telefono: data.telefono.trim(),
      nota: data.nota?.trim() || undefined,
      visitas: 1,
      ultimaVisita: visitDate,
    };
    return { nextList: [nuevo, ...simpatizantes], merged: false };
  };

  const handleAcceptCard = (card: TarjetaPendiente) => {
    const { nextList, merged } = upsertVisitor(
      {
        nombre: card.nombre,
        direccion: card.direccion,
        telefono: card.telefono,
        nota: card.nota,
      },
      card.fecha || hoy
    );
    onSaveSimpatizantes(nextList);
    onSaveTarjetasPendientes(tarjetasPendientes.filter((t) => t.id !== card.id));
    if (formMode.type === 'edit-card' && formMode.cardId === card.id) {
      resetForm();
    }
    setSavedMsg(
      merged
        ? `Visita sumada a ${card.nombre} (ya existía en la base)`
        : `${card.nombre} añadido a la base`
    );
    setTimeout(() => setSavedMsg(null), 4000);
  };

  const startCorrectCard = (card: TarjetaPendiente) => {
    setShowAddForm(true);
    setFormMode({ type: 'edit-card', cardId: card.id });
    setNombre(card.nombre);
    setDireccion(card.direccion);
    setTelefono(card.telefono);
    setNota(card.nota || '');
    setErrorMsg(null);
    setSavedMsg(null);
  };

  const startEditPerson = (person: Simpatizante) => {
    setShowAddForm(true);
    setFormMode({ type: 'edit-person', personId: person.id, personName: person.nombre });
    setNombre(person.nombre);
    setDireccion(person.direccion);
    setTelefono(person.telefono);
    setNota(person.nota || '');
    setErrorMsg(null);
    setSavedMsg(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }

    if (formMode.type === 'edit-person') {
      const next = simpatizantes.map((s) =>
        s.id === formMode.personId
          ? {
              ...s,
              nombre: nombre.trim(),
              direccion: direccion.trim(),
              telefono: telefono.trim(),
              nota: nota.trim() || undefined,
            }
          : s
      );
      onSaveSimpatizantes(next);
      setSavedMsg('Datos guardados');
      resetForm();
    } else if (formMode.type === 'edit-card') {
      const card = tarjetasPendientes.find((c) => c.id === formMode.cardId);
      const { nextList, merged } = upsertVisitor(
        { nombre, direccion, telefono, nota },
        card?.fecha || hoy
      );
      onSaveSimpatizantes(nextList);
      onSaveTarjetasPendientes(tarjetasPendientes.filter((t) => t.id !== formMode.cardId));
      setSavedMsg(
        merged
          ? 'Visita sumada al registro existente'
          : 'Tarjeta corregida y guardada en la base'
      );
      resetForm();
    } else {
      const { nextList, merged } = upsertVisitor({ nombre, direccion, telefono, nota }, hoy);
      onSaveSimpatizantes(nextList);
      setSavedMsg(
        merged ? 'Ya existía: se sumó 1 visita y se actualizó hoy' : 'Datos guardados'
      );
      resetForm();
    }

    setTimeout(() => setSavedMsg(null), 4000);
  };

  const formTitle =
    formMode.type === 'edit-person'
      ? `Corregir a ${formMode.personName}`
      : formMode.type === 'edit-card'
      ? `Corregir a ${nombre || 'tarjeta'}`
      : 'Añadir a la base';

  return (
    <div className="mx-auto w-full max-w-[1900px] px-[24px] py-6">
      <div className="flex flex-col items-start gap-[24px] md:flex-row">
        {/* Left Panel */}
        <section className="w-full rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] md:w-[420px] md:shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[24px] font-bold text-white">Tarjetas por revisar</h2>
            {tarjetasPendientes.length > 0 && (
              <span className="font-mono-tabular text-[18px] font-bold text-[#E8C547]">
                {tarjetasPendientes.length}
              </span>
            )}
          </div>

          {tarjetasPendientes.length === 0 ? (
            <p className="mt-3 text-[15px] leading-relaxed text-[#8f96a4]">
              No hay nada por revisar. Las tarjetas llegan desde el teléfono: Chat → «Añadir
              asistente».
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {tarjetasPendientes.map((card) => (
                <div
                  key={card.id}
                  className="rounded-[12px] border border-[#2d3340] bg-[#14171d] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[17px] font-semibold text-white">{card.nombre}</p>
                      {card.direccion && (
                        <p className="text-[15px] text-[#9ca3b0]">{card.direccion}</p>
                      )}
                      {card.telefono && (
                        <p className="mt-0.5 font-mono-tabular text-[15px] text-[#c7ccd6]">
                          {card.telefono}
                        </p>
                      )}
                      {card.nota && (
                        <p className="mt-1 text-[15px] italic text-[#8a91a0]">{card.nota}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
                    <button
                      type="button"
                      onClick={() => handleAcceptCard(card)}
                      className="min-h-[44px] w-full rounded-[10px] bg-[#F2A65A] px-4 text-[15px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] md:w-auto"
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => startCorrectCard(card)}
                      className="min-h-[44px] w-full rounded-[10px] border border-[#2d3340] bg-[#222630] px-4 text-[15px] font-medium text-[#d4d8e0] transition-colors hover:text-white md:w-auto"
                    >
                      Corregir
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscardCard(card)}
                      className="min-h-[44px] w-full rounded-[10px] border border-[#2d3340] px-4 text-[15px] font-medium text-[#9ca3b0] transition-colors hover:border-red-500/40 hover:text-red-300 md:w-auto"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Divider + Add/Edit Form */}
          <div className="mt-6 border-t border-[#242832] pt-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[24px] font-bold text-white">{formTitle}</h3>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowAddForm(true);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-[16px] font-semibold text-[#F2A65A] hover:text-[#f6b879]"
                >
                  <UserPlus className="h-5 w-5" />+ Añadir simpatizante
                </button>
              )}
            </div>

            {showAddForm && (
              <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="sim-nombre" className="block text-[15px] text-[#9ca3b0]">
                    Nombre
                  </label>
                  <input
                    id="sim-nombre"
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre y apellidos"
                    className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="sim-direccion" className="block text-[15px] text-[#9ca3b0]">
                    Dirección o de dónde viene
                  </label>
                  <input
                    id="sim-direccion"
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Barrio, calle o ciudad"
                    className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="sim-telefono" className="block text-[15px] text-[#9ca3b0]">
                    Teléfono
                  </label>
                  <input
                    id="sim-telefono"
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="600 000 000"
                    className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] font-mono-tabular text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="sim-nota" className="block text-[15px] text-[#9ca3b0]">
                    Nota (opcional)
                  </label>
                  <input
                    id="sim-nota"
                    type="text"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Quién le invitó, petición..."
                    className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
                  />
                </div>

                {errorMsg && (
                  <p className="text-[15px] font-medium text-red-400" role="alert">
                    {errorMsg}
                  </p>
                )}

                {savedMsg && (
                  <p className="flex items-center gap-2 text-[15px] font-medium text-emerald-400">
                    <Check className="h-5 w-5" />
                    {savedMsg}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2.5 pt-1 md:flex-row md:items-center md:justify-end">
                  {formMode.type !== 'add' && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-[#d4d8e0] hover:text-white md:w-auto"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] whitespace-nowrap shrink-0 md:w-auto"
                  >
                    {formMode.type === 'add' ? 'Añadir a la base' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-5 text-[14px] leading-relaxed text-[#7c8393]">
              <p>
                Desde el teléfono: <strong className="text-[#a1a7b5]">Chat → Añadir asistente</strong>.
                Necesita la clave del móvil encendida. Estos datos se quedan en este PC.
              </p>
            </div>
          </div>
        </section>

        {/* Right Panel: Base de datos de simpatizantes */}
        <section className="w-full min-w-0 flex-1 rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px]">
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[24px] font-bold text-white">Base de datos de simpatizantes</h2>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltroTab('hoy')}
                  className={`flex h-[46px] items-center rounded-full border px-5 text-[16px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filtroTab === 'hoy'
                      ? 'border-[#F2A65A] bg-[#F2A65A]/15 text-[#F2A65A]'
                      : 'border-[#2d3340] bg-[#14171d] text-[#9ca3b0] hover:text-white'
                  }`}
                >
                  Hoy ({countHoy})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTab('todos')}
                  className={`flex h-[46px] items-center rounded-full border px-5 text-[16px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filtroTab === 'todos'
                      ? 'border-[#F2A65A] bg-[#F2A65A]/15 text-[#F2A65A]'
                      : 'border-[#2d3340] bg-[#14171d] text-[#9ca3b0] hover:text-white'
                  }`}
                >
                  Todos ({simpatizantes.length})
                </button>
                <button
                  type="button"
                  onClick={handleCopyNames}
                  className="inline-flex h-[46px] items-center gap-2 rounded-full border border-[#F2A65A] bg-[#14171d] px-5 text-[16px] font-medium text-[#F2A65A] transition-colors hover:bg-[#F2A65A]/15 whitespace-nowrap shrink-0"
                >
                  <Copy className="h-4 w-4" />
                  Copiar nombres
                </button>
                {copiedMsg && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[15px] font-medium text-emerald-300">
                    <Check className="h-4 w-4 shrink-0" />
                    {copiedMsg}
                  </span>
                )}
              </div>
            </div>

            <div className="w-full md:max-w-sm md:flex-1">
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar nombre, dirección, teléfono o nota"
                className="min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#636b7c] focus:border-[#F2A65A] focus:outline-hidden"
              />
            </div>
          </div>

          {filtrados.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-[#2a2f3a] bg-[#14171d] px-6 py-12 text-center">
              <p className="text-[18px] font-medium text-[#d4d8e0]">
                {simpatizantes.length === 0
                  ? 'La base de datos de simpatizantes está vacía'
                  : 'No hay coincidencias con ese filtro'}
              </p>
              <p className="mt-1.5 text-[15px] text-[#8a91a0]">
                {simpatizantes.length === 0
                  ? 'Añade un simpatizante desde el formulario o acepta una tarjeta recibida.'
                  : 'Prueba cambiando de pestaña o limpiando la búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left text-[16px]">
                <thead>
                  <tr className="border-b border-[#242832] text-[14px] font-semibold uppercase tracking-wider text-[#8a91a0]">
                    <th className="py-3.5 pr-3">Nombre</th>
                    <th className="px-3 py-3.5">Dirección</th>
                    <th className="px-3 py-3.5">Teléfono</th>
                    <th className="px-3 py-3.5">Nota</th>
                    <th className="px-3 py-3.5 text-right">Visitas</th>
                    <th className="px-3 py-3.5">Última visita</th>
                    <th className="py-3.5 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222630]">
                  {filtrados.map((person) => {
                    const esHoy = person.ultimaVisita === hoy;
                    return (
                      <tr
                        key={person.id}
                        className={`transition-colors hover:bg-[#222731] ${
                          esHoy ? 'bg-[#F2A65A]/[0.08]' : ''
                        }`}
                      >
                        <td className="py-[18px] pr-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[16px] font-semibold text-white">
                              {person.nombre}
                            </span>
                            {esHoy && (
                              <span className="rounded-md bg-[#F2A65A]/20 px-2.5 py-0.5 text-[13px] font-semibold text-[#F2A65A]">
                                hoy
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-[18px] text-[16px] text-[#8f96a4]">
                          {person.direccion || '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-[18px] font-mono-tabular text-[16px] text-[#e6e8ec]">
                          {person.telefono || '—'}
                        </td>
                        <td className="max-w-[240px] px-3 py-[18px] text-[16px] text-[#c7ccd6]">
                          {person.nota ? (
                            <span className="block truncate" title={person.nota}>
                              {person.nota}
                            </span>
                          ) : (
                            <span className="text-[#636b7c]">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-[18px] text-right font-mono-tabular text-[16px] font-semibold text-[#e6e8ec]">
                          {person.visitas}
                        </td>
                        <td className="whitespace-nowrap px-3 py-[18px] font-mono-tabular text-[16px] text-[#c7ccd6]">
                          {formatFechaMedia(person.ultimaVisita)}
                        </td>
                        <td className="whitespace-nowrap py-[18px] pl-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditPerson(person)}
                              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] transition-colors hover:border-[#434c60] hover:text-white"
                              aria-label={`Editar a ${person.nombre}`}
                              title="Editar"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletePerson(person)}
                              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] transition-colors hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-400"
                              aria-label={`Borrar a ${person.nombre}`}
                              title="Borrar"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Confirm delete person */}
      <ConfirmModal
        open={Boolean(deletePerson)}
        title="Borrar simpatizante"
        message={
          deletePerson
            ? `¿Seguro que quieres borrar a «${deletePerson.nombre}» de la base de datos?`
            : ''
        }
        confirmLabel="Borrar"
        onConfirm={() => {
          if (!deletePerson) return;
          onSaveSimpatizantes(simpatizantes.filter((s) => s.id !== deletePerson.id));
          if (formMode.type === 'edit-person' && formMode.personId === deletePerson.id) {
            resetForm();
          }
          setDeletePerson(null);
        }}
        onCancel={() => setDeletePerson(null)}
      />

      {/* Confirm discard card */}
      <ConfirmModal
        open={Boolean(discardCard)}
        title="Descartar tarjeta"
        message={
          discardCard
            ? `¿Seguro que quieres descartar la tarjeta pendiente de «${discardCard.nombre}»?`
            : ''
        }
        confirmLabel="Descartar"
        onConfirm={() => {
          if (!discardCard) return;
          onSaveTarjetasPendientes(tarjetasPendientes.filter((t) => t.id !== discardCard.id));
          if (formMode.type === 'edit-card' && formMode.cardId === discardCard.id) {
            resetForm();
          }
          setDiscardCard(null);
        }}
        onCancel={() => setDiscardCard(null)}
      />
    </div>
  );
};
