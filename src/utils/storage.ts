import {
  AjustesPantalla,
  ConfigEmailAsistencia,
  ConfigRuleta,
  CopiaSeguridad,
  MiembroComite,
  PantallaRuletaState,
  RegistroAsistencia,
  Simpatizante,
  TarjetaPendiente,
  TurnoComite,
} from '../types';
import { addDaysISO, getTodayMadridISO } from './dates';

export const STORAGE_KEYS = {
  REGISTROS: 'ipue_registros',
  TIPOS_CULTO: 'ipue_tipos_culto',
  ROTULOS_GRUPOS: 'ipue_rotulos_grupos',
  AJUSTES_PANTALLA: 'ipue_ajustes_pantalla',
  SIMPATIZANTES: 'ipue_simpatizantes',
  TARJETAS_PENDIENTES: 'ipue_tarjetas_pendientes',
  MIEMBROS_COMITE: 'ipue_miembros_comite',
  TURNOS_COMITE: 'ipue_turnos_comite',
  PUESTOS_COMITE: 'ipue_puestos_comite',
  PANTALLA_ACTUAL: 'ipue_pantalla_actual',
  RULETA: 'ipue_ruleta',
  PANTALLA_RULETA: 'ipue_pantalla_ruleta',
  EJEMPLO_CARGADO: 'ipue_ejemplo_cargado',
  EMAIL_ASISTENCIA: 'ipue_email_asistencia',
} as const;

export const DEFAULT_TIPOS_CULTO: string[] = [
  'Sin especificar',
  'Culto de jóvenes',
  'Culto de damas Dorcas',
  'Culto de escuela dominical',
  'Culto de obra social',
  'Culto de evangelismo',
  'Culto de oración y enseñanza',
];

export const DEFAULT_ROTULOS_GRUPOS: string[] = ['Hermanos', 'Niños', 'Amigos'];

export const DEFAULT_PUESTOS_COMITE: string[] = [
  'Puerta principal',
  'Pasillo central',
  'Ofrenda',
  'Bienvenida',
  'Altar / Plataforma',
];

export const DEFAULT_AJUSTES_PANTALLA: AjustesPantalla = {
  modoGrupos: 'cada-grupo',
  tamanoTexto: 85,
  colorTotal: '#FFD84D',
  colorCulto: '#FFFFFF',
  letraCulto: 'Georgia',
  cursivaCulto: true,
  acompanarCon: 'ninguno',
  distanciaInferior: 65,
};

export const DEFAULT_CONFIG_RULETA: ConfigRuleta = {
  listas: [
    {
      id: 'lista_hermanos',
      nombre: 'Hermanos',
      nombresTexto: 'Samuel Paredes\nElena Morales\nDaniel Ortiz\nRebeca Vargas\nJoel Navarro',
      excluidos: [],
    },
  ],
  listaActivaId: 'lista_hermanos',
  tituloPantalla: '',
  fondo: 'estrellas',
  fondoPersonalizado: { tipo: 'color', valor: '#0c1c47' },
  sonido: 'clasico',
  confeti: true,
  sinRepetir: false,
};

