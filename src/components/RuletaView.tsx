import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Upload, X, Monitor, Users, AlertTriangle } from 'lucide-react';
import {
  ConfigRuleta,
  FondoRuleta,
  FondoRuletaPersonalizado,
  ListaRuleta,
  PantallaRuletaState,
  Simpatizante,
  SonidoRuleta,
  SpinRuletaPayload,
} from '../types';
import { formatFechaMedia, getTodayMadridISO } from '../utils/dates';
import { generateId } from '../utils/storage';
import { ConfirmModal } from './ConfirmModal';
import { RuletaFondoLayer, RuletaStage } from './RuletaStage';

interface RuletaViewProps {
  config: ConfigRuleta;
  simpatizantes: Simpatizante[];
  pantallaRuleta: PantallaRuletaState | null;
  onSaveConfig: (next: ConfigRuleta) => void;
  onSendRuletaToPantalla: (state: PantallaRuletaState | null) => void;
}

const MAX_NOMBRES_RULETA = 120;

function mergeUniqueNames(existingLines: string[], addedNames: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of [...existingLines, ...addedNames]) {
    const clean = raw.trim();
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('es-ES');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

export function parseUniqueNombres(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const clean = line.trim();
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('es-ES');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= MAX_NOMBRES_RULETA) break;
  }

  return result;
}

const PRESET_FONDOS: { id: Exclude<FondoRuleta, 'personalizado'>; label: string }[] = [
  { id: 'fiesta', label: 'Fiesta' },
  { id: 'feria', label: 'Feria' },
  { id: 'estrellas', label: 'Estrellas' },
  { id: 'globos', label: 'Globos' },
];

const COLOR_PRESETS = ['#0c1c47', '#1f1235', '#2b0f1b', '#0b2b26', '#181c24', '#3b240c'];

