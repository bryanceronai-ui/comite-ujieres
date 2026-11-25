import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Maximize2 } from 'lucide-react';
import {
  AjustesPantalla,
  ConfigRuleta,
  MiembroComite,
  PantallaRuletaState,
  RegistroAsistencia,
  Simpatizante,
  TarjetaPendiente,
  TurnoComite,
  VistaActiva,
} from './types';
import {
  broadcastAjustesPantalla,
  broadcastPantallaSync,
  DEFAULT_AJUSTES_PANTALLA,
  DEFAULT_CONFIG_RULETA,
  DEFAULT_PUESTOS_COMITE,
  DEFAULT_ROTULOS_GRUPOS,
  DEFAULT_TIPOS_CULTO,
  loadAllData,
  loadPantallaActual,
  loadPantallaRuleta,
  loadRuletaConfig,
  PANTALLA_CHANNEL_NAME,
  PantallaSyncMessage,
  safeWrite,
  saveRuletaConfig,
  sendRuletaToPantalla,
  sendToPantalla,
  STORAGE_KEYS,
  validateAndImportCopia,
} from './utils/storage';
import { HomeView } from './components/HomeView';
import { RegistroView } from './components/RegistroView';
import { GraficosView } from './components/GraficosView';
import { SimpatizantesView } from './components/SimpatizantesView';
import { TurnosView } from './components/TurnosView';
import { RuletaView } from './components/RuletaView';
import { MobileAsistenteView } from './components/MobileAsistenteView';
import { PantallaView } from './components/PantallaView';
import { ConfirmModal } from './components/ConfirmModal';

const VISTA_LABELS: Record<Exclude<VistaActiva, 'inicio'>, string> = {
  registro: 'Registro por reunión',
  graficos: 'Gráficos',
  simpatizantes: 'Simpatizantes',
  turnos: 'Turnos del comité',
  ruleta: 'Ruleta',
  movil: 'Añadir asistente (móvil)',
};