export const PANTALLA_CHANNEL_NAME = 'ipue_barakaldo_pantalla_sync';

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeWrite<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function ensureInitialData(): void {
  const yaInicializado =
    localStorage.getItem(STORAGE_KEYS.REGISTROS) !== null ||
    localStorage.getItem(STORAGE_KEYS.SIMPATIZANTES) !== null ||
    localStorage.getItem(STORAGE_KEYS.MIEMBROS_COMITE) !== null ||
    localStorage.getItem(STORAGE_KEYS.EJEMPLO_CARGADO) !== null;

  if (yaInicializado) {
    // Ensure config keys exist
    if (localStorage.getItem(STORAGE_KEYS.TIPOS_CULTO) === null) {
      safeWrite(STORAGE_KEYS.TIPOS_CULTO, DEFAULT_TIPOS_CULTO);
    }
    if (localStorage.getItem(STORAGE_KEYS.ROTULOS_GRUPOS) === null) {
      safeWrite(STORAGE_KEYS.ROTULOS_GRUPOS, DEFAULT_ROTULOS_GRUPOS);
    }
    if (localStorage.getItem(STORAGE_KEYS.AJUSTES_PANTALLA) === null) {
      safeWrite(STORAGE_KEYS.AJUSTES_PANTALLA, DEFAULT_AJUSTES_PANTALLA);
    }
    if (localStorage.getItem(STORAGE_KEYS.PUESTOS_COMITE) === null) {
      safeWrite(STORAGE_KEYS.PUESTOS_COMITE, DEFAULT_PUESTOS_COMITE);
    }
    if (localStorage.getItem(STORAGE_KEYS.RULETA) === null) {
      safeWrite(STORAGE_KEYS.RULETA, DEFAULT_CONFIG_RULETA);
    }
    return;
  }

  const hoy = getTodayMadridISO();

  const sampleRegistros: RegistroAsistencia[] = [
    {
      id: 'ej_reg_1',
      fecha: hoy,
      modo: 'simple',
      total: 180,
      tipoCulto: 'Culto de damas Dorcas',
      nota: 'Hna. Marta predicó · Tema: Mujeres de fe',
      creadoEn: new Date().toISOString(),
    },
    {
      id: 'ej_reg_2',
      fecha: addDaysISO(hoy, -2),
      modo: 'grupos',
      total: 138,
      grupos: { Hermanos: 100, Niños: 30, Amigos: 8 },
      tipoCulto: 'Culto de jóvenes',
      nota: 'Dirigió David · Alabanza juvenil',
      creadoEn: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'ej_reg_3',
      fecha: addDaysISO(hoy, -6),
      modo: 'grupos',
      total: 164,
      grupos: { Hermanos: 122, Niños: 28, Amigos: 14 },
      tipoCulto: 'Culto de escuela dominical',
      nota: 'Pastor Carlos · Estudio bíblico',
      creadoEn: new Date(Date.now() - 86400000 * 6).toISOString(),
    },
    {
      id: 'ej_reg_4',
      fecha: addDaysISO(hoy, -9),
      modo: 'grupos',
      total: 96,
      grupos: { Hermanos: 78, Niños: 14, Amigos: 4 },
      tipoCulto: 'Culto de oración y enseñanza',
      creadoEn: new Date(Date.now() - 86400000 * 9).toISOString(),
    },
    {
      id: 'ej_reg_5',
      fecha: addDaysISO(hoy, -13),
      modo: 'grupos',
      total: 152,
      grupos: { Hermanos: 112, Niños: 29, Amigos: 11 },
      tipoCulto: 'Culto de evangelismo',
      nota: 'Noche misionera Barakaldo',
      creadoEn: new Date(Date.now() - 86400000 * 13).toISOString(),
    },
  ];

  const sampleSimpatizantes: Simpatizante[] = [
    {
      id: 'ej_sim_1',
      nombre: 'Laura Echevarría',
      direccion: 'Barakaldo centro (Av. Libertad)',
      telefono: '645 128 390',
      nota: 'Invitada por Hna. Sofía',
      visitas: 2,
      ultimaVisita: hoy,
    },
    {
      id: 'ej_sim_2',
      nombre: 'Mateo Salgado',
      direccion: 'Cruces, Barakaldo',
      telefono: '688 410 219',
      nota: 'Primera visita en culto de jóvenes',
      visitas: 1,
      ultimaVisita: addDaysISO(hoy, -2),
    },
    {
      id: 'ej_sim_3',
      nombre: 'Carmen Ruiz',
      direccion: 'Sestao',
      telefono: '622 904 115',
      visitas: 4,
      ultimaVisita: addDaysISO(hoy, -6),
    },
  ];

  const sampleTarjetas: TarjetaPendiente[] = [
    {
      id: 'ej_tar_1',
      nombre: 'Andrés Mendizábal',
      direccion: 'San Vicente, Barakaldo',
      telefono: '639 771 042',
      nota: 'Llegó con su familia, pide visita pastoral',
      fecha: hoy,
      creadoEn: new Date().toISOString(),
    },
  ];

  const sampleMiembros: MiembroComite[] = [
    { id: 'ej_uj_1', nombre: 'Samuel Paredes', telefono: '611 203 401', nota: 'Coordinador', activo: true },
    { id: 'ej_uj_2', nombre: 'Elena Morales', telefono: '622 548 910', activo: true },
    { id: 'ej_uj_3', nombre: 'Daniel Ortiz', telefono: '633 891 024', activo: true },
    { id: 'ej_uj_4', nombre: 'Rebeca Vargas', telefono: '644 312 678', activo: true },
    { id: 'ej_uj_5', nombre: 'Joel Navarro', telefono: '655 740 129', nota: 'Disponible fines de semana', activo: true },
    { id: 'ej_uj_6', nombre: 'Miriam Castro', telefono: '666 195 832', activo: false },
  ];

  const sampleTurnos: TurnoComite[] = [
    {
      id: 'ej_tur_1',
      fecha: hoy,
      tipoCulto: 'Culto de damas Dorcas',
      ujierIds: ['ej_uj_1', 'ej_uj_2'],
      puesto: 'Puerta principal',
      nota: 'Llegar 20 min antes',
    },
    {
      id: 'ej_tur_2',
      fecha: addDaysISO(hoy, 1),
      tipoCulto: 'Culto de escuela dominical',
      ujierIds: ['ej_uj_3', 'ej_uj_4'],
      puesto: 'Bienvenida',
    },
    {
      id: 'ej_tur_3',
      fecha: addDaysISO(hoy, 4),
      tipoCulto: 'Culto de oración y enseñanza',
      ujierIds: ['ej_uj_5', 'ej_uj_1'],
      puesto: 'Pasillo central',
    },
    {
      id: 'ej_tur_4',
      fecha: addDaysISO(hoy, -2),
      tipoCulto: 'Culto de jóvenes',
      ujierIds: ['ej_uj_2', 'ej_uj_5'],
      puesto: 'Puerta principal',
    },
    {
      id: 'ej_tur_5',
      fecha: addDaysISO(hoy, -6),
      tipoCulto: 'Culto de escuela dominical',
      ujierIds: ['ej_uj_3', 'ej_uj_1'],
      puesto: 'Ofrenda',
    },
  ];

  safeWrite(STORAGE_KEYS.TIPOS_CULTO, DEFAULT_TIPOS_CULTO);
  safeWrite(STORAGE_KEYS.ROTULOS_GRUPOS, DEFAULT_ROTULOS_GRUPOS);
  safeWrite(STORAGE_KEYS.AJUSTES_PANTALLA, DEFAULT_AJUSTES_PANTALLA);
  safeWrite(STORAGE_KEYS.PUESTOS_COMITE, DEFAULT_PUESTOS_COMITE);
  safeWrite(STORAGE_KEYS.REGISTROS, sampleRegistros);
  safeWrite(STORAGE_KEYS.SIMPATIZANTES, sampleSimpatizantes);
  safeWrite(STORAGE_KEYS.TARJETAS_PENDIENTES, sampleTarjetas);
  safeWrite(STORAGE_KEYS.MIEMBROS_COMITE, sampleMiembros);
  safeWrite(STORAGE_KEYS.TURNOS_COMITE, sampleTurnos);
  safeWrite(STORAGE_KEYS.RULETA, DEFAULT_CONFIG_RULETA);
  safeWrite(STORAGE_KEYS.EJEMPLO_CARGADO, true);
}

