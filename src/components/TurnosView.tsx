import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pencil,
  X,
  Plus,
  RefreshCw,
  UserPlus,
  Trash2,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { MiembroComite, PuestoComite, TurnoComite } from '../types';
import {
  diffDaysISO,
  formatFechaLarga,
  getCurrentMonthPrefix,
  getTodayMadridISO,
  getWeekdayIndex,
  parseISOParts,
} from '../utils/dates';
import { generateId } from '../utils/storage';
import {
  generateBalancedTurnos,
  getDefaultPuestosForDate,
  getMissingUshersCount,
  getNextMonthRange,
  getRequiredUshersForDate,
  getUsherPuesto,
  PUESTOS_FIJOS,
} from '../utils/turnosRules';
import { ConfirmModal } from './ConfirmModal';
import { CompartirTurnosModal } from './CompartirTurnosModal';

interface TurnosViewProps {
  miembros: MiembroComite[];
  turnos: TurnoComite[];
  tiposCulto: string[];
  puestosComite: string[];
  onSaveMiembros: (next: MiembroComite[]) => void;
  onSaveTurnos: (next: TurnoComite[]) => void;
  onSaveTiposCulto: (next: string[]) => void;
  onSavePuestosComite: (next: string[]) => void;
}

const MESES_LARGO_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const TurnosView: React.FC<TurnosViewProps> = ({
  miembros,
  turnos,
  tiposCulto,
  puestosComite: _puestosComite,
  onSaveMiembros,
  onSaveTurnos,
  onSaveTiposCulto,
  onSavePuestosComite: _onSavePuestosComite,
}) => {
  const hoy = getTodayMadridISO();
  const mesActual = getCurrentMonthPrefix();
  const nextMonthRange = useMemo(() => getNextMonthRange(hoy), [hoy]);

  // Member form state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [mNombre, setMNombre] = useState('');
  const [mTelefono, setMTelefono] = useState('');
  const [mNota, setMNota] = useState('');
  const [mError, setMError] = useState<string | null>(null);

  // Shifts filters & search
  const [vistaFiltro, setVistaFiltro] = useState<'proximos' | 'mes' | 'todos'>('proximos');
  const [buscarUjier, setBuscarUjier] = useState('');

  // Shift modal (add / edit)
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [editingTurnoId, setEditingTurnoId] = useState<string | null>(null);
  const [tFecha, setTFecha] = useState(hoy);
  const [tCulto, setTCulto] = useState('');
  const [tUjierIds, setTUjierIds] = useState<string[]>([]);
  const [tPuesto, setTPuesto] = useState<PuestoComite>('Puerta principal');
  const [tPuestosPorUjier, setTPuestosPorUjier] = useState<Record<string, PuestoComite>>({});
  const [tNota, setTNota] = useState('');
  const [nuevoTipoCulto, setNuevoTipoCulto] = useState('');

  // Rotating generator modal (defaults to next month)
  const [showRotativoModal, setShowRotativoModal] = useState(false);
  const [rotDesde, setRotDesde] = useState(nextMonthRange.start);
  const [rotHasta, setRotHasta] = useState(nextMonthRange.end);
  const [rotPreview, setRotPreview] = useState<TurnoComite[] | null>(null);

  // Delete confirmations
  const [deleteMember, setDeleteMember] = useState<MiembroComite | null>(null);
  const [deleteTurno, setDeleteTurno] = useState<TurnoComite | null>(null);

  // Bulk clear ("Vaciar para el próximo mes") modal & 15s Undo state
  const hoyParts = parseISOParts(hoy);
  const [showCompartirModal, setShowCompartirModal] = useState(false);
  const [showVaciarModal, setShowVaciarModal] = useState(false);
  const [vaciarModo, setVaciarModo] = useState<'todos-turnos' | 'un-mes' | 'todo-cero'>('todos-turnos');
  const [vaciarMes, setVaciarMes] = useState<number>(hoyParts.month);
  const [vaciarAnio, setVaciarAnio] = useState<number>(hoyParts.year);
  const [vaciarConfirmText, setVaciarConfirmText] = useState('');
  const [undoBackup, setUndoBackup] = useState<{
    turnosPrevios: TurnoComite[];
    miembrosPrevios: MiembroComite[];
  } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  // 90-day service count per usher
  const servicios90Dias = useMemo(() => {
    const counts = new Map<string, number>();
    miembros.forEach((m) => counts.set(m.id, 0));
    turnos.forEach((t) => {
      const diff = diffDaysISO(hoy, t.fecha);
      if (diff >= 0 && diff <= 90) {
        t.ujierIds.forEach((uid) => {
          counts.set(uid, (counts.get(uid) || 0) + 1);
        });
      }
    });
    return counts;
  }, [miembros, turnos, hoy]);

  const activeMiembros = useMemo(() => miembros.filter((m) => m.activo), [miembros]);

  const getMemberName = (id: string) =>
    miembros.find((m) => m.id === id)?.nombre || 'Sin asignar';

  // Filtered and sorted shifts
  const turnosFiltrados = useMemo(() => {
    const q = buscarUjier.trim().toLowerCase();
    return [...turnos]
      .filter((t) => {
        if (vistaFiltro === 'proximos' && t.fecha < hoy) return false;
        if (vistaFiltro === 'mes' && !t.fecha.startsWith(mesActual)) return false;
        if (!q) return true;
        const names = t.ujierIds.map((id) => getMemberName(id).toLowerCase()).join(' ');
        const puestosUjieres = t.ujierIds
          .map((id, idx) => getUsherPuesto(t, id, idx).toLowerCase())
          .join(' ');
        return (
          names.includes(q) ||
          puestosUjieres.includes(q) ||
          (t.ujierIds.length === 0 && 'sin asignar'.includes(q)) ||
          (t.puesto || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.fecha !== b.fecha) {
          return vistaFiltro === 'todos'
            ? b.fecha.localeCompare(a.fecha)
            : a.fecha.localeCompare(b.fecha);
        }
        return a.tipoCulto.localeCompare(b.tipoCulto, 'es');
      });
  }, [turnos, vistaFiltro, hoy, mesActual, buscarUjier, miembros]);

  // Member CRUD
  const resetMemberForm = () => {
    setEditingMemberId(null);
    setMNombre('');
    setMTelefono('');
    setMNota('');
    setMError(null);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    setMError(null);
    if (!mNombre.trim()) {
      setMError('El nombre del ujier es obligatorio.');
      return;
    }

    if (editingMemberId) {
      onSaveMiembros(
        miembros.map((m) =>
          m.id === editingMemberId
            ? {
                ...m,
                nombre: mNombre.trim(),
                telefono: mTelefono.trim() || undefined,
                nota: mNota.trim() || undefined,
              }
            : m
        )
      );
      resetMemberForm();
    } else {
      const nuevo: MiembroComite = {
        id: generateId('uj'),
        nombre: mNombre.trim(),
        telefono: mTelefono.trim() || undefined,
        nota: mNota.trim() || undefined,
        activo: true,
      };
      onSaveMiembros([...miembros, nuevo]);
      resetMemberForm();
    }
  };

  const toggleMemberActive = (id: string) => {
    onSaveMiembros(
      miembros.map((m) => (m.id === id ? { ...m, activo: !m.activo } : m))
    );
  };

  const memberAssignedCount = (id: string) =>
    turnos.filter((t) => t.ujierIds.includes(id)).length;

  const confirmDeleteMember = () => {
    if (!deleteMember) return;
    const idToRemove = deleteMember.id;
    onSaveMiembros(miembros.filter((m) => m.id !== idToRemove));
    // Leave shifts "sin asignar" (remove that usher id from assigned shifts)
    onSaveTurnos(
      turnos.map((t) =>
        t.ujierIds.includes(idToRemove)
          ? { ...t, ujierIds: t.ujierIds.filter((uid) => uid !== idToRemove) }
          : t
      )
    );
    if (editingMemberId === idToRemove) resetMemberForm();
    setDeleteMember(null);
  };

  // Shift CRUD with fixed service rules
  const applyDateRulesToSelection = (fechaISO: string, currentIds: string[]) => {
    const defaults = getDefaultPuestosForDate(fechaISO);
    const primaryPuesto: PuestoComite = defaults[0] || 'Puerta principal';
    setTPuesto(primaryPuesto);

    const nextMap: Record<string, PuestoComite> = {};
    currentIds.forEach((uid, idx) => {
      if (defaults.length > 0) {
        nextMap[uid] = defaults[idx] || defaults[0];
      } else {
        nextMap[uid] = tPuestosPorUjier[uid] || primaryPuesto;
      }
    });
    setTPuestosPorUjier(nextMap);
  };

  const openAddTurno = () => {
    setEditingTurnoId(null);
    setTFecha(hoy);
    setTCulto('');
    setTUjierIds([]);
    const defaults = getDefaultPuestosForDate(hoy);
    setTPuesto(defaults[0] || 'Puerta principal');
    setTPuestosPorUjier({});
    setTNota('');
    setShowTurnoModal(true);
  };

  const openEditTurno = (t: TurnoComite) => {
    setEditingTurnoId(t.id);
    setTFecha(t.fecha);
    setTCulto(t.tipoCulto && t.tipoCulto !== 'Sin especificar' ? t.tipoCulto : '');
    setTUjierIds([...t.ujierIds]);
    const initialMap: Record<string, PuestoComite> = {};
    t.ujierIds.forEach((uid, idx) => {
      initialMap[uid] = getUsherPuesto(t, uid, idx);
    });
    setTPuestosPorUjier(initialMap);
    const firstPuesto =
      t.ujierIds.length > 0
        ? initialMap[t.ujierIds[0]]
        : t.puesto === 'Salón'
        ? 'Salón'
        : 'Puerta principal';
    setTPuesto(firstPuesto);
    setTNota(t.nota || '');
    setShowTurnoModal(true);
  };

  const handleToggleModalUjier = (uid: string) => {
    const selected = tUjierIds.includes(uid);
    if (selected) {
      const nextIds = tUjierIds.filter((id) => id !== uid);
      setTUjierIds(nextIds);
      setTPuestosPorUjier((prev) => {
        const copy = { ...prev };
        delete copy[uid];
        return copy;
      });
      return;
    }

    const nextIds = [...tUjierIds, uid];
    const defaults = getDefaultPuestosForDate(tFecha);
    let assignedPuesto: PuestoComite = tPuesto;

    if (defaults.length === 2) {
      // Domingo: alterna entre Puerta principal y Salón según lo ya asignado
      const usedPuestos = tUjierIds.map((id) => tPuestosPorUjier[id]);
      assignedPuesto = !usedPuestos.includes('Puerta principal')
        ? 'Puerta principal'
        : !usedPuestos.includes('Salón')
        ? 'Salón'
        : defaults[nextIds.length - 1] || 'Puerta principal';
    } else if (defaults.length === 1) {
      assignedPuesto = defaults[0];
    }

    setTUjierIds(nextIds);
    setTPuestosPorUjier((prev) => ({
      ...prev,
      [uid]: assignedPuesto,
    }));
  };

  const handleSaveTurno = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tFecha) return;

    const cleanMap: Record<string, PuestoComite> = {};
    tUjierIds.forEach((uid, idx) => {
      cleanMap[uid] = tPuestosPorUjier[uid] || (idx === 1 && getWeekdayIndex(tFecha) === 0 ? 'Salón' : tPuesto);
    });
    const summaryPuesto =
      tUjierIds.length > 0 ? cleanMap[tUjierIds[0]] : tPuesto;

    if (editingTurnoId) {
      onSaveTurnos(
        turnos.map((t) =>
          t.id === editingTurnoId
            ? {
                ...t,
                fecha: tFecha,
                tipoCulto: tCulto.trim(),
                ujierIds: tUjierIds,
                puesto: summaryPuesto,
                puestosPorUjier: cleanMap,
                nota: tNota.trim() || undefined,
              }
            : t
        )
      );
    } else {
      const nuevo: TurnoComite = {
        id: generateId('tur'),
        fecha: tFecha,
        tipoCulto: tCulto.trim(),
        ujierIds: tUjierIds,
        puesto: summaryPuesto,
        puestosPorUjier: cleanMap,
        nota: tNota.trim() || undefined,
      };
      onSaveTurnos([nuevo, ...turnos]);
    }
    setShowTurnoModal(false);
  };

  // Rotating shift generator (fixed service rules, no cult type)
  const handleGeneratePreview = () => {
    const generated = generateBalancedTurnos({
      desde: rotDesde,
      hasta: rotHasta,
      activeMiembros,
      existingTurnos: turnos,
      servicios90Dias,
    });
    setRotPreview(generated);
  };

  const rotPreviewTotals = useMemo(() => {
    if (!rotPreview) return [];
    const map = new Map<string, { total: number; puerta: number; salon: number }>();
    activeMiembros.forEach((m) => map.set(m.id, { total: 0, puerta: 0, salon: 0 }));

    rotPreview.forEach((t) => {
      t.ujierIds.forEach((uid, idx) => {
        const entry = map.get(uid) || { total: 0, puerta: 0, salon: 0 };
        const p = getUsherPuesto(t, uid, idx);
        entry.total += 1;
        if (p === 'Salón') entry.salon += 1;
        else entry.puerta += 1;
        map.set(uid, entry);
      });
    });

    return activeMiembros.map((m) => ({
      miembro: m,
      ...(map.get(m.id) || { total: 0, puerta: 0, salon: 0 }),
    }));
  }, [rotPreview, activeMiembros]);

  const handleSaveRotating = () => {
    if (!rotPreview || rotPreview.length === 0) return;
    onSaveTurnos([...rotPreview, ...turnos]);
    setRotPreview(null);
    setShowRotativoModal(false);
  };

  const vaciarYearMonth = `${vaciarAnio}-${String(vaciarMes).padStart(2, '0')}`;
  const turnosDelMesSeleccionado = useMemo(
    () => turnos.filter((t) => t.fecha.startsWith(vaciarYearMonth)),
    [turnos, vaciarYearMonth]
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>([hoyParts.year - 1, hoyParts.year, hoyParts.year + 1]);
    turnos.forEach((t) => {
      const y = parseInt(t.fecha.slice(0, 4), 10);
      if (Number.isFinite(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [turnos, hoyParts.year]);

  const openVaciarModal = () => {
    setVaciarModo('todos-turnos');
    setVaciarMes(hoyParts.month);
    setVaciarAnio(hoyParts.year);
    setVaciarConfirmText('');
    setShowVaciarModal(true);
  };

  const handleConfirmVaciar = (e: React.FormEvent) => {
    e.preventDefault();
    if (vaciarConfirmText.trim() !== 'BORRAR') return;

    // Save snapshot for 15-second Undo
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    setUndoBackup({
      turnosPrevios: [...turnos],
      miembrosPrevios: [...miembros],
    });
    undoTimerRef.current = window.setTimeout(() => {
      undoTimerRef.current = null;
      setUndoBackup(null);
    }, 15000);

    if (vaciarModo === 'todos-turnos') {
      onSaveTurnos([]);
    } else if (vaciarModo === 'un-mes') {
      onSaveTurnos(turnos.filter((t) => !t.fecha.startsWith(vaciarYearMonth)));
    } else {
      onSaveTurnos([]);
      onSaveMiembros([]);
      resetMemberForm();
    }

    setShowVaciarModal(false);
    setVaciarConfirmText('');
  };

  const handleUndoVaciar = () => {
    if (!undoBackup) return;
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    onSaveTurnos(undoBackup.turnosPrevios);
    onSaveMiembros(undoBackup.miembrosPrevios);
    setUndoBackup(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1900px] px-[24px] py-6">
      <div className="flex flex-col items-start gap-[24px] md:flex-row">
        {/* Left Panel: Miembros del comité */}
        <section className="w-full rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] md:w-[420px] md:shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[24px] font-bold text-white">Miembros del comité</h2>
            <span className="font-mono-tabular text-[15px] text-[#9ca3b0]">
              {activeMiembros.length} activos
            </span>
          </div>

          {/* Usher list */}
          <div className="mt-4 space-y-2.5">
            {miembros.length === 0 ? (
              <p className="text-[15px] text-[#8a91a0]">
                Añade los miembros del comité de ujieres aquí abajo.
              </p>
            ) : (
              miembros.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center justify-between gap-2.5 rounded-[12px] border border-[#282d39] p-3.5 transition-colors ${
                    m.activo ? 'bg-[#14171d]' : 'bg-[#14171d]/50 opacity-60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[17px] font-medium text-white">
                        {m.nombre}
                      </span>
                      {!m.activo && (
                        <span className="text-[13px] text-[#8a91a0]">(inactivo)</span>
                      )}
                    </div>
                    {(m.telefono || m.nota) && (
                      <p className="mt-0.5 truncate text-[14px] text-[#8f96a4]">
                        {m.telefono ? <span className="font-mono-tabular">{m.telefono}</span> : null}
                        {m.telefono && m.nota ? ' · ' : ''}
                        {m.nota || ''}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleMemberActive(m.id)}
                      className={`min-h-[44px] rounded-[10px] border px-3 text-[14px] font-medium transition-colors ${
                        m.activo
                          ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
                          : 'border-[#2d3340] bg-[#222630] text-[#8a91a0]'
                      }`}
                      title={m.activo ? 'Marcar como inactivo' : 'Marcar como activo'}
                    >
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMemberId(m.id);
                        setMNombre(m.nombre);
                        setMTelefono(m.telefono || '');
                        setMNota(m.nota || '');
                        setMError(null);
                      }}
                      className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] hover:text-white"
                      aria-label={`Editar a ${m.nombre}`}
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteMember(m)}
                      className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] hover:border-red-500/40 hover:text-red-400"
                      aria-label={`Borrar a ${m.nombre}`}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add / Edit Ujier form */}
          <form onSubmit={handleSaveMember} className="mt-6 space-y-4 border-t border-[#242832] pt-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-[20px] font-bold text-white">
                <UserPlus className="h-5 w-5 text-[#F2A65A]" />
                {editingMemberId ? 'Editar ujier' : '+ Añadir ujier'}
              </h3>
              {editingMemberId && (
                <button
                  type="button"
                  onClick={resetMemberForm}
                  className="text-[15px] text-[#9ca3b0] underline hover:text-white"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div>
              <label htmlFor="ujier-nombre" className="block text-[15px] text-[#9ca3b0]">
                Nombre *
              </label>
              <input
                id="ujier-nombre"
                type="text"
                value={mNombre}
                onChange={(e) => setMNombre(e.target.value)}
                placeholder="Nombre completo"
                className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label htmlFor="ujier-telefono" className="block text-[15px] text-[#9ca3b0]">
                Teléfono (opcional)
              </label>
              <input
                id="ujier-telefono"
                type="tel"
                value={mTelefono}
                onChange={(e) => setMTelefono(e.target.value)}
                placeholder="600 000 000"
                className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] font-mono-tabular text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="ujier-nota" className="block text-[15px] text-[#9ca3b0]">
                Nota (opcional)
              </label>
              <input
                id="ujier-nota"
                type="text"
                value={mNota}
                onChange={(e) => setMNota(e.target.value)}
                placeholder="Disponibilidad, observaciones..."
                className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
              />
            </div>

            {mError && <p className="text-[15px] font-medium text-red-400">{mError}</p>}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] md:w-auto"
              >
                {editingMemberId ? 'Guardar cambios' : 'Guardar'}
              </button>
            </div>
          </form>

          {/* 90-day balance counter */}
          {miembros.length > 0 && (
            <div className="mt-6 border-t border-[#242832] pt-5">
              <h4 className="text-[15px] font-semibold text-[#9ca3b0]">
                Equilibrio de servicio (últimos 90 días)
              </h4>
              <div className="mt-3 space-y-2">
                {miembros.map((m) => {
                  const n = servicios90Dias.get(m.id) || 0;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 text-[15px] text-[#c7ccd6]"
                    >
                      <span className="truncate">{m.nombre}</span>
                      <span className="shrink-0 font-mono-tabular text-[#8f96a4]">
                        90d: <strong className="text-white">{n}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Right Panel: Turnos */}
        <section className="w-full min-w-0 flex-1 rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[24px] font-bold text-white">Turnos</h2>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'proximos', label: 'Próximos' },
                    { id: 'mes', label: 'Este mes' },
                    { id: 'todos', label: 'Todos' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setVistaFiltro(tab.id)}
                    className={`flex h-[46px] items-center rounded-full border px-5 text-[16px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      vistaFiltro === tab.id
                        ? 'border-[#F2A65A] bg-[#F2A65A]/15 text-[#F2A65A]'
                        : 'border-[#2d3340] bg-[#14171d] text-[#9ca3b0] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center">
              <input
                type="search"
                value={buscarUjier}
                onChange={(e) => setBuscarUjier(e.target.value)}
                placeholder="Buscar por ujier o puesto..."
                className="min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#636b7c] focus:border-[#F2A65A] focus:outline-hidden md:w-64"
              />

              <button
                type="button"
                onClick={() => setShowCompartirModal(true)}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#F2A65A] bg-[#F2A65A]/10 px-[28px] text-[17px] font-medium text-[#F2A65A] transition-colors hover:bg-[#F2A65A]/20 whitespace-nowrap shrink-0 md:w-auto"
              >
                <Share2 className="h-5 w-5" />
                Compartir turnos
              </button>

              <button
                type="button"
                onClick={() => {
                  setRotDesde(nextMonthRange.start);
                  setRotHasta(nextMonthRange.end);
                  setRotPreview(null);
                  setShowRotativoModal(true);
                }}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-[#e6e8ec] transition-colors hover:bg-[#2a2f3c] whitespace-nowrap shrink-0 md:w-auto"
              >
                <RefreshCw className="h-5 w-5 text-[#9ca3b0]" />
                Generar turnos rotativos
              </button>

              <button
                type="button"
                onClick={openAddTurno}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] whitespace-nowrap shrink-0 md:w-auto"
              >
                <Plus className="h-5 w-5" />
                Añadir turno
              </button>

              <button
                type="button"
                onClick={openVaciarModal}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] border border-red-500/35 bg-red-500/10 px-[28px] text-[17px] font-medium text-red-300 transition-colors hover:border-red-500/60 hover:bg-red-500/20 whitespace-nowrap shrink-0 md:w-auto"
              >
                <Trash2 className="h-5 w-5" />
                Vaciar para el próximo mes
              </button>
            </div>
          </div>

          {undoBackup && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-emerald-500/35 bg-emerald-500/10 px-5 py-3.5 text-[16px] text-emerald-200">
              <span>Turnos borrados</span>
              <button
                type="button"
                onClick={handleUndoVaciar}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-[10px] border border-emerald-400/50 bg-[#14171d] px-4 text-[15px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
              >
                <RotateCcw className="h-4 w-4" />
                Deshacer
              </button>
            </div>
          )}

          {turnosFiltrados.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-[#2a2f3a] bg-[#14171d] px-6 py-12 text-center">
              <p className="text-[18px] font-medium text-[#d4d8e0]">
                No hay turnos en esta vista
              </p>
              <p className="mt-1.5 text-[15px] text-[#8a91a0]">
                Pulsa «+ Añadir turno» o «Generar turnos rotativos» para programar el servicio.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-[16px]">
                <thead>
                  <tr className="border-b border-[#242832] text-[14px] font-semibold uppercase tracking-wider text-[#8a91a0]">
                    <th className="py-3.5 pr-3">Fecha</th>
                    <th className="px-3 py-3.5">Culto</th>
                    <th className="px-3 py-3.5">Ujieres</th>
                    <th className="px-3 py-3.5">Puesto</th>
                    <th className="px-3 py-3.5">Nota</th>
                    <th className="py-3.5 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222630]">
                  {turnosFiltrados.map((t) => {
                    const isToday = t.fecha === hoy;
                    const isPast = t.fecha < hoy;
                    const missingCount = getMissingUshersCount(t);
                    const puestosResumen =
                      t.ujierIds.length > 0
                        ? Array.from(
                            new Set(t.ujierIds.map((uid, idx) => getUsherPuesto(t, uid, idx)))
                          ).join(', ')
                        : t.puesto || '—';

                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors hover:bg-[#20242d] ${
                          isPast ? 'opacity-55' : ''
                        }`}
                      >
                        <td className="whitespace-nowrap py-[18px] pr-3 font-mono-tabular text-[16px]">
                          <div className="flex items-center gap-2">
                            <span className={isToday ? 'font-semibold text-white' : 'text-[#e6e8ec]'}>
                              {formatFechaLarga(t.fecha)}
                            </span>
                            {isToday && (
                              <span className="rounded-md bg-emerald-500/20 px-2.5 py-0.5 text-[13px] font-semibold text-emerald-400">
                                hoy
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-[18px] text-[16px] text-[#c7ccd6]">
                          {t.tipoCulto && t.tipoCulto.trim() ? t.tipoCulto : '—'}
                        </td>
                        <td className="px-3 py-[18px] text-[16px]">
                          <div className="flex flex-wrap items-center gap-2">
                            {t.ujierIds.length === 0 ? (
                              <span className="italic text-[#8a91a0]">Sin asignar</span>
                            ) : (
                              <span className="font-medium text-white">
                                {t.ujierIds.map((uid, idx) => (
                                  <React.Fragment key={uid}>
                                    {idx > 0 && <span className="text-[#6b7280]">, </span>}
                                    <span>{getMemberName(uid)}</span>
                                    <span className="font-normal text-[#9ca3b0]">
                                      {' '}
                                      · {getUsherPuesto(t, uid, idx)}
                                    </span>
                                  </React.Fragment>
                                ))}
                              </span>
                            )}
                            {missingCount > 0 && (
                              <span className="inline-flex items-center rounded-md border border-[#F2A65A]/45 bg-[#F2A65A]/15 px-2.5 py-0.5 text-[13px] font-semibold text-[#F2A65A]">
                                Falta {missingCount}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-[18px] text-[16px] text-[#9ca3b0]">
                          {puestosResumen}
                        </td>
                        <td className="px-3 py-[18px] text-[15px] text-[#858c9b]">
                          {t.nota || '—'}
                        </td>
                        <td className="whitespace-nowrap py-[18px] pl-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditTurno(t)}
                              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] hover:text-white"
                              aria-label="Editar turno"
                              title="Editar o cambiar ujieres"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTurno(t)}
                              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] hover:border-red-500/40 hover:text-red-400"
                              aria-label="Borrar turno"
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

      {/* Modal: Añadir / Editar Turno */}
      {showTurnoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl">
            <h3 className="text-[24px] font-bold text-white">
              {editingTurnoId ? 'Editar turno' : 'Añadir turno'}
            </h3>

            <form onSubmit={handleSaveTurno} className="mt-5 space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="tur-fecha" className="block text-[15px] text-[#9ca3b0]">
                    Fecha
                  </label>
                  <input
                    id="tur-fecha"
                    type="date"
                    value={tFecha}
                    onChange={(e) => {
                      const nextFecha = e.target.value;
                      setTFecha(nextFecha);
                      applyDateRulesToSelection(nextFecha, tUjierIds);
                    }}
                    className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] font-mono-tabular text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="tur-culto" className="block text-[15px] text-[#9ca3b0]">
                    Tipo de culto (opcional)
                  </label>
                  <select
                    id="tur-culto"
                    value={tCulto}
                    onChange={(e) => setTCulto(e.target.value)}
                    className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                  >
                    <option value="">— Sin culto —</option>
                    {tiposCulto
                      .filter((c) => c !== 'Sin especificar')
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Rule hint for selected date */}
              <div className="rounded-[10px] border border-[#282d39] bg-[#14171d] px-4 py-2.5 text-[14px] text-[#9ca3b0]">
                {getRequiredUshersForDate(tFecha) === 2
                  ? 'Domingo: corresponden 2 ujieres (Puerta principal y Salón).'
                  : getRequiredUshersForDate(tFecha) === 1
                  ? 'Martes o viernes: corresponde 1 ujier en Puerta principal.'
                  : 'Día sin servicio fijo: puedes elegir libremente.'}
              </div>

              {/* Add new cult type inline if needed */}
              <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
                <input
                  type="text"
                  value={nuevoTipoCulto}
                  onChange={(e) => setNuevoTipoCulto(e.target.value)}
                  placeholder="O añadir nuevo tipo de culto..."
                  className="min-h-[56px] flex-1 rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = nuevoTipoCulto.trim();
                    if (!clean) return;
                    if (!tiposCulto.includes(clean)) {
                      onSaveTiposCulto([...tiposCulto, clean]);
                    }
                    setTCulto(clean);
                    setNuevoTipoCulto('');
                  }}
                  className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-white hover:bg-[#2b303c] whitespace-nowrap shrink-0 md:w-auto"
                >
                  Añadir culto
                </button>
              </div>

              {/* Ujieres multi-select */}
              <div>
                <span className="block text-[15px] text-[#9ca3b0]">
                  Ujieres asignados (puedes marcar o cambiar para intercambiar turnos)
                </span>
                {activeMiembros.length === 0 ? (
                  <p className="mt-2 text-[15px] text-[#8a91a0]">
                    No hay ujieres activos en el comité.
                  </p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {activeMiembros.map((m) => {
                      const selected = tUjierIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleToggleModalUjier(m.id)}
                          className={`flex h-[46px] items-center rounded-[12px] border px-4 text-[16px] font-medium transition-colors ${
                            selected
                              ? 'border-[#F2A65A] bg-[#F2A65A]/20 text-[#F2A65A]'
                              : 'border-[#2d3340] bg-[#14171d] text-[#c7ccd6] hover:border-[#424a5c]'
                          }`}
                        >
                          {m.nombre}
                        </button>
                      );
                    })}
                  </div>
                )}

                {tUjierIds.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-[12px] border border-[#282d39] bg-[#14171d] p-3">
                    {tUjierIds.map((uid) => (
                      <div
                        key={uid}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-[15px] font-medium text-white">
                          {getMemberName(uid)}
                        </span>
                        <select
                          value={tPuestosPorUjier[uid] || tPuesto}
                          onChange={(e) => {
                            const nextPuesto = e.target.value as PuestoComite;
                            setTPuestosPorUjier((prev) => ({
                              ...prev,
                              [uid]: nextPuesto,
                            }));
                            if (tUjierIds[0] === uid) {
                              setTPuesto(nextPuesto);
                            }
                          }}
                          aria-label={`Puesto de ${getMemberName(uid)}`}
                          className="min-h-[42px] rounded-[10px] border border-[#2d3340] bg-[#12151b] px-3 text-[15px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                        >
                          {PUESTOS_FIJOS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Puesto: desplegable con solo dos opciones */}
              <div>
                <label htmlFor="tur-puesto" className="block text-[15px] text-[#9ca3b0]">
                  Puesto
                </label>
                <select
                  id="tur-puesto"
                  value={tPuesto}
                  onChange={(e) => {
                    const nextPuesto = e.target.value as PuestoComite;
                    setTPuesto(nextPuesto);
                    if (tUjierIds.length === 1) {
                      setTPuestosPorUjier({ [tUjierIds[0]]: nextPuesto });
                    }
                  }}
                  className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                >
                  {PUESTOS_FIJOS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nota */}
              <div>
                <label htmlFor="tur-nota" className="block text-[15px] text-[#9ca3b0]">
                  Nota (opcional)
                </label>
                <input
                  id="tur-nota"
                  type="text"
                  value={tNota}
                  onChange={(e) => setTNota(e.target.value)}
                  placeholder="Llegar 20 min antes, cambio con..."
                  className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#555c6b] focus:border-[#F2A65A] focus:outline-hidden"
                />
              </div>

              <div className="flex flex-col-reverse gap-2.5 pt-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setShowTurnoModal(false)}
                  className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-[#d4d8e0] hover:text-white md:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] hover:bg-[#f5b473] md:w-auto"
                >
                  {editingTurnoId ? 'Guardar cambios' : 'Guardar turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generar turnos rotativos */}
      {showRotativoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl">
            <h3 className="text-[24px] font-bold text-white">Generar turnos rotativos</h3>
            <p className="mt-1.5 text-[15px] text-[#9ca3b0]">
              Reparte los turnos entre los {activeMiembros.length} ujieres activos: martes y
              viernes (1 en Puerta principal) y domingos (2 distintos: Puerta principal y Salón).
              Podrás editar cada turno antes de guardarlo.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="rot-desde" className="block text-[15px] text-[#9ca3b0]">
                  Desde
                </label>
                <input
                  id="rot-desde"
                  type="date"
                  value={rotDesde}
                  onChange={(e) => setRotDesde(e.target.value)}
                  className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] font-mono-tabular text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                />
              </div>
              <div>
                <label htmlFor="rot-hasta" className="block text-[15px] text-[#9ca3b0]">
                  Hasta
                </label>
                <input
                  id="rot-hasta"
                  type="date"
                  value={rotHasta}
                  onChange={(e) => setRotHasta(e.target.value)}
                  className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] font-mono-tabular text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleGeneratePreview}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#F2A65A]/70 bg-[#F2A65A]/15 px-[28px] text-[17px] font-semibold text-[#F2A65A] hover:bg-[#F2A65A]/25 md:w-auto"
              >
                <RefreshCw className="h-5 w-5" />
                Calcular reparto
              </button>
            </div>

            {/* Editable preview */}
            {rotPreview !== null && (
              <div className="mt-5 border-t border-[#242832] pt-5">
                {rotPreview.length === 0 ? (
                  <p className="text-[15px] text-[#8a91a0]">
                    No se generaron turnos. Revisa el rango de fechas o si hay ujieres activos.
                  </p>
                ) : (
                  <>
                    <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                      {rotPreview.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 rounded-[12px] border border-[#2a2f3a] bg-[#14171d] p-4"
                        >
                          <div>
                            <p className="font-mono-tabular text-[16px] font-semibold text-white">
                              {formatFechaLarga(item.fecha)}
                            </p>
                            <p className="text-[13px] text-[#9ca3b0]">
                              {getRequiredUshersForDate(item.fecha) === 2
                                ? 'Domingo · 2 ujieres (Puerta principal y Salón)'
                                : 'Martes/Viernes · 1 ujier (Puerta principal)'}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {activeMiembros.map((m) => {
                              const selected = item.ujierIds.includes(m.id);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    const next = [...rotPreview];
                                    const current = next[idx].ujierIds;
                                    const currentMap = { ...(next[idx].puestosPorUjier || {}) };
                                    if (selected) {
                                      delete currentMap[m.id];
                                      next[idx] = {
                                        ...next[idx],
                                        ujierIds: current.filter((id) => id !== m.id),
                                        puestosPorUjier: currentMap,
                                      };
                                    } else {
                                      const defaults = getDefaultPuestosForDate(item.fecha);
                                      const used = current.map((id) => currentMap[id]);
                                      const assignedRole: PuestoComite =
                                        defaults.length === 2 && !used.includes('Salón') && used.includes('Puerta principal')
                                          ? 'Salón'
                                          : 'Puerta principal';
                                      currentMap[m.id] = assignedRole;
                                      next[idx] = {
                                        ...next[idx],
                                        ujierIds: [...current, m.id],
                                        puestosPorUjier: currentMap,
                                      };
                                    }
                                    setRotPreview(next);
                                  }}
                                  className={`min-h-[40px] rounded-[10px] border px-3 text-[15px] ${
                                    selected
                                      ? 'border-[#F2A65A] bg-[#F2A65A]/20 text-[#F2A65A]'
                                      : 'border-[#2d3340] bg-[#1a1d24] text-[#8a91a0]'
                                  }`}
                                >
                                  {m.nombre}
                                </button>
                              );
                            })}
                          </div>

                          {item.ujierIds.length > 0 && (
                            <div className="flex flex-wrap gap-3 border-t border-[#242832] pt-2.5">
                              {item.ujierIds.map((uid, uIdx) => (
                                <div key={uid} className="flex items-center gap-2 text-[14px]">
                                  <span className="font-medium text-[#e6e8ec]">
                                    {getMemberName(uid)}:
                                  </span>
                                  <select
                                    value={getUsherPuesto(item, uid, uIdx)}
                                    onChange={(e) => {
                                      const next = [...rotPreview];
                                      const nextMap = { ...(next[idx].puestosPorUjier || {}) };
                                      nextMap[uid] = e.target.value as PuestoComite;
                                      next[idx] = {
                                        ...next[idx],
                                        puestosPorUjier: nextMap,
                                        puesto: nextMap[next[idx].ujierIds[0]] || 'Puerta principal',
                                      };
                                      setRotPreview(next);
                                    }}
                                    aria-label={`Puesto de ${getMemberName(uid)} en ${item.fecha}`}
                                    className="min-h-[36px] rounded-[8px] border border-[#2d3340] bg-[#12151b] px-2.5 text-[14px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                                  >
                                    {PUESTOS_FIJOS.map((p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Total por ujier */}
                    <div className="mt-4 rounded-[12px] border border-[#282d39] bg-[#14171d] p-4">
                      <h4 className="text-[14px] font-semibold uppercase tracking-wider text-[#9ca3b0]">
                        Total por ujier en este reparto
                      </h4>
                      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {rotPreviewTotals.map((row) => (
                          <div
                            key={row.miembro.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-[#1a1d24] px-3.5 py-2 text-[15px]"
                          >
                            <span className="truncate font-medium text-white">
                              {row.miembro.nombre}
                            </span>
                            <span className="shrink-0 font-mono-tabular text-[#c7ccd6]">
                              <strong className="text-[#F2A65A]">{row.total}</strong>{' '}
                              <span className="text-[13px] text-[#8a91a0]">
                                ({row.puerta} Puerta · {row.salon} Salón)
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() => setShowRotativoModal(false)}
                className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-[#d4d8e0] hover:text-white md:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!rotPreview || rotPreview.length === 0}
                onClick={handleSaveRotating}
                className="min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] hover:bg-[#f5b473] disabled:opacity-40 md:w-auto"
              >
                Guardar turnos ({rotPreview?.length || 0})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete member */}
      <ConfirmModal
        open={Boolean(deleteMember)}
        title="Borrar miembro del comité"
        message={
          deleteMember
            ? memberAssignedCount(deleteMember.id) > 0
              ? `«${deleteMember.nombre}» tiene ${memberAssignedCount(
                  deleteMember.id
                )} turno(s) asignado(s). Si lo borras, esos turnos quedarán «Sin asignar» para que puedas reasignarlos.`
              : `¿Seguro que quieres borrar a «${deleteMember.nombre}» del comité de ujieres?`
            : ''
        }
        confirmLabel={
          deleteMember && memberAssignedCount(deleteMember.id) > 0
            ? 'Borrar y dejar sin asignar'
            : 'Borrar'
        }
        onConfirm={confirmDeleteMember}
        onCancel={() => setDeleteMember(null)}
      />

      {/* Confirm delete shift */}
      <ConfirmModal
        open={Boolean(deleteTurno)}
        title="Borrar turno"
        message={
          deleteTurno
            ? `¿Seguro que quieres borrar el turno del ${formatFechaLarga(deleteTurno.fecha)}${
                deleteTurno.tipoCulto && deleteTurno.tipoCulto.trim()
                  ? ` (${deleteTurno.tipoCulto})`
                  : ''
              }?`
            : ''
        }
        confirmLabel="Borrar"
        onConfirm={() => {
          if (!deleteTurno) return;
          onSaveTurnos(turnos.filter((t) => t.id !== deleteTurno.id));
          setDeleteTurno(null);
        }}
        onCancel={() => setDeleteTurno(null)}
      />

      {/* Modal: Vaciar para el próximo mes */}
      {showVaciarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vaciar-modal-title"
        >
          <form
            onSubmit={handleConfirmVaciar}
            className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="vaciar-modal-title" className="text-[24px] font-bold text-white">
                  Vaciar para el próximo mes
                </h3>
                <p className="mt-1 text-[15px] text-[#9ca3b0]">
                  Elige qué deseas borrar. Podrás deshacerlo durante 15 segundos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVaciarModal(false)}
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] text-[#8a91a0] hover:bg-[#252a34] hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {/* Option 1: Borrar todos los turnos */}
              <label
                className={`block cursor-pointer rounded-[12px] border p-4 transition-colors ${
                  vaciarModo === 'todos-turnos'
                    ? 'border-red-500/60 bg-red-500/10'
                    : 'border-[#2d3340] bg-[#14171d] hover:border-[#3d4454]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="vaciar-modo"
                    checked={vaciarModo === 'todos-turnos'}
                    onChange={() => setVaciarModo('todos-turnos')}
                    className="mt-1 h-5 w-5 shrink-0 accent-red-500"
                  />
                  <div>
                    <p className="text-[17px] font-semibold text-white">
                      Borrar todos los turnos
                    </p>
                    <p className="mt-0.5 text-[14px] text-[#9ca3b0]">
                      La tabla de turnos queda vacía; los miembros del comité se mantienen.
                    </p>
                    <p className="mt-1.5 text-[13px] font-medium text-red-300">
                      Se borrarán {turnos.length} {turnos.length === 1 ? 'turno' : 'turnos'}
                    </p>
                  </div>
                </div>
              </label>

              {/* Option 2: Borrar solo los turnos de un mes */}
              <label
                className={`block cursor-pointer rounded-[12px] border p-4 transition-colors ${
                  vaciarModo === 'un-mes'
                    ? 'border-red-500/60 bg-red-500/10'
                    : 'border-[#2d3340] bg-[#14171d] hover:border-[#3d4454]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="vaciar-modo"
                    checked={vaciarModo === 'un-mes'}
                    onChange={() => setVaciarModo('un-mes')}
                    className="mt-1 h-5 w-5 shrink-0 accent-red-500"
                  />
                  <div className="flex-1">
                    <p className="text-[17px] font-semibold text-white">
                      Borrar solo los turnos de un mes
                    </p>

                    <div className="mt-2.5 flex flex-wrap gap-2.5">
                      <select
                        value={vaciarMes}
                        onChange={(e) => {
                          setVaciarModo('un-mes');
                          setVaciarMes(Number(e.target.value));
                        }}
                        aria-label="Mes"
                        className="min-h-[48px] rounded-[10px] border border-[#2d3340] bg-[#0d0f14] px-3.5 text-[16px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                      >
                        {MESES_LARGO_ES.map((m, idx) => (
                          <option key={m} value={idx + 1}>
                            {m}
                          </option>
                        ))}
                      </select>

                      <select
                        value={vaciarAnio}
                        onChange={(e) => {
                          setVaciarModo('un-mes');
                          setVaciarAnio(Number(e.target.value));
                        }}
                        aria-label="Año"
                        className="min-h-[48px] rounded-[10px] border border-[#2d3340] bg-[#0d0f14] px-3.5 font-mono-tabular text-[16px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                      >
                        {availableYears.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="mt-2 text-[13px] font-medium text-red-300">
                      Se borrarán {turnosDelMesSeleccionado.length}{' '}
                      {turnosDelMesSeleccionado.length === 1 ? 'turno' : 'turnos'} de{' '}
                      {MESES_LARGO_ES[vaciarMes - 1]} {vaciarAnio}
                    </p>
                  </div>
                </div>
              </label>

              {/* Option 3: Borrar turnos y todos los miembros */}
              <label
                className={`block cursor-pointer rounded-[12px] border p-4 transition-colors ${
                  vaciarModo === 'todo-cero'
                    ? 'border-red-500/60 bg-red-500/10'
                    : 'border-[#2d3340] bg-[#14171d] hover:border-[#3d4454]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="vaciar-modo"
                    checked={vaciarModo === 'todo-cero'}
                    onChange={() => setVaciarModo('todo-cero')}
                    className="mt-1 h-5 w-5 shrink-0 accent-red-500"
                  />
                  <div>
                    <p className="text-[17px] font-semibold text-white">
                      Borrar los turnos y también todos los miembros del comité
                    </p>
                    <p className="mt-0.5 text-[14px] text-[#9ca3b0]">Empezar de cero.</p>
                    <p className="mt-1.5 text-[13px] font-medium text-red-300">
                      Se borrarán {turnos.length} {turnos.length === 1 ? 'turno' : 'turnos'} y{' '}
                      {miembros.length} {miembros.length === 1 ? 'miembro' : 'miembros'}
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {/* Confirmation input */}
            <div className="mt-5 border-t border-[#242832] pt-4">
              <label htmlFor="vaciar-confirm-input" className="block text-[15px] text-[#d4d8e0]">
                Escribe <strong className="font-mono-tabular text-white">BORRAR</strong> para
                confirmar
              </label>
              <input
                id="vaciar-confirm-input"
                type="text"
                value={vaciarConfirmText}
                onChange={(e) => setVaciarConfirmText(e.target.value)}
                placeholder="BORRAR"
                autoComplete="off"
                className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] font-mono-tabular text-[18px] text-white placeholder:text-[#555c6b] focus:border-red-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() => setShowVaciarModal(false)}
                className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-[#d4d8e0] hover:text-white md:w-auto"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={vaciarConfirmText.trim() !== 'BORRAR'}
                className="min-h-[52px] w-full rounded-[12px] bg-red-600 px-[28px] text-[17px] font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto"
              >
                Borrar
              </button>
            </div>
          </form>
        </div>
      )}

      <CompartirTurnosModal
        isOpen={showCompartirModal}
        onClose={() => setShowCompartirModal(false)}
        turnos={turnos}
        miembros={miembros}
        hoy={hoy}
      />
    </div>
  );
};
