import { MiembroComite, PuestoComite, TurnoComite } from '../types';
import { getWeekdayIndex, listDatesInRange, parseISOParts } from './dates';
import { generateId } from './storage';

export const PUESTOS_FIJOS: readonly PuestoComite[] = ['Puerta principal', 'Salón'];

/**
 * Reglas fijas de servicio por día de la semana (0 = Dom .. 6 = Sáb):
 * - Martes (2): 1 ujier en Puerta principal
 * - Viernes (5): 1 ujier en Puerta principal
 * - Domingo (0): 2 ujieres (Puerta principal y Salón)
 * - Lunes (1), Miércoles (3), Jueves (4), Sábado (6): sin servicio fijo
 */
export function getRequiredUshersForDate(fechaISO: string): number {
  if (!fechaISO || !/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return 0;
  const wd = getWeekdayIndex(fechaISO);
  if (wd === 0) return 2;
  if (wd === 2 || wd === 5) return 1;
  return 0;
}

export function getDefaultPuestosForDate(fechaISO: string): PuestoComite[] {
  if (!fechaISO || !/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return [];
  const wd = getWeekdayIndex(fechaISO);
  if (wd === 0) return ['Puerta principal', 'Salón'];
  if (wd === 2 || wd === 5) return ['Puerta principal'];
  return [];
}

export function isFixedServiceDay(fechaISO: string): boolean {
  return getRequiredUshersForDate(fechaISO) > 0;
}

export function getNextMonthRange(hoyISO: string): { start: string; end: string } {
  const { year, month } = parseISOParts(hoyISO);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const mm = String(nextMonth).padStart(2, '0');
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return {
    start: `${nextYear}-${mm}-01`,
    end: `${nextYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function getUsherPuesto(turno: TurnoComite, ujierId: string, index: number): PuestoComite {
  const explicit = turno.puestosPorUjier?.[ujierId];
  if (explicit === 'Puerta principal' || explicit === 'Salón') {
    return explicit;
  }
  const wd = turno.fecha ? getWeekdayIndex(turno.fecha) : -1;
  if (wd === 0) {
    return index === 1 ? 'Salón' : 'Puerta principal';
  }
  if (turno.puesto === 'Salón') return 'Salón';
  return 'Puerta principal';
}

export function formatUshersWithPuestoText(
  turno: TurnoComite,
  getMemberName: (id: string) => string
): string {
  if (turno.ujierIds.length === 0) return 'Sin asignar';
  return turno.ujierIds
    .map((id, idx) => `${getMemberName(id)} · ${getUsherPuesto(turno, id, idx)}`)
    .join(', ');
}

export function getMissingUshersCount(turno: TurnoComite): number {
  const required = getRequiredUshersForDate(turno.fecha);
  return Math.max(0, required - turno.ujierIds.length);
}

export function inferDefaultCultoForDate(fechaISO: string, tiposCulto: string[], fallbackCulto: string): string {
  const wd = getWeekdayIndex(fechaISO);
  if (wd === 0) {
    const dom = tiposCulto.find((c) => c.toLowerCase().includes('dominical'));
    if (dom) return dom;
  }
  if (wd === 2) {
    const ora = tiposCulto.find((c) => c.toLowerCase().includes('oración') || c.toLowerCase().includes('enseñanza'));
    if (ora) return ora;
  }
  return fallbackCulto || tiposCulto[1] || tiposCulto[0] || 'Sin especificar';
}

export function generateBalancedTurnos(params: {
  desde: string;
  hasta: string;
  activeMiembros: MiembroComite[];
  existingTurnos: TurnoComite[];
  servicios90Dias: Map<string, number>;
}): TurnoComite[] {
  const {
    desde,
    hasta,
    activeMiembros,
    existingTurnos,
    servicios90Dias,
  } = params;

  if (activeMiembros.length === 0 || !desde || !hasta || desde > hasta) {
    return [];
  }

  const serviceDates = listDatesInRange(desde, hasta).filter((d) => isFixedServiceDay(d));
  if (serviceDates.length === 0) return [];

  // Counters for the generated batch to ensure fair monthly distribution
  const totalCount = new Map<string, number>();
  const puertaCount = new Map<string, number>();
  const salonCount = new Map<string, number>();
  const sundayCount = new Map<string, number>();
  const sundayPuertaCount = new Map<string, number>();
  const sundaySalonCount = new Map<string, number>();
  const lastServedDate = new Map<string, string>();
  const lastSundayRole = new Map<string, PuestoComite>();

  activeMiembros.forEach((m) => {
    totalCount.set(m.id, 0);
    puertaCount.set(m.id, 0);
    salonCount.set(m.id, 0);
    sundayCount.set(m.id, 0);
    sundayPuertaCount.set(m.id, 0);
    sundaySalonCount.set(m.id, 0);
    lastServedDate.set(m.id, '');
  });

  // Track already-existing assignments per date so an usher is never twice on the same day
  const busyByDate = new Map<string, Set<string>>();
  existingTurnos.forEach((t) => {
    const set = busyByDate.get(t.fecha) || new Set<string>();
    t.ujierIds.forEach((id) => set.add(id));
    busyByDate.set(t.fecha, set);
  });

  let prevSundayUshers = new Set<string>();
  const generated: TurnoComite[] = [];

  const compareCandidates = (a: MiembroComite, b: MiembroComite, preferSundayFair: boolean) => {
    const diffTotal = (totalCount.get(a.id) || 0) - (totalCount.get(b.id) || 0);
    if (diffTotal !== 0) return diffTotal;

    if (preferSundayFair) {
      const diffSun = (sundayCount.get(a.id) || 0) - (sundayCount.get(b.id) || 0);
      if (diffSun !== 0) return diffSun;
    }

    const lastA = lastServedDate.get(a.id) || '';
    const lastB = lastServedDate.get(b.id) || '';
    if (lastA !== lastB) return lastA.localeCompare(lastB);

    const histA = servicios90Dias.get(a.id) || 0;
    const histB = servicios90Dias.get(b.id) || 0;
    if (histA !== histB) return histA - histB;

    return a.nombre.localeCompare(b.nombre, 'es');
  };

  for (const fecha of serviceDates) {
    const wd = getWeekdayIndex(fecha);
    const busyToday = busyByDate.get(fecha) || new Set<string>();
    const available = activeMiembros.filter((m) => !busyToday.has(m.id));
    const tipoCulto = '';

    if (wd === 2 || wd === 5) {
      // Martes o Viernes: 1 ujier en Puerta principal
      const pool = available.length > 0 ? [...available] : [];
      if (pool.length === 0) {
        generated.push({
          id: generateId('rot'),
          fecha,
          tipoCulto,
          ujierIds: [],
          puesto: 'Puerta principal',
          puestosPorUjier: {},
        });
        continue;
      }

      pool.sort((a, b) => compareCandidates(a, b, false));
      const chosen = pool[0];

      totalCount.set(chosen.id, (totalCount.get(chosen.id) || 0) + 1);
      puertaCount.set(chosen.id, (puertaCount.get(chosen.id) || 0) + 1);
      lastServedDate.set(chosen.id, fecha);
      busyToday.add(chosen.id);
      busyByDate.set(fecha, busyToday);

      generated.push({
        id: generateId('rot'),
        fecha,
        tipoCulto,
        ujierIds: [chosen.id],
        puesto: 'Puerta principal',
        puestosPorUjier: { [chosen.id]: 'Puerta principal' },
      });
    } else if (wd === 0) {
      // Domingo: 2 ujieres distintos (Puerta principal y Salón)
      const pool = [...available];
      if (pool.length === 0) {
        generated.push({
          id: generateId('rot'),
          fecha,
          tipoCulto,
          ujierIds: [],
          puesto: 'Puerta principal',
          puestosPorUjier: {},
        });
        prevSundayUshers = new Set();
        continue;
      }

      if (pool.length === 1) {
        const only = pool[0];
        totalCount.set(only.id, (totalCount.get(only.id) || 0) + 1);
        puertaCount.set(only.id, (puertaCount.get(only.id) || 0) + 1);
        sundayCount.set(only.id, (sundayCount.get(only.id) || 0) + 1);
        sundayPuertaCount.set(only.id, (sundayPuertaCount.get(only.id) || 0) + 1);
        lastServedDate.set(only.id, fecha);
        lastSundayRole.set(only.id, 'Puerta principal');
        busyToday.add(only.id);
        busyByDate.set(fecha, busyToday);
        prevSundayUshers = new Set([only.id]);

        generated.push({
          id: generateId('rot'),
          fecha,
          tipoCulto,
          ujierIds: [only.id],
          puesto: 'Puerta principal',
          puestosPorUjier: { [only.id]: 'Puerta principal' },
        });
        continue;
      }

      const nonPrev = pool.filter((m) => !prevSundayUshers.has(m.id));
      let chosenPair: [MiembroComite, MiembroComite];

      if (nonPrev.length >= 2) {
        const sortedNonPrev = [...nonPrev].sort((a, b) => compareCandidates(a, b, true));
        chosenPair = [sortedNonPrev[0], sortedNonPrev[1]];
      } else if (nonPrev.length === 1) {
        const rest = pool
          .filter((m) => m.id !== nonPrev[0].id)
          .sort((a, b) => compareCandidates(a, b, true));
        chosenPair = [nonPrev[0], rest[0]];
      } else {
        const sorted = [...pool].sort((a, b) => compareCandidates(a, b, true));
        chosenPair = [sorted[0], sorted[1]];
      }

      const [u1, u2] = chosenPair;

      const scoreOrientation = (puertaId: string, salonId: string) => {
        let score = 0;
        if (lastSundayRole.get(puertaId) === 'Puerta principal') score += 100;
        if (lastSundayRole.get(salonId) === 'Salón') score += 100;
        score +=
          Math.abs(
            (sundayPuertaCount.get(puertaId) || 0) + 1 - (sundaySalonCount.get(puertaId) || 0)
          ) * 15;
        score +=
          Math.abs(
            (sundayPuertaCount.get(salonId) || 0) - ((sundaySalonCount.get(salonId) || 0) + 1)
          ) * 15;
        score +=
          Math.abs((puertaCount.get(puertaId) || 0) + 1 - (salonCount.get(puertaId) || 0)) * 3;
        score +=
          Math.abs((puertaCount.get(salonId) || 0) - ((salonCount.get(salonId) || 0) + 1)) * 3;
        return score;
      };

      const s12 = scoreOrientation(u1.id, u2.id);
      const s21 = scoreOrientation(u2.id, u1.id);
      const puertaId = s12 <= s21 ? u1.id : u2.id;
      const salonId = s12 <= s21 ? u2.id : u1.id;

      [puertaId, salonId].forEach((uid) => {
        totalCount.set(uid, (totalCount.get(uid) || 0) + 1);
        sundayCount.set(uid, (sundayCount.get(uid) || 0) + 1);
        lastServedDate.set(uid, fecha);
        busyToday.add(uid);
      });
      puertaCount.set(puertaId, (puertaCount.get(puertaId) || 0) + 1);
      salonCount.set(salonId, (salonCount.get(salonId) || 0) + 1);
      sundayPuertaCount.set(puertaId, (sundayPuertaCount.get(puertaId) || 0) + 1);
      sundaySalonCount.set(salonId, (sundaySalonCount.get(salonId) || 0) + 1);
      lastSundayRole.set(puertaId, 'Puerta principal');
      lastSundayRole.set(salonId, 'Salón');
      busyByDate.set(fecha, busyToday);
      prevSundayUshers = new Set([puertaId, salonId]);

      generated.push({
        id: generateId('rot'),
        fecha,
        tipoCulto,
        ujierIds: [puertaId, salonId],
        puesto: 'Puerta principal',
        puestosPorUjier: {
          [puertaId]: 'Puerta principal',
          [salonId]: 'Salón',
        },
      });
    }
  }

  return generated;
}