export function loadAllData() {
  ensureInitialData();
  return {
    registros: safeRead<RegistroAsistencia[]>(STORAGE_KEYS.REGISTROS, []),
    tiposCulto: safeRead<string[]>(STORAGE_KEYS.TIPOS_CULTO, DEFAULT_TIPOS_CULTO),
    rotulosGrupos: safeRead<string[]>(STORAGE_KEYS.ROTULOS_GRUPOS, DEFAULT_ROTULOS_GRUPOS),
    ajustesPantalla: {
      ...DEFAULT_AJUSTES_PANTALLA,
      ...safeRead<Partial<AjustesPantalla>>(STORAGE_KEYS.AJUSTES_PANTALLA, {}),
    },
    simpatizantes: safeRead<Simpatizante[]>(STORAGE_KEYS.SIMPATIZANTES, []),
    tarjetasPendientes: safeRead<TarjetaPendiente[]>(STORAGE_KEYS.TARJETAS_PENDIENTES, []),
    miembrosComite: safeRead<MiembroComite[]>(STORAGE_KEYS.MIEMBROS_COMITE, []),
    turnosComite: safeRead<TurnoComite[]>(STORAGE_KEYS.TURNOS_COMITE, []),
    puestosComite: safeRead<string[]>(STORAGE_KEYS.PUESTOS_COMITE, DEFAULT_PUESTOS_COMITE),
    ruleta: loadRuletaConfig(),
    ejemploCargado: safeRead<boolean>(STORAGE_KEYS.EJEMPLO_CARGADO, false),
  };
}

