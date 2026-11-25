export type VistaActiva =
  | 'inicio'
  | 'registro'
  | 'graficos'
  | 'simpatizantes'
  | 'turnos'
  | 'ruleta'
  | 'movil';

export type ModoRegistro = 'simple' | 'grupos';

export interface RegistroAsistencia {
  id: string;
  fecha: string; // YYYY-MM-DD
  modo: ModoRegistro;
  total: number;
  grupos?: Record<string, number>;
  tipoCulto: string;
  nota?: string;
  creadoEn: string;
}

export type ModoPantallaGrupos = 'cada-grupo' | 'solo-total';
export type AcompanarCulto = 'ninguno' | 'linea-superior' | 'guiones' | 'marco-sutil';

export interface AjustesPantalla {
  modoGrupos: ModoPantallaGrupos;
  tamanoTexto: number; // 50 - 110 (%)
  colorTotal: string;
  colorCulto: string;
  letraCulto: string;
  cursivaCulto: boolean;
  acompanarCon: AcompanarCulto;
  distanciaInferior: number; // px
}

export interface Simpatizante {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  nota?: string;
  visitas: number;
  ultimaVisita: string; // YYYY-MM-DD
}

export interface TarjetaPendiente {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  nota?: string;
  fecha: string; // YYYY-MM-DD
  creadoEn: string;
}

export interface MiembroComite {
  id: string;
  nombre: string;
  telefono?: string;
  nota?: string;
  activo: boolean;
}

export type PuestoComite = 'Puerta principal' | 'Salón';

export interface TurnoComite {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipoCulto: string;
  ujierIds: string[];
  puesto?: string;
  puestosPorUjier?: Record<string, string>;
  nota?: string;
}

export type FondoRuleta = 'fiesta' | 'feria' | 'estrellas' | 'globos' | 'personalizado';
export type SonidoRuleta = 'clasico' | 'campana' | 'suave' | 'silencio';

export interface FondoRuletaPersonalizado {
  tipo: 'color' | 'imagen';
  valor: string; // hex color or data URL
}

export interface ListaRuleta {
  id: string;
  nombre: string;
  nombresTexto: string;
  excluidos: string[];
}

export interface ConfigRuleta {
  listas: ListaRuleta[];
  listaActivaId: string;
  tituloPantalla: string;
  fondo: FondoRuleta;
  fondoPersonalizado?: FondoRuletaPersonalizado;
  sonido: SonidoRuleta;
  confeti: boolean;
  sinRepetir: boolean;
}

export interface SpinRuletaPayload {
  id: string;
  startAngle: number;
  targetAngle: number;
  winner: string;
  durationMs: number;
}

export interface PantallaRuletaState {
  activa: boolean;
  titulo: string;
  nombres: string[];
  fondo: FondoRuleta;
  fondoPersonalizado?: FondoRuletaPersonalizado;
  sonido: SonidoRuleta;
  confeti: boolean;
  anguloActual: number;
  ultimoGanador?: string | null;
  spin?: SpinRuletaPayload | null;
}

export interface CopiaSeguridad {
  version: number;
  exportadoEn: string;
  registros: RegistroAsistencia[];
  tiposCulto: string[];
  rotulosGrupos: string[];
  ajustesPantalla: AjustesPantalla;
  simpatizantes: Simpatizante[];
  tarjetasPendientes: TarjetaPendiente[];
  miembrosComite: MiembroComite[];
  turnosComite: TurnoComite[];
  puestosComite?: string[];
  ruleta?: ConfigRuleta;
}

export interface ConfigEmailAsistencia {
  destinoEmail: string;
  autoEnviar: boolean;
}