export const RuletaView: React.FC<RuletaViewProps> = ({
  config,
  simpatizantes,
  pantallaRuleta,
  onSaveConfig,
  onSendRuletaToPantalla,
}) => {
  const listaActiva: ListaRuleta = useMemo(
    () => config.listas.find((l) => l.id === config.listaActivaId) || config.listas[0],
    [config.listas, config.listaActivaId]
  );

  const todosNombres = useMemo(
    () => parseUniqueNombres(listaActiva?.nombresTexto || ''),
    [listaActiva?.nombresTexto]
  );

  const excluidosSet = useMemo(
    () => new Set((listaActiva?.excluidos || []).map((n) => n.toLocaleLowerCase('es-ES'))),
    [listaActiva?.excluidos]
  );

  const nombresActivos = useMemo(
    () => todosNombres.filter((n) => !excluidosSet.has(n.toLocaleLowerCase('es-ES'))),
    [todosNombres, excluidosSet]
  );

  // Spin & local visual state
  const [wheelAngle, setWheelAngle] = useState(0);
  const [activeSpin, setActiveSpin] = useState<SpinRuletaPayload | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [ultimoGanador, setUltimoGanador] = useState<string | null>(null);
  const [pendienteExcluir, setPendienteExcluir] = useState<string | null>(null);
  const [spinError, setSpinError] = useState<string | null>(null);

  // List management UI state
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [renamingList, setRenamingList] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteList, setConfirmDeleteList] = useState(false);

  // Custom background modal
  const [showFondoModal, setShowFondoModal] = useState(false);
  const [customColor, setCustomColor] = useState(
    config.fondoPersonalizado?.tipo === 'color' ? config.fondoPersonalizado.valor : '#0c1c47'
  );
  const fondoFileRef = useRef<HTMLInputElement>(null);
  const spinPersistTimeoutRef = useRef<number | null>(null);

  // Import simpatizantes modal state
  const hoy = getTodayMadridISO();
  const [showImportModal, setShowImportModal] = useState(false);
  const [importModo, setImportModo] = useState<'hoy' | 'fecha' | 'todos'>('hoy');
  const [importFecha, setImportFecha] = useState(hoy);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
  const [creatingFromImport, setCreatingFromImport] = useState(false);
  const [importNewListName, setImportNewListName] = useState('');
  const [importNameError, setImportNameError] = useState<string | null>(null);

  const importFilteredSimpatizantes = useMemo(() => {
    return [...simpatizantes]
      .filter((s) => {
        if (importModo === 'hoy') return s.ultimaVisita === hoy;
        if (importModo === 'fecha') return s.ultimaVisita === importFecha;
        return true;
      })
      .sort((a, b) => {
        if (a.ultimaVisita !== b.ultimaVisita) {
          return b.ultimaVisita.localeCompare(a.ultimaVisita);
        }
        return a.nombre.localeCompare(b.nombre, 'es');
      });
  }, [simpatizantes, importModo, importFecha, hoy]);

  // Select all matching simpatizantes by default whenever modal opens or filter changes
  useEffect(() => {
    if (!showImportModal) return;
    setSelectedImportIds(new Set(importFilteredSimpatizantes.map((s) => s.id)));
  }, [showImportModal, importFilteredSimpatizantes]);

  const selectedImportNames = useMemo(() => {
    const raw = importFilteredSimpatizantes
      .filter((s) => selectedImportIds.has(s.id))
      .map((s) => s.nombre.trim())
      .filter(Boolean);
    return mergeUniqueNames([], raw);
  }, [importFilteredSimpatizantes, selectedImportIds]);

  const mergedWithCurrentNames = useMemo(() => {
    const existingLines = (listaActiva?.nombresTexto || '').split(/\r?\n/);
    return mergeUniqueNames(existingLines, selectedImportNames);
  }, [listaActiva?.nombresTexto, selectedImportNames]);

  const importExceedsLimitForAppend = mergedWithCurrentNames.length > MAX_NOMBRES_RULETA;
  const importExceedsLimitForNew = selectedImportNames.length > MAX_NOMBRES_RULETA;

  const isLiveOnPantalla = Boolean(pantallaRuleta?.activa);
  const isLiveRef = useRef(isLiveOnPantalla);
  isLiveRef.current = isLiveOnPantalla;

  useEffect(() => {
    return () => {
      if (spinPersistTimeoutRef.current !== null) {
        window.clearTimeout(spinPersistTimeoutRef.current);
      }
    };
  }, []);

  // Clear pending exclusion if list changes or sinRepetir is turned off
  useEffect(() => {
    setPendienteExcluir(null);
    setUltimoGanador(null);
    setSpinError(null);
  }, [listaActiva?.id]);

  useEffect(() => {
    if (!config.sinRepetir) {
      setPendienteExcluir(null);
    }
  }, [config.sinRepetir]);

  // Helper to push live settings updates when projector already shows Ruleta
  const syncLivePantallaIfActive = (
    nextConfig: ConfigRuleta,
    nextNombres: string[],
    overrides?: Partial<PantallaRuletaState>
  ) => {
    if (!isLiveOnPantalla) return;
    onSendRuletaToPantalla({
      activa: true,
      titulo: nextConfig.tituloPantalla,
      nombres: nextNombres,
      fondo: nextConfig.fondo,
      fondoPersonalizado: nextConfig.fondoPersonalizado,
      sonido: nextConfig.sonido,
      confeti: nextConfig.confeti,
      anguloActual: wheelAngle,
      ultimoGanador,
      spin: null,
      ...overrides,
    });
  };

  const updateListaActiva = (patch: Partial<ListaRuleta>, nextNombresOverride?: string[]) => {
    const nextListas = config.listas.map((l) =>
      l.id === listaActiva.id ? { ...l, ...patch } : l
    );
    const nextConfig = { ...config, listas: nextListas };
    onSaveConfig(nextConfig);

    if (nextNombresOverride) {
      syncLivePantallaIfActive(nextConfig, nextNombresOverride);
    } else if (patch.nombresTexto !== undefined || patch.excluidos !== undefined) {
      const updatedAll = parseUniqueNombres(
        patch.nombresTexto !== undefined ? patch.nombresTexto : listaActiva.nombresTexto
      );
      const updatedExcl = new Set(
        (patch.excluidos !== undefined ? patch.excluidos : listaActiva.excluidos).map((n) =>
          n.toLocaleLowerCase('es-ES')
        )
      );
      syncLivePantallaIfActive(
        nextConfig,
        updatedAll.filter((n) => !updatedExcl.has(n.toLocaleLowerCase('es-ES')))
      );
    }
  };

  const updateConfig = (patch: Partial<ConfigRuleta>) => {
    const nextConfig = { ...config, ...patch };
    onSaveConfig(nextConfig);
    syncLivePantallaIfActive(nextConfig, nombresActivos);
  };

  const handleSelectList = (id: string) => {
    const target = config.listas.find((l) => l.id === id);
    if (!target) return;
    const nextConfig = { ...config, listaActivaId: id };
    onSaveConfig(nextConfig);
    setRenamingList(false);
    setCreatingList(false);

    if (isLiveOnPantalla) {
      const all = parseUniqueNombres(target.nombresTexto);
      const excl = new Set(target.excluidos.map((n) => n.toLocaleLowerCase('es-ES')));
      syncLivePantallaIfActive(
        nextConfig,
        all.filter((n) => !excl.has(n.toLocaleLowerCase('es-ES'))),
        { ultimoGanador: null }
      );
    }
  };

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newListName.trim();
    if (!clean) return;
    const nueva: ListaRuleta = {
      id: generateId('lista'),
      nombre: clean,
      nombresTexto: '',
      excluidos: [],
    };
    const nextConfig: ConfigRuleta = {
      ...config,
      listas: [...config.listas, nueva],
      listaActivaId: nueva.id,
    };
    onSaveConfig(nextConfig);
    setNewListName('');
    setCreatingList(false);
    syncLivePantallaIfActive(nextConfig, [], { ultimoGanador: null });
  };

  const handleRenameList = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = renameValue.trim();
    if (!clean) return;
    updateListaActiva({ nombre: clean });
    setRenamingList(false);
  };

  const handleDeleteList = () => {
    if (config.listas.length <= 1) return;
    const remaining = config.listas.filter((l) => l.id !== listaActiva.id);
    const nextActive = remaining[0];
    const nextConfig: ConfigRuleta = {
      ...config,
      listas: remaining,
      listaActivaId: nextActive.id,
    };
    onSaveConfig(nextConfig);
    setConfirmDeleteList(false);
    setRenamingList(false);

    if (isLiveOnPantalla) {
      const all = parseUniqueNombres(nextActive.nombresTexto);
      const excl = new Set(nextActive.excluidos.map((n) => n.toLocaleLowerCase('es-ES')));
      syncLivePantallaIfActive(
        nextConfig,
        all.filter((n) => !excl.has(n.toLocaleLowerCase('es-ES'))),
        { ultimoGanador: null }
      );
    }
  };

  const handleRestoreAll = () => {
    setPendienteExcluir(null);
    setUltimoGanador(null);
    setSpinError(null);
    updateListaActiva({ excluidos: [] }, todosNombres);
  };

  const openImportModal = () => {
    setImportModo('hoy');
    setImportFecha(hoy);
    setCreatingFromImport(false);
    setImportNewListName('');
    setImportNameError(null);
    setShowImportModal(true);
  };

  const handleToggleAllImport = () => {
    const allSelected =
      importFilteredSimpatizantes.length > 0 &&
      importFilteredSimpatizantes.every((s) => selectedImportIds.has(s.id));
    if (allSelected) {
      setSelectedImportIds(new Set());
    } else {
      setSelectedImportIds(new Set(importFilteredSimpatizantes.map((s) => s.id)));
    }
  };

  const handleToggleOneImport = (id: string) => {
    setSelectedImportIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleImportAddToCurrent = () => {
    if (selectedImportNames.length === 0) return;
    const cappedNames = mergedWithCurrentNames.slice(0, MAX_NOMBRES_RULETA);
    const nextTexto = cappedNames.join('\n');
    const exclSet = new Set(
      listaActiva.excluidos.map((n) => n.toLocaleLowerCase('es-ES'))
    );
    const nextActive = cappedNames.filter(
      (n) => !exclSet.has(n.toLocaleLowerCase('es-ES'))
    );
    setSpinError(null);
    updateListaActiva({ nombresTexto: nextTexto }, nextActive);
    setShowImportModal(false);
  };

  const handleImportCreateNewList = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = importNewListName.trim();
    if (!cleanName) {
      setImportNameError('Escribe un nombre para la nueva lista.');
      return;
    }
    if (selectedImportNames.length === 0) return;
    const cappedNames = selectedImportNames.slice(0, MAX_NOMBRES_RULETA);
    const nueva: ListaRuleta = {
      id: generateId('lista'),
      nombre: cleanName,
      nombresTexto: cappedNames.join('\n'),
      excluidos: [],
    };
    const nextConfig: ConfigRuleta = {
      ...config,
      listas: [...config.listas, nueva],
      listaActivaId: nueva.id,
      sinRepetir: true,
    };
    onSaveConfig(nextConfig);
    setWheelAngle(0);
    setUltimoGanador(null);
    setPendienteExcluir(null);
    setSpinError(null);
    setCreatingList(false);
    setRenamingList(false);
    if (isLiveOnPantalla) {
      onSendRuletaToPantalla({
        activa: true,
        titulo: nextConfig.tituloPantalla,
        nombres: cappedNames,
        fondo: nextConfig.fondo,
        fondoPersonalizado: nextConfig.fondoPersonalizado,
        sonido: nextConfig.sonido,
        confeti: nextConfig.confeti,
        anguloActual: 0,
        ultimoGanador: null,
        spin: null,
      });
    }
    setShowImportModal(false);
  };

  const handleSendToPantalla = () => {
    onSendRuletaToPantalla({
      activa: true,
      titulo: config.tituloPantalla,
      nombres: nombresActivos,
      fondo: config.fondo,
      fondoPersonalizado: config.fondoPersonalizado,
      sonido: config.sonido,
      confeti: config.confeti,
      anguloActual: wheelAngle,
      ultimoGanador,
      spin: null,
    });
  };

  const handleRemoveFromPantalla = () => {
    if (spinPersistTimeoutRef.current !== null) {
      window.clearTimeout(spinPersistTimeoutRef.current);
      spinPersistTimeoutRef.current = null;
    }
    onSendRuletaToPantalla(null);
  };

  const handleGirar = () => {
    if (isSpinning) return;
    if (spinPersistTimeoutRef.current !== null) {
      window.clearTimeout(spinPersistTimeoutRef.current);
      spinPersistTimeoutRef.current = null;
    }
    setSpinError(null);

    let nombresParaGiro = nombresActivos;
    let nextConfig = config;

    // Apply deferred exclusion from previous spin when "Sin repetir" is enabled
    if (config.sinRepetir && pendienteExcluir) {
      const pendingKey = pendienteExcluir.toLocaleLowerCase('es-ES');
      const alreadyExcluded = listaActiva.excluidos.some(
        (n) => n.toLocaleLowerCase('es-ES') === pendingKey
      );
      if (!alreadyExcluded) {
        const nextExcluidos = [...listaActiva.excluidos, pendienteExcluir];
        const nextListas = config.listas.map((l) =>
          l.id === listaActiva.id ? { ...l, excluidos: nextExcluidos } : l
        );
        nextConfig = { ...config, listas: nextListas };
        onSaveConfig(nextConfig);
        nombresParaGiro = nombresActivos.filter(
          (n) => n.toLocaleLowerCase('es-ES') !== pendingKey
        );
      }
      setPendienteExcluir(null);
    }

    if (nombresParaGiro.length === 0) {
      setSpinError('No quedan nombres disponibles. Pulsa «Volver a poner a todos».');
      return;
    }

    const total = nombresParaGiro.length;
    const sliceDeg = 360 / total;
    const winnerIdx = Math.floor(Math.random() * total);
    const winner = nombresParaGiro[winnerIdx];

    // Add slight natural offset inside the winning slice while staying solidly inside it
    const jitter = (Math.random() - 0.5) * 0.52;
    const targetLocalDeg = (winnerIdx + 0.5 + jitter) * sliceDeg;
    const desiredMod = (360 - (targetLocalDeg % 360)) % 360;
    const currentMod = ((wheelAngle % 360) + 360) % 360;
    const deltaToDesired = (desiredMod - currentMod + 360) % 360;
    const extraFullSpins = (5 + Math.floor(Math.random() * 3)) * 360;
    const targetAngle = wheelAngle + extraFullSpins + deltaToDesired;

    const payload: SpinRuletaPayload = {
      id: generateId('spin'),
      startAngle: wheelAngle,
      targetAngle,
      winner,
      durationMs: 4200,
    };

    setIsSpinning(true);
    setUltimoGanador(null);
    setActiveSpin(payload);

    if (isLiveOnPantalla) {
      onSendRuletaToPantalla({
        activa: true,
        titulo: nextConfig.tituloPantalla,
        nombres: nombresParaGiro,
        fondo: nextConfig.fondo,
        fondoPersonalizado: nextConfig.fondoPersonalizado,
        sonido: nextConfig.sonido,
        confeti: nextConfig.confeti,
        anguloActual: wheelAngle,
        ultimoGanador: null,
        spin: payload,
      });
    }
  };

  const handleSpinEnd = (finalAngle: number, winner: string) => {
    setWheelAngle(finalAngle);
    setIsSpinning(false);
    setActiveSpin(null);
    setUltimoGanador(winner);
    if (config.sinRepetir) {
      setPendienteExcluir(winner);
    }
    if (isLiveRef.current) {
      spinPersistTimeoutRef.current = window.setTimeout(() => {
        spinPersistTimeoutRef.current = null;
        if (!isLiveRef.current) return;
        onSendRuletaToPantalla({
          activa: true,
          titulo: config.tituloPantalla,
          nombres: nombresActivos,
          fondo: config.fondo,
          fondoPersonalizado: config.fondoPersonalizado,
          sonido: config.sonido,
          confeti: config.confeti,
          anguloActual: finalAngle,
          ultimoGanador: winner,
          spin: null,
        });
      }, 450);
    }
  };

  const handleFondoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Resize smoothly to keep localStorage fast & safe
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const personalizado: FondoRuletaPersonalizado = { tipo: 'imagen', valor: dataUrl };
        updateConfig({ fondo: 'personalizado', fondoPersonalizado: personalizado });
        setShowFondoModal(false);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyCustomColor = (hex: string) => {
    setCustomColor(hex);
    updateConfig({
      fondo: 'personalizado',
      fondoPersonalizado: { tipo: 'color', valor: hex },
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1900px] px-[24px] py-7">
      <div className="flex flex-col gap-[24px] lg:flex-row lg:items-stretch">
        {/* LEFT COLUMN: Listas & Nombres */}
        <section className="w-full shrink-0 rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] flex flex-col lg:w-[390px]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[24px] font-bold text-white">Listas</h2>
            <button
              type="button"
              onClick={() => {
                setCreatingList((v) => !v);
                setRenamingList(false);
              }}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] border border-[#2d3340] bg-[#111318] px-4 text-[16px] font-medium text-[#e6e8ec] transition-colors hover:border-[#F2A65A]/70 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Nueva
            </button>
          </div>

          {creatingList && (
            <form onSubmit={handleCreateList} className="mt-4 flex flex-col gap-2.5 rounded-xl border border-[#2d3340] bg-[#111318] p-3.5">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Nombre de la lista..."
                autoFocus
                className="min-h-[48px] w-full rounded-[10px] border border-[#2a2f3a] bg-[#0d0f14] px-3.5 text-[16px] text-white focus:border-[#F2A65A] focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] rounded-[10px] bg-[#F2A65A] px-3 text-[15px] font-semibold text-[#111318] hover:bg-[#f5b473]"
                >
                  Crear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingList(false);
                    setNewListName('');
                  }}
                  className="min-h-[44px] rounded-[10px] border border-[#2d3340] px-3 text-[15px] text-[#9ca3b0] hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista selector buttons */}
          <div className="mt-4 space-y-2 max-h-[190px] overflow-y-auto pr-0.5">
            {config.listas.map((lista) => {
              const allCount = parseUniqueNombres(lista.nombresTexto).length;
              const exclSet = new Set(
                lista.excluidos.map((n) => n.toLocaleLowerCase('es-ES'))
              );
              const activeCount = parseUniqueNombres(lista.nombresTexto).filter(
                (n) => !exclSet.has(n.toLocaleLowerCase('es-ES'))
              ).length;
              const isSelected = lista.id === listaActiva.id;

              return (
                <button
                  key={lista.id}
                  type="button"
                  onClick={() => handleSelectList(lista.id)}
                  className={`flex min-h-[50px] w-full items-center justify-between rounded-[12px] border px-4 py-2.5 text-left text-[17px] font-medium transition-colors ${
                    isSelected
                      ? 'border-[#F2A65A]/80 bg-[#2d241c] text-white'
                      : 'border-[#262b36] bg-[#111318] text-[#b4bac6] hover:border-[#3a4150] hover:text-white'
                  }`}
                >
                  <span className="truncate pr-2">{lista.nombre}</span>
                  <span
                    className={`font-mono-tabular text-[15px] ${
                      isSelected ? 'text-[#F2A65A]' : 'text-[#8a91a0]'
                    }`}
                    title={`${activeCount} activos de ${allCount}`}
                  >
                    {activeCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Rename / Delete actions */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[15px]">
            <button
              type="button"
              onClick={() => {
                setRenamingList((v) => !v);
                setRenameValue(listaActiva.nombre);
                setCreatingList(false);
              }}
              className="font-medium text-[#F2A65A] transition-colors hover:text-[#f7ba7b]"
            >
              Cambiar nombre
            </button>
            <button
              type="button"
              disabled={config.listas.length <= 1}
              onClick={() => setConfirmDeleteList(true)}
              className="font-medium text-[#8a91a0] transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Borrar lista
            </button>
          </div>

          {renamingList && (
            <form onSubmit={handleRenameList} className="mt-3 flex gap-2">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                className="min-h-[46px] flex-1 rounded-[10px] border border-[#F2A65A]/70 bg-[#0d0f14] px-3.5 text-[16px] text-white focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[46px] rounded-[10px] bg-[#F2A65A] px-4 text-[15px] font-semibold text-[#111318]"
              >
                Guardar
              </button>
            </form>
          )}

          {/* Names textarea */}
          <div className="mt-5 flex flex-1 flex-col">
            <label
              htmlFor="ruleta-nombres-textarea"
              className="mb-2 block text-[15px] font-semibold text-white"
            >
              Nombres <span className="font-normal text-[#9ca3b0]">({nombresActivos.length})</span>
            </label>
            <textarea
              id="ruleta-nombres-textarea"
              value={listaActiva.nombresTexto}
              onChange={(e) => updateListaActiva({ nombresTexto: e.target.value })}
              placeholder={'Escribe un nombre por línea...\nEjemplo:\nSamuel Paredes\nElena Morales'}
              className="min-h-[340px] w-full flex-1 resize-y rounded-[12px] border border-[#2a2f3a] bg-[#0d0f14] p-[16px] text-[18px] leading-relaxed text-white placeholder-[#555c6b] focus:border-[#F2A65A] focus:outline-none lg:min-h-[430px]"
            />
            <p className="mt-2.5 text-[14px] text-[#8a91a0]">
              Se guarda solo. Hasta {MAX_NOMBRES_RULETA} nombres.
            </p>
            <button
              type="button"
              onClick={openImportModal}
              className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#F2A65A]/70 bg-[#111318] px-4 text-[16px] font-semibold text-[#F2A65A] transition-colors hover:bg-[#F2A65A]/15"
            >
              <Users className="h-5 w-5 shrink-0" />
              Importar simpatizantes
            </button>
          </div>
        </section>

        {/* CENTER COLUMN: Stage + Girar button */}
        <section className="flex min-w-0 flex-1 flex-col items-center justify-between rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px]">
          <div className="w-full flex-1 flex flex-col">
            <RuletaStage
              nombres={nombresActivos}
              titulo={config.tituloPantalla}
              fondo={config.fondo}
              fondoPersonalizado={config.fondoPersonalizado}
              sonido={config.sonido}
              confeti={config.confeti}
              anguloInicial={wheelAngle}
              spinPayload={activeSpin}
              ultimoGanador={ultimoGanador}
              onSpinEnd={handleSpinEnd}
            />
          </div>

          {spinError && (
            <p className="mt-3 text-center text-[15px] font-medium text-amber-300">
              {spinError}
            </p>
          )}

          <div className="mt-5 flex w-full justify-center">
            <button
              type="button"
              disabled={isSpinning || nombresActivos.length === 0}
              onClick={handleGirar}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] shadow-lg transition-colors hover:bg-[#f5b473] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:min-w-[210px]"
            >
              <span aria-hidden="true">🎡</span>
              {isSpinning ? 'Girando...' : 'Girar'}
            </button>
          </div>
        </section>

        {/* RIGHT COLUMN: Pantalla, Fondo, Sonido, Opciones */}
        <aside className="w-full shrink-0 rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] flex flex-col gap-5 lg:w-[390px]">
          {/* Pantalla */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[24px] font-bold text-white">Pantalla</h2>
              {isLiveOnPantalla && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[13px] font-semibold text-emerald-300">
                  <Monitor className="h-3.5 w-3.5" />
                  En pantalla
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={handleSendToPantalla}
                className="min-h-[52px] flex-1 rounded-[12px] bg-[#F2A65A] px-5 text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] whitespace-nowrap"
              >
                Enviar a pantalla
              </button>
              <button
                type="button"
                onClick={handleRemoveFromPantalla}
                disabled={!isLiveOnPantalla}
                className="min-h-[52px] rounded-[12px] border border-[#2d3340] bg-[#111318] px-5 text-[17px] font-medium text-[#d4d8e0] transition-colors hover:border-[#3d4454] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
              >
                Quitar
              </button>
            </div>

            <p className="mt-3 text-[14px] leading-relaxed text-[#8a91a0]">
              Con la ruleta en pantalla, «Girar» la gira allí. Proyectar otra cosa, «Limpiar» o F8 la quitan.
            </p>
          </div>

          {/* Título en pantalla */}
          <div>
            <label
              htmlFor="ruleta-titulo-pantalla"
              className="mb-2 block text-[15px] font-medium text-[#d4d8e0]"
            >
              Título en pantalla (opcional)
            </label>
            <input
              id="ruleta-titulo-pantalla"
              type="text"
              value={config.tituloPantalla}
              onChange={(e) => updateConfig({ tituloPantalla: e.target.value })}
              placeholder="¿Quién dirige la oración?"
              className="min-h-[56px] w-full rounded-[12px] border border-[#2a2f3a] bg-[#0d0f14] p-[16px] text-[18px] text-white placeholder-[#555c6b] focus:border-[#F2A65A] focus:outline-none"
            />
          </div>

          {/* Fondo */}
          <div>
            <span className="mb-2.5 block text-[15px] font-semibold text-white">Fondo</span>
            <div className="grid grid-cols-3 gap-2.5">
              {PRESET_FONDOS.map((item) => {
                const selected = config.fondo === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateConfig({ fondo: item.id })}
                    className={`group relative h-[64px] overflow-hidden rounded-[10px] border text-center transition-all ${
                      selected
                        ? 'border-[#F2A65A] ring-2 ring-[#F2A65A]/45'
                        : 'border-[#2d3340] hover:border-[#4b5565]'
                    }`}
                  >
                    <RuletaFondoLayer fondo={item.id} compact />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent py-1 text-[13px] font-semibold text-white drop-shadow">
                      {item.label}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowFondoModal(true)}
                className={`relative flex h-[64px] items-center justify-center overflow-hidden rounded-[10px] border border-dashed px-2 text-center text-[13px] font-medium leading-tight transition-colors ${
                  config.fondo === 'personalizado'
                    ? 'border-[#F2A65A] bg-[#2a221b] text-[#F2A65A]'
                    : 'border-[#3a4150] bg-[#111318] text-[#b4bac6] hover:border-[#F2A65A]/70 hover:text-white'
                }`}
              >
                {config.fondo === 'personalizado' && config.fondoPersonalizado ? (
                  <>
                    <RuletaFondoLayer
                      fondo="personalizado"
                      personalizado={config.fondoPersonalizado}
                      compact
                    />
                    <span className="relative z-10 rounded bg-black/65 px-1.5 py-0.5 text-[12px] font-semibold text-white">
                      Personalizado
                    </span>
                  </>
                ) : (
                  <span>Elegir de Fondos...</span>
                )}
              </button>
            </div>
          </div>

          {/* Sonido */}
          <div>
            <label htmlFor="ruleta-sonido" className="sr-only">
              Sonido
            </label>
            <select
              id="ruleta-sonido"
              value={config.sonido}
              onChange={(e) => updateConfig({ sonido: e.target.value as SonidoRuleta })}
              className="min-h-[56px] w-full rounded-[12px] border border-[#2a2f3a] bg-[#0d0f14] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-none"
            >
              <option value="clasico">Sonido: Clásico</option>
              <option value="campana">Sonido: Campana</option>
              <option value="suave">Sonido: Suave</option>
              <option value="silencio">Sonido: Silencio</option>
            </select>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3.5">
            <label className="flex cursor-pointer items-start gap-3 text-[16px] text-[#e6e8ec]">
              <input
                type="checkbox"
                checked={config.confeti}
                onChange={(e) => updateConfig({ confeti: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 rounded border-[#3a4150] accent-[#F2A65A]"
              />
              <span>Confeti para quien sale.</span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 text-[16px] text-[#e6e8ec]">
              <input
                type="checkbox"
                checked={config.sinRepetir}
                onChange={(e) => updateConfig({ sinRepetir: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 rounded border-[#3a4150] accent-[#F2A65A]"
              />
              <span>
                <strong className="font-semibold text-white">Sin repetir</strong>: quien sale se quita de
                la ruleta en el siguiente giro.
              </span>
            </label>
          </div>

          {/* Fuera de la ruleta */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#262b36] bg-[#0d0f14] px-4 py-3.5">
            <span className="text-[15px] text-[#9ca3b0]">
              Fuera de la ruleta:{' '}
              <strong className="font-mono-tabular text-white">{listaActiva.excluidos.length}</strong>
            </span>
            <button
              type="button"
              onClick={handleRestoreAll}
              disabled={listaActiva.excluidos.length === 0 && !pendienteExcluir}
              className="text-[15px] font-semibold text-[#F2A65A] transition-colors hover:text-[#f7ba7b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Volver a poner a todos
            </button>
          </div>
        </aside>
      </div>

      {/* Delete list confirmation modal */}
      <ConfirmModal
        open={confirmDeleteList}
        title="Borrar lista"
        message={`¿Seguro que quieres borrar la lista «${listaActiva.nombre}» y todos sus nombres?`}
        confirmLabel="Borrar lista"
        onConfirm={handleDeleteList}
        onCancel={() => setConfirmDeleteList(false)}
      />

      {/* Custom background picker modal */}
      {showFondoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fondo-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="fondo-modal-title" className="text-[22px] font-bold text-white">
                Elegir fondo personalizado
              </h3>
              <button
                type="button"
                onClick={() => setShowFondoModal(false)}
                className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] text-[#8a91a0] hover:bg-[#252a34] hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <span className="mb-2.5 block text-[15px] font-medium text-[#d4d8e0]">
                  Color de fondo
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {COLOR_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => handleApplyCustomColor(hex)}
                      className={`h-10 w-10 rounded-full border-2 transition-transform hover:scale-105 ${
                        config.fondo === 'personalizado' &&
                        config.fondoPersonalizado?.tipo === 'color' &&
                        config.fondoPersonalizado.valor === hex
                          ? 'border-[#F2A65A]'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={`Color ${hex}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => handleApplyCustomColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-[#2a2f3a] bg-transparent p-0.5"
                    aria-label="Selector de color personalizado"
                  />
                </div>
              </div>

              <div className="border-t border-[#262b36] pt-5">
                <span className="mb-2.5 block text-[15px] font-medium text-[#d4d8e0]">
                  Imagen desde este equipo
                </span>
                <button
                  type="button"
                  onClick={() => fondoFileRef.current?.click()}
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[12px] border border-[#2d3340] bg-[#111318] px-5 text-[17px] font-medium text-white transition-colors hover:border-[#F2A65A]/70"
                >
                  <Upload className="h-5 w-5 text-[#F2A65A]" />
                  Subir imagen de fondo...
                </button>
                <input
                  ref={fondoFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFondoImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFondoModal(false)}
                className="min-h-[52px] rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] hover:bg-[#f5b473]"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import simpatizantes modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-simpatizantes-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="import-simpatizantes-title" className="text-[24px] font-bold text-white">
                Importar simpatizantes
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] text-[#8a91a0] hover:bg-[#252a34] hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter options */}
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportModo('hoy')}
                  className={`h-[46px] rounded-full border px-5 text-[16px] font-medium transition-colors whitespace-nowrap ${
                    importModo === 'hoy'
                      ? 'border-[#F2A65A] bg-[#F2A65A]/15 text-[#F2A65A]'
                      : 'border-[#2d3340] bg-[#111318] text-[#9ca3b0] hover:text-white'
                  }`}
                >
                  Solo los de hoy
                </button>
                <button
                  type="button"
                  onClick={() => setImportModo('fecha')}
                  className={`h-[46px] rounded-full border px-5 text-[16px] font-medium transition-colors whitespace-nowrap ${
                    importModo === 'fecha'
                      ? 'border-[#F2A65A] bg-[#F2A65A]/15 text-[#F2A65A]'
                      : 'border-[#2d3340] bg-[#111318] text-[#9ca3b0] hover:text-white'
                  }`}
                >
                  Los de una fecha
                </button>
                <button
                  type="button"
                  onClick={() => setImportModo('todos')}
                  className={`h-[46px] rounded-full border px-5 text-[16px] font-medium transition-colors whitespace-nowrap ${
                    importModo === 'todos'
                      ? 'border-[#F2A65A] bg-[#F2A65A]/15 text-[#F2A65A]'
                      : 'border-[#2d3340] bg-[#111318] text-[#9ca3b0] hover:text-white'
                  }`}
                >
                  Todos
                </button>
              </div>

              {importModo === 'fecha' && (
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="import-simpatizantes-fecha"
                    className="text-[15px] text-[#9ca3b0]"
                  >
                    Fecha de última visita:
                  </label>
                  <input
                    id="import-simpatizantes-fecha"
                    type="date"
                    value={importFecha}
                    onChange={(e) => setImportFecha(e.target.value)}
                    className="min-h-[48px] rounded-[12px] border border-[#2d3340] bg-[#0d0f14] px-4 text-[17px] text-white focus:border-[#F2A65A] focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Select all / counter bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#242832] pb-3">
              <button
                type="button"
                onClick={handleToggleAllImport}
                disabled={importFilteredSimpatizantes.length === 0}
                className="text-[15px] font-semibold text-[#F2A65A] transition-colors hover:text-[#f7ba7b] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importFilteredSimpatizantes.length > 0 &&
                importFilteredSimpatizantes.every((s) => selectedImportIds.has(s.id))
                  ? 'Quitar todos'
                  : 'Marcar todos'}
              </button>
              <span className="text-[15px] font-semibold text-white">
                {selectedImportNames.length} seleccionados
              </span>
            </div>

            {/* Checklist */}
            <div className="mt-3 min-h-[160px] flex-1 space-y-1.5 overflow-y-auto pr-1">
              {importFilteredSimpatizantes.length === 0 ? (
                <div className="flex h-full min-h-[150px] items-center justify-center rounded-xl border border-dashed border-[#2a2f3a] bg-[#111318] p-6 text-center text-[16px] text-[#8a91a0]">
                  No hay simpatizantes registrados para este filtro.
                </div>
              ) : (
                importFilteredSimpatizantes.map((s) => {
                  const checked = selectedImportIds.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border px-4 py-3 transition-colors ${
                        checked
                          ? 'border-[#F2A65A]/50 bg-[#252019]'
                          : 'border-[#242832] bg-[#111318] hover:border-[#343a48]'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleOneImport(s.id)}
                          className="h-5 w-5 shrink-0 rounded border-[#3a4150] accent-[#F2A65A]"
                        />
                        <span className="truncate text-[17px] font-medium text-white">
                          {s.nombre}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono-tabular text-[14px] text-[#8a91a0]">
                        {formatFechaMedia(s.ultimaVisita)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* 120 names limit warning */}
            {(importExceedsLimitForAppend || importExceedsLimitForNew) && (
              <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[15px] text-amber-200">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <span>
                  {importExceedsLimitForNew
                    ? `Has seleccionado ${selectedImportNames.length} nombres y el límite es de ${MAX_NOMBRES_RULETA} por lista. Al importar se incluirán los primeros ${MAX_NOMBRES_RULETA}.`
                    : `Esta lista junto con los seleccionados suma ${mergedWithCurrentNames.length} nombres y el límite es de ${MAX_NOMBRES_RULETA} por lista. Al añadir se incluirán hasta ${MAX_NOMBRES_RULETA}.`}
                </span>
              </div>
            )}

            {/* Footer actions or New List name step */}
            {creatingFromImport ? (
              <form onSubmit={handleImportCreateNewList} className="mt-5 space-y-3 border-t border-[#242832] pt-4">
                <div>
                  <label
                    htmlFor="import-new-list-name"
                    className="mb-1.5 block text-[15px] font-medium text-[#d4d8e0]"
                  >
                    Nombre de la nueva lista
                  </label>
                  <input
                    id="import-new-list-name"
                    type="text"
                    value={importNewListName}
                    onChange={(e) => {
                      setImportNewListName(e.target.value);
                      setImportNameError(null);
                    }}
                    placeholder="Ej. Rifa evangelismo"
                    autoFocus
                    className="min-h-[52px] w-full rounded-[12px] border border-[#2a2f3a] bg-[#0d0f14] px-4 text-[17px] text-white placeholder-[#555c6b] focus:border-[#F2A65A] focus:outline-none"
                  />
                  {importNameError && (
                    <p className="mt-1.5 text-[14px] text-red-400">{importNameError}</p>
                  )}
                  <p className="mt-1.5 text-[14px] text-[#9ca3b0]">
                    Se activará automáticamente la casilla «Sin repetir».
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingFromImport(false);
                      setImportNameError(null);
                    }}
                    className="min-h-[52px] rounded-[12px] border border-[#2d3340] bg-[#222630] px-6 text-[17px] font-medium text-[#d4d8e0] hover:text-white"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={selectedImportNames.length === 0}
                    className="min-h-[52px] rounded-[12px] bg-[#F2A65A] px-6 text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Crear lista nueva
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 flex flex-col gap-3 border-t border-[#242832] pt-4 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  disabled={selectedImportNames.length === 0}
                  onClick={handleImportAddToCurrent}
                  className="min-h-[52px] w-full rounded-[12px] border border-[#F2A65A] bg-[#111318] px-6 text-[17px] font-semibold text-[#F2A65A] transition-colors hover:bg-[#F2A65A]/15 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                >
                  Añadir a esta lista
                </button>
                <button
                  type="button"
                  disabled={selectedImportNames.length === 0}
                  onClick={() => {
                    setCreatingFromImport(true);
                    setImportNameError(null);
                  }}
                  className="min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-6 text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                >
                  Crear lista nueva
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