export function loadRuletaConfig(): ConfigRuleta {
  const saved = safeRead<Partial<ConfigRuleta> | null>(STORAGE_KEYS.RULETA, null);
  if (!saved || !Array.isArray(saved.listas) || saved.listas.length === 0) {
    return DEFAULT_CONFIG_RULETA;
  }
  const listas = saved.listas.map((l) => ({
    id: l.id || generateId('lista'),
    nombre: l.nombre || 'Lista',
    nombresTexto: typeof l.nombresTexto === 'string' ? l.nombresTexto : '',
    excluidos: Array.isArray(l.excluidos) ? l.excluidos : [],
  }));
  const listaActivaId = listas.some((l) => l.id === saved.listaActivaId)
    ? (saved.listaActivaId as string)
    : listas[0].id;
  return {
    ...DEFAULT_CONFIG_RULETA,
    ...saved,
    listas,
    listaActivaId,
  };
}

export function saveRuletaConfig(config: ConfigRuleta): void {
  safeWrite(STORAGE_KEYS.RULETA, config);
}

export const DEFAULT_CONFIG_EMAIL_ASISTENCIA: ConfigEmailAsistencia = {
  destinoEmail: '',
  autoEnviar: true,
};

export function loadConfigEmailAsistencia(): ConfigEmailAsistencia {
  const saved = safeRead<Partial<ConfigEmailAsistencia> | null>(STORAGE_KEYS.EMAIL_ASISTENCIA, null);
  if (!saved || typeof saved !== 'object') {
    return DEFAULT_CONFIG_EMAIL_ASISTENCIA;
  }
  return {
    destinoEmail: typeof saved.destinoEmail === 'string' ? saved.destinoEmail : '',
    autoEnviar: typeof saved.autoEnviar === 'boolean' ? saved.autoEnviar : true,
  };
}

export function saveConfigEmailAsistencia(config: ConfigEmailAsistencia): void {
  safeWrite(STORAGE_KEYS.EMAIL_ASISTENCIA, config);
}

export function loadPantallaActual(): RegistroAsistencia | null {
  return safeRead<RegistroAsistencia | null>(STORAGE_KEYS.PANTALLA_ACTUAL, null);
}

export function loadPantallaRuleta(): PantallaRuletaState | null {
  return safeRead<PantallaRuletaState | null>(STORAGE_KEYS.PANTALLA_RULETA, null);
}

export function sendToPantalla(registro: RegistroAsistencia | null): void {
  safeWrite(STORAGE_KEYS.PANTALLA_ACTUAL, registro);
  broadcastPantallaSync({ type: 'PANTALLA_REGISTRO', payload: registro });
  if (registro !== null) {
    safeWrite(STORAGE_KEYS.PANTALLA_RULETA, null);
    broadcastPantallaSync({ type: 'PANTALLA_RULETA', payload: null });
  }
}

export function sendRuletaToPantalla(state: PantallaRuletaState | null): void {
  safeWrite(STORAGE_KEYS.PANTALLA_RULETA, state);
  broadcastPantallaSync({ type: 'PANTALLA_RULETA', payload: state });
}

export function broadcastAjustesPantalla(ajustes: AjustesPantalla): void {
  safeWrite(STORAGE_KEYS.AJUSTES_PANTALLA, ajustes);
  broadcastPantallaSync({ type: 'PANTALLA_AJUSTES', payload: ajustes });
}

export type PantallaSyncMessage =
  | { type: 'PANTALLA_REGISTRO'; payload: RegistroAsistencia | null }
  | { type: 'PANTALLA_AJUSTES'; payload: AjustesPantalla }
  | { type: 'PANTALLA_RULETA'; payload: PantallaRuletaState | null }
  | { type: 'TARJETAS_ACTUALIZADAS'; payload: TarjetaPendiente[] };