export default function App() {
  const [isPantallaRoute, setIsPantallaRoute] = useState<boolean>(
    () => window.location.hash === '#pantalla'
  );
  const [inlinePantallaPreview, setInlinePantallaPreview] = useState(false);

  const [vista, setVista] = useState<VistaActiva>('inicio');
  const initialData = useRef(loadAllData()).current;

  const [registros, setRegistros] = useState<RegistroAsistencia[]>(initialData.registros);
  const [tiposCulto, setTiposCulto] = useState<string[]>(initialData.tiposCulto);
  const [rotulosGrupos, setRotulosGrupos] = useState<string[]>(initialData.rotulosGrupos);
  const [ajustesPantalla, setAjustesPantalla] = useState<AjustesPantalla>(
    initialData.ajustesPantalla
  );
  const [simpatizantes, setSimpatizantes] = useState<Simpatizante[]>(initialData.simpatizantes);
  const [tarjetasPendientes, setTarjetasPendientes] = useState<TarjetaPendiente[]>(
    initialData.tarjetasPendientes
  );
  const [miembrosComite, setMiembrosComite] = useState<MiembroComite[]>(
    initialData.miembrosComite
  );
  const [turnosComite, setTurnosComite] = useState<TurnoComite[]>(initialData.turnosComite);
  const [puestosComite, setPuestosComite] = useState<string[]>(initialData.puestosComite);
  const [configRuleta, setConfigRuleta] = useState<ConfigRuleta>(initialData.ruleta);
  const [ejemploCargado, setEjemploCargado] = useState<boolean>(initialData.ejemploCargado);
  const [pantallaActual, setPantallaActual] = useState<RegistroAsistencia | null>(() =>
    loadPantallaActual()
  );
  const [pantallaRuleta, setPantallaRuleta] = useState<PantallaRuletaState | null>(() =>
    loadPantallaRuleta()
  );

  const [showDeleteSampleConfirm, setShowDeleteSampleConfirm] = useState(false);
  const [pantallaBanner, setPantallaBanner] = useState(false);
  const pantallaLinkRef = useRef<HTMLAnchorElement>(null);

  // Hash route listener for #pantalla
  useEffect(() => {
    const onHashChange = () => {
      setIsPantallaRoute(window.location.hash === '#pantalla');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Cross-tab sync for pending cards & projector state + F8 shortcut
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.TARJETAS_PENDIENTES) {
        setTarjetasPendientes(loadAllData().tarjetasPendientes);
      }
      if (e.key === STORAGE_KEYS.PANTALLA_ACTUAL) {
        setPantallaActual(loadPantallaActual());
      }
      if (e.key === STORAGE_KEYS.AJUSTES_PANTALLA) {
        setAjustesPantalla(loadAllData().ajustesPantalla);
      }
      if (e.key === STORAGE_KEYS.PANTALLA_RULETA) {
        setPantallaRuleta(loadPantallaRuleta());
      }
      if (e.key === STORAGE_KEYS.RULETA) {
        setConfigRuleta(loadRuletaConfig());
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        setPantallaRuleta(null);
        sendRuletaToPantalla(null);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('keydown', handleKeyDown);

    let ch: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(PANTALLA_CHANNEL_NAME);
      ch.onmessage = (event: MessageEvent<PantallaSyncMessage>) => {
        if (event.data?.type === 'TARJETAS_ACTUALIZADAS') {
          setTarjetasPendientes(event.data.payload);
        } else if (event.data?.type === 'PANTALLA_REGISTRO') {
          setPantallaActual(event.data.payload);
        } else if (event.data?.type === 'PANTALLA_RULETA') {
          setPantallaRuleta(event.data.payload);
        }
      };
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('keydown', handleKeyDown);
      ch?.close();
    };
  }, []);

  // Persistent save wrappers
  const saveRegistros = (next: RegistroAsistencia[]) => {
    setRegistros(next);
    safeWrite(STORAGE_KEYS.REGISTROS, next);
  };

  const saveTiposCulto = (next: string[]) => {
    setTiposCulto(next);
    safeWrite(STORAGE_KEYS.TIPOS_CULTO, next);
  };

  const saveRotulosGrupos = (next: string[]) => {
    setRotulosGrupos(next);
    safeWrite(STORAGE_KEYS.ROTULOS_GRUPOS, next);
  };

  const saveAjustesPantalla = (next: AjustesPantalla) => {
    setAjustesPantalla(next);
    broadcastAjustesPantalla(next);
  };

  const saveSimpatizantes = (next: Simpatizante[]) => {
    setSimpatizantes(next);
    safeWrite(STORAGE_KEYS.SIMPATIZANTES, next);
  };

  const saveTarjetasPendientes = (next: TarjetaPendiente[]) => {
    setTarjetasPendientes(next);
    safeWrite(STORAGE_KEYS.TARJETAS_PENDIENTES, next);
    broadcastPantallaSync({ type: 'TARJETAS_ACTUALIZADAS', payload: next });
  };

  const saveMiembrosComite = (next: MiembroComite[]) => {
    setMiembrosComite(next);
    safeWrite(STORAGE_KEYS.MIEMBROS_COMITE, next);
  };

  const saveTurnosComite = (next: TurnoComite[]) => {
    setTurnosComite(next);
    safeWrite(STORAGE_KEYS.TURNOS_COMITE, next);
  };

  const savePuestosComite = (next: string[]) => {
    setPuestosComite(next);
    safeWrite(STORAGE_KEYS.PUESTOS_COMITE, next);
  };

  const handleSaveConfigRuleta = (next: ConfigRuleta) => {
    setConfigRuleta(next);
    saveRuletaConfig(next);
  };

  const handleSendToPantalla = (reg: RegistroAsistencia | null) => {
    setPantallaActual(reg);
    if (reg !== null) {
      setPantallaRuleta(null);
    }
    sendToPantalla(reg);
    if (reg) {
      setPantallaBanner(true);
      setTimeout(() => setPantallaBanner(false), 6000);
    }
  };

  const handleSendRuletaToPantalla = (state: PantallaRuletaState | null) => {
    const wasActive = Boolean(pantallaRuleta?.activa);
    setPantallaRuleta(state);
    sendRuletaToPantalla(state);
    if (state?.activa && !wasActive) {
      setPantallaBanner(true);
      setTimeout(() => setPantallaBanner(false), 6000);
    }
  };

  const handleOpenPantallaWindow = () => {
    pantallaLinkRef.current?.click();
    setPantallaBanner(true);
    setTimeout(() => setPantallaBanner(false), 6000);
  };

  const handleImportBackup = (rawJson: string) => {
    const next = validateAndImportCopia(rawJson);
    setRegistros(next.registros);
    setTiposCulto(next.tiposCulto);
    setRotulosGrupos(next.rotulosGrupos);
    setAjustesPantalla(next.ajustesPantalla);
    setSimpatizantes(next.simpatizantes);
    setTarjetasPendientes(next.tarjetasPendientes);
    setMiembrosComite(next.miembrosComite);
    setTurnosComite(next.turnosComite);
    setPuestosComite(next.puestosComite || DEFAULT_PUESTOS_COMITE);
    if (next.ruleta) {
      setConfigRuleta(next.ruleta);
    }
    setEjemploCargado(false);
  };

  const handleConfirmDeleteSampleData = () => {
    saveRegistros([]);
    saveSimpatizantes([]);
    saveTarjetasPendientes([]);
    saveMiembrosComite([]);
    saveTurnosComite([]);
    saveTiposCulto(DEFAULT_TIPOS_CULTO);
    saveRotulosGrupos(DEFAULT_ROTULOS_GRUPOS);
    savePuestosComite(DEFAULT_PUESTOS_COMITE);
    saveAjustesPantalla(DEFAULT_AJUSTES_PANTALLA);
    handleSaveConfigRuleta({
      ...DEFAULT_CONFIG_RULETA,
      listas: [{ id: 'lista_hermanos', nombre: 'Hermanos', nombresTexto: '', excluidos: [] }],
    });
    handleSendToPantalla(null);
    handleSendRuletaToPantalla(null);
    setEjemploCargado(false);
    safeWrite(STORAGE_KEYS.EJEMPLO_CARGADO, false);
    setShowDeleteSampleConfirm(false);
  };

  // Dedicated #pantalla route
  if (isPantallaRoute) {
    return <PantallaView />;
  }

  // In-app fullscreen projector preview fallback
  if (inlinePantallaPreview) {
    return <PantallaView onExit={() => setInlinePantallaPreview(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#0d0f14] text-[#e6e8ec]">
      {/* Hidden anchor for opening/focusing #pantalla window cleanly */}
      <a
        ref={pantallaLinkRef}
        href="#pantalla"
        target="ipue_pantalla"
        rel="noopener noreferrer"
        className="hidden"
        aria-hidden="true"
      >
        Pantalla
      </a>

      {/* Breadcrumb Top Bar when inside a module */}
      {vista !== 'inicio' && (
        <header className="border-b border-[#1c2029] bg-[#0d0f14]/95">
          <div
            className={`mx-auto flex min-h-[84px] w-full max-w-[1900px] flex-col justify-center ${
              pantallaBanner ? 'gap-3' : 'gap-0'
            } px-[24px] py-2.5 md:flex-row md:items-center md:justify-between md:gap-4`}
          >
            <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-2.5 text-[17px] sm:gap-3">
              <button
                type="button"
                onClick={() => setVista('inicio')}
                aria-label="Volver al inicio"
                className="inline-flex shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#F2A65A]"
              >
                <img
                  src="/assets/aistudio/Color-Borde-blanco_fcabe59b.png"
                  alt="Logo IPUE Barakaldo"
                  className="h-[52px] w-[52px] shrink-0 object-contain md:h-[64px] md:w-[64px]"
                />
              </button>
              <button
                type="button"
                onClick={() => setVista('inicio')}
                aria-label="Volver a las opciones principales"
                className="inline-flex min-h-[52px] touch-manipulation items-center gap-2.5 rounded-[12px] border border-[#2d3340] bg-[#1a1d24] px-4 py-2 text-[17px] font-semibold text-[#e6e8ec] transition-all hover:border-[#F2A65A]/60 hover:bg-[#222630] hover:text-white active:scale-95"
              >
                <ArrowLeft className="h-7 w-7 shrink-0 stroke-[2.5] text-[#F2A65A]" />
                <span>Comité de Ujieres</span>
              </button>
              <span className="text-[#555c6b]" aria-hidden="true">
                ›
              </span>
              <span className="font-semibold text-white">{VISTA_LABELS[vista]}</span>
            </nav>

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-5">
              {pantallaBanner && (
                <div className="flex flex-col gap-2 text-[15px] md:flex-row md:items-center">
                  <span className="hidden text-[#9ca3b0] md:inline">Proyector actualizado:</span>
                  <a
                    href="#pantalla"
                    target="ipue_pantalla"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#F2A65A]/50 bg-[#F2A65A]/10 px-5 font-medium text-[#F2A65A] hover:bg-[#F2A65A]/20 md:w-auto"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ventana #pantalla
                  </a>
                  <button
                    type="button"
                    onClick={() => setInlinePantallaPreview(true)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#2d3340] bg-[#1a1d24] px-5 font-medium text-[#d4d8e0] hover:text-white md:w-auto"
                  >
                    <Maximize2 className="h-4 w-4" />
                    Ver aquí
                  </button>
                </div>
              )}
              <span className="hidden whitespace-nowrap text-[14px] font-normal text-[#6b7280] no-underline transition-colors hover:text-[#9ca3af] md:inline">
                ‹ Creado por: Bryan Ceron
              </span>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main>
        {vista === 'inicio' && (
          <HomeView
            onNavigate={setVista}
            turnos={turnosComite}
            miembros={miembrosComite}
            pendientesCount={tarjetasPendientes.length}
            ejemploCargado={ejemploCargado}
            onImportBackup={handleImportBackup}
            onDeleteSampleData={() => setShowDeleteSampleConfirm(true)}
          />
        )}

        {vista === 'registro' && (
          <RegistroView
            registros={registros}
            tiposCulto={tiposCulto}
            rotulosGrupos={rotulosGrupos}
            ajustesPantalla={ajustesPantalla}
            pantallaActual={pantallaActual}
            onSaveRegistros={saveRegistros}
            onSaveTiposCulto={saveTiposCulto}
            onSaveRotulosGrupos={saveRotulosGrupos}
            onSaveAjustesPantalla={saveAjustesPantalla}
            onSendToPantalla={handleSendToPantalla}
            onOpenPantallaWindow={handleOpenPantallaWindow}
          />
        )}

        {vista === 'graficos' && (
          <GraficosView
            registros={registros}
            tiposCulto={tiposCulto}
            onGoRegistro={() => setVista('registro')}
          />
        )}

        {vista === 'simpatizantes' && (
          <SimpatizantesView
            simpatizantes={simpatizantes}
            tarjetasPendientes={tarjetasPendientes}
            onSaveSimpatizantes={saveSimpatizantes}
            onSaveTarjetasPendientes={saveTarjetasPendientes}
          />
        )}

        {vista === 'turnos' && (
          <TurnosView
            miembros={miembrosComite}
            turnos={turnosComite}
            tiposCulto={tiposCulto}
            puestosComite={puestosComite}
            onSaveMiembros={saveMiembrosComite}
            onSaveTurnos={saveTurnosComite}
            onSaveTiposCulto={saveTiposCulto}
            onSavePuestosComite={savePuestosComite}
          />
        )}

        {vista === 'ruleta' && (
          <RuletaView
            config={configRuleta}
            simpatizantes={simpatizantes}
            pantallaRuleta={pantallaRuleta}
            onSaveConfig={handleSaveConfigRuleta}
            onSendRuletaToPantalla={handleSendRuletaToPantalla}
          />
        )}

        {vista === 'movil' && (
          <MobileAsistenteView
            pendientesCount={tarjetasPendientes.length}
            onAddTarjeta={(tarjeta) =>
              saveTarjetasPendientes([tarjeta, ...tarjetasPendientes])
            }
            onGoSimpatizantes={() => setVista('simpatizantes')}
          />
        )}
      </main>

      <ConfirmModal
        open={showDeleteSampleConfirm}
        title="Borrar datos de ejemplo"
        message="¿Seguro que quieres borrar todos los datos de ejemplo (registros, simpatizantes, tarjetas pendientes, miembros y turnos) para empezar desde cero? Los tipos de culto y rótulos de grupos se mantendrán."
        confirmLabel="Borrar datos de ejemplo"
        onConfirm={handleConfirmDeleteSampleData}
        onCancel={() => setShowDeleteSampleConfirm(false)}
      />
    </div>
  );
}