export function broadcastPantallaSync(message: PantallaSyncMessage): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(PANTALLA_CHANNEL_NAME);
      ch.postMessage(message);
      ch.close();
    }
  } catch {
    // BroadcastChannel unavailable in restricted contexts
  }
}

export function buildCopiaJSON(): string {
  const data = loadAllData();
  const backup: CopiaSeguridad = {
    version: 1,
    exportadoEn: new Date().toISOString(),
    registros: data.registros,
    tiposCulto: data.tiposCulto,
    rotulosGrupos: data.rotulosGrupos,
    ajustesPantalla: data.ajustesPantalla,
    simpatizantes: data.simpatizantes,
    tarjetasPendientes: data.tarjetasPendientes,
    miembrosComite: data.miembrosComite,
    turnosComite: data.turnosComite,
    puestosComite: data.puestosComite,
    ruleta: data.ruleta,
  };
  return JSON.stringify(backup, null, 2);
}

export function validateAndImportCopia(rawJson: string): CopiaSeguridad {
  const parsed = JSON.parse(rawJson) as Partial<CopiaSeguridad>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('El archivo no tiene un formato JSON válido.');
  }
  if (!Array.isArray(parsed.registros) && !Array.isArray(parsed.simpatizantes) && !Array.isArray(parsed.turnosComite)) {
    throw new Error('El archivo no parece ser una copia válida de IPUE Barakaldo.');
  }

  const importedRuleta =
    parsed.ruleta && Array.isArray(parsed.ruleta.listas) && parsed.ruleta.listas.length > 0
      ? {
          ...DEFAULT_CONFIG_RULETA,
          ...parsed.ruleta,
        }
      : loadRuletaConfig();

  const next: CopiaSeguridad = {
    version: 1,
    exportadoEn: parsed.exportadoEn || new Date().toISOString(),
    registros: Array.isArray(parsed.registros) ? parsed.registros : [],
    tiposCulto: Array.isArray(parsed.tiposCulto) && parsed.tiposCulto.length > 0 ? parsed.tiposCulto : DEFAULT_TIPOS_CULTO,
    rotulosGrupos: Array.isArray(parsed.rotulosGrupos) && parsed.rotulosGrupos.length > 0 ? parsed.rotulosGrupos : DEFAULT_ROTULOS_GRUPOS,
    ajustesPantalla: {
      ...DEFAULT_AJUSTES_PANTALLA,
      ...(parsed.ajustesPantalla || {}),
    },
    simpatizantes: Array.isArray(parsed.simpatizantes) ? parsed.simpatizantes : [],
    tarjetasPendientes: Array.isArray(parsed.tarjetasPendientes) ? parsed.tarjetasPendientes : [],
    miembrosComite: Array.isArray(parsed.miembrosComite) ? parsed.miembrosComite : [],
    turnosComite: Array.isArray(parsed.turnosComite) ? parsed.turnosComite : [],
    puestosComite: Array.isArray(parsed.puestosComite) && parsed.puestosComite.length > 0 ? parsed.puestosComite : DEFAULT_PUESTOS_COMITE,
    ruleta: importedRuleta,
  };

  safeWrite(STORAGE_KEYS.REGISTROS, next.registros);
  safeWrite(STORAGE_KEYS.TIPOS_CULTO, next.tiposCulto);
  safeWrite(STORAGE_KEYS.ROTULOS_GRUPOS, next.rotulosGrupos);
  safeWrite(STORAGE_KEYS.AJUSTES_PANTALLA, next.ajustesPantalla);
  safeWrite(STORAGE_KEYS.SIMPATIZANTES, next.simpatizantes);
  safeWrite(STORAGE_KEYS.TARJETAS_PENDIENTES, next.tarjetasPendientes);
  safeWrite(STORAGE_KEYS.MIEMBROS_COMITE, next.miembrosComite);
  safeWrite(STORAGE_KEYS.TURNOS_COMITE, next.turnosComite);
  safeWrite(STORAGE_KEYS.PUESTOS_COMITE, next.puestosComite);
  safeWrite(STORAGE_KEYS.RULETA, importedRuleta);
  safeWrite(STORAGE_KEYS.EJEMPLO_CARGADO, false);

  return next;
}
