import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Image as ImageIcon,
  Share2,
  X,
} from 'lucide-react';
import { MiembroComite, TurnoComite } from '../types';
import { addDaysISO, formatFechaCorta, formatFechaWhatsApp, parseISOParts } from '../utils/dates';
import { getUsherPuesto } from '../utils/turnosRules';

interface CompartirTurnosModalProps {
  isOpen: boolean;
  onClose: () => void;
  turnos: TurnoComite[];
  miembros: MiembroComite[];
  hoy: string;
}

type PeriodMode = 'este-mes' | 'proximo-mes' | 'rango';
type DocumentTheme = 'dark' | 'light';

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

const MESES_SLUG_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const DOC_WIDTH = 1080;
const DOC_HEIGHT = 1527; // A4 portrait proportion (1080 x 1527)
const MAX_CONTENT_HEIGHT = 1130;

interface UsherWithPuesto {
  nombre: string;
  puesto: string;
}

interface TurnoGroupItem {
  turno: TurnoComite;
  isFirstInDateGroup: boolean;
  isNewDateGroup: boolean;
  ushers: UsherWithPuesto[];
}

function estimateRowHeight(
  ushers: UsherWithPuesto[],
  isNewDateGroup: boolean
): number {
  const linesCount = Math.max(1, ushers.length);
  const baseHeight = linesCount === 1 ? 88 : 52 + linesCount * 36;
  const longNameExtra = ushers.reduce(
    (acc, u) => acc + (u.nombre.length + u.puesto.length > 34 ? 24 : 0),
    0
  );
  const groupGap = isNewDateGroup ? 10 : 0;
  return baseHeight + longNameExtra + groupGap;
}

function paginateItems(items: TurnoGroupItem[]): TurnoGroupItem[][] {
  if (items.length === 0) return [[]];
  const pages: TurnoGroupItem[][] = [];
  let currentPage: TurnoGroupItem[] = [];
  let usedHeight = 0;

  for (const item of items) {
    const h = estimateRowHeight(
      item.ushers,
      currentPage.length > 0 && item.isNewDateGroup
    );
    if (currentPage.length > 0 && usedHeight + h > MAX_CONTENT_HEIGHT) {
      pages.push(currentPage);
      currentPage = [{ ...item, isNewDateGroup: false }];
      usedHeight = estimateRowHeight(item.ushers, false);
    } else {
      currentPage.push(item);
      usedHeight += h;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }
  return pages;
}

interface DocumentPageProps {
  pageItems: TurnoGroupItem[];
  pageIndex: number;
  totalPages: number;
  periodLabel: string;
  theme: DocumentTheme;
  showCultoColumn: boolean;
}

const TurnosDocumentPage: React.FC<DocumentPageProps> = ({
  pageItems,
  pageIndex,
  totalPages,
  periodLabel,
  theme,
  showCultoColumn,
}) => {
  const isDark = theme === 'dark';

  const bgMain = isDark ? '#0d0f14' : '#ffffff';
  const borderHeader = isDark ? '#242832' : '#d1d5db';
  const titleColor = isDark ? '#ffffff' : '#111827';
  const periodColor = isDark ? '#F2A65A' : '#1f2937';
  const iglesiaColor = isDark ? '#9ca3b0' : '#4b5563';
  const logoBg = isDark ? '#161a23' : '#f3f4f6';
  const logoBorder = isDark ? '#2d3340' : '#d1d5db';

  const rowEvenBg = isDark ? '#141821' : '#f8fafc';
  const rowOddBg = isDark ? '#1b202c' : '#ffffff';
  const rowBorder = isDark ? '#252b38' : '#e5e7eb';
  const dateColor = isDark ? '#F2A65A' : '#111827';
  const cultoColor = isDark ? '#d4d8e0' : '#374151';
  const namesColor = isDark ? '#ffffff' : '#0f172a';
  const puestoColor = isDark ? '#9ca3b0' : '#6b7280';
  const footerColor = '#6b7280';

  return (
    <div
      style={{
        width: `${DOC_WIDTH}px`,
        height: `${DOC_HEIGHT}px`,
        backgroundColor: bgMain,
        color: titleColor,
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: '54px 56px 46px 56px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      <div>
        {/* Document Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '28px',
            paddingBottom: '28px',
            borderBottom: `2px solid ${borderHeader}`,
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '9999px',
              overflow: 'hidden',
              backgroundColor: logoBg,
              border: `2px solid ${logoBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: '8px',
              boxSizing: 'border-box',
            }}
          >
            <img
              src="/assets/aistudio/Color-Borde-blanco_fcabe59b.png"
              alt="IPUE Barakaldo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '42px',
                fontWeight: 800,
                lineHeight: 1.15,
                color: titleColor,
                letterSpacing: '-0.02em',
              }}
            >
              Turnos de ujieres
            </div>
            <div
              style={{
                marginTop: '8px',
                fontSize: '30px',
                fontWeight: 700,
                lineHeight: 1.2,
                color: periodColor,
              }}
            >
              {periodLabel}
            </div>
            <div
              style={{
                marginTop: '6px',
                fontSize: '23px',
                fontWeight: 500,
                lineHeight: 1.2,
                color: iglesiaColor,
              }}
            >
              IPUE Barakaldo
            </div>
          </div>
        </div>

        {/* Shifts list */}
        <div style={{ marginTop: '28px' }}>
          {pageItems.length === 0 ? (
            <div
              style={{
                marginTop: '40px',
                padding: '48px 32px',
                borderRadius: '16px',
                border: `2px dashed ${rowBorder}`,
                backgroundColor: rowEvenBg,
                textAlign: 'center',
                fontSize: '25px',
                color: iglesiaColor,
              }}
            >
              No hay turnos programados en este periodo.
            </div>
          ) : (
            <div
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                border: `1px solid ${rowBorder}`,
              }}
            >
              {pageItems.map((item, idx) => {
                const bg = idx % 2 === 0 ? rowEvenBg : rowOddBg;
                const topBorder =
                  idx === 0
                    ? 'none'
                    : item.isNewDateGroup
                    ? `2px solid ${borderHeader}`
                    : `1px solid ${rowBorder}`;

                return (
                  <div
                    key={item.turno.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: showCultoColumn
                        ? '160px 215px 1fr 205px'
                        : '205px 1fr 255px',
                      alignItems: 'center',
                      gap: '18px',
                      padding: '18px 24px',
                      backgroundColor: bg,
                      borderTop: topBorder,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '23px',
                        fontWeight: 700,
                        color: dateColor,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatFechaWhatsApp(item.turno.fecha)}
                    </div>

                    {showCultoColumn && (
                      <div
                        style={{
                          fontSize: '22px',
                          fontWeight: 500,
                          color: cultoColor,
                          lineHeight: 1.25,
                        }}
                      >
                        {item.turno.tipoCulto && item.turno.tipoCulto.trim()
                          ? item.turno.tipoCulto
                          : ''}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        lineHeight: 1.3,
                      }}
                    >
                      {item.ushers.length === 0 ? (
                        <span
                          style={{
                            fontSize: '23px',
                            fontWeight: 600,
                            fontStyle: 'italic',
                            color: puestoColor,
                          }}
                        >
                          Sin asignar
                        </span>
                      ) : (
                        item.ushers.map((u, uIdx) => (
                          <div
                            key={uIdx}
                            style={{
                              fontSize: '24px',
                              fontWeight: 700,
                              color: namesColor,
                              lineHeight: 1.3,
                            }}
                          >
                            {u.nombre}
                          </div>
                        ))
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        textAlign: 'right',
                        lineHeight: 1.3,
                      }}
                    >
                      {item.ushers.length === 0 ? (
                        <span
                          style={{
                            fontSize: '22px',
                            fontWeight: 500,
                            color: puestoColor,
                          }}
                        >
                          {item.turno.puesto || '—'}
                        </span>
                      ) : (
                        item.ushers.map((u, uIdx) => (
                          <div
                            key={uIdx}
                            style={{
                              fontSize: '22px',
                              fontWeight: 500,
                              color: puestoColor,
                              lineHeight: 1.3,
                            }}
                          >
                            {u.puesto}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Discreet footer */}
      <div
        style={{
          paddingTop: '20px',
          borderTop: `1px solid ${borderHeader}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '20px',
          fontWeight: 400,
          color: footerColor,
        }}
      >
        <span>Creado por: Bryan</span>
        {totalPages > 1 && (
          <span>
            Página {pageIndex + 1} de {totalPages}
          </span>
        )}
      </div>
    </div>
  );
};

function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet/i.test(
    navigator.userAgent
  );
  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return uaMobile || coarsePointer;
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function waitForImagesLoaded(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    })
  );
}

export const CompartirTurnosModal: React.FC<CompartirTurnosModalProps> = ({
  isOpen,
  onClose,
  turnos,
  miembros,
  hoy,
}) => {
  const hoyParts = parseISOParts(hoy);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('este-mes');
  const [rangoDesde, setRangoDesde] = useState(hoy);
  const [rangoHasta, setRangoHasta] = useState(addDaysISO(hoy, 30));
  const [previewTheme, setPreviewTheme] = useState<DocumentTheme>('dark');
  const [activePreviewPage, setActivePreviewPage] = useState(0);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [readyMessage, setReadyMessage] = useState<string | null>(null);
  const [fallbackShareImages, setFallbackShareImages] = useState<File[] | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [previewScale, setPreviewScale] = useState(0.5);
  const darkPagesContainerRef = useRef<HTMLDivElement | null>(null);
  const lightPagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Reset modal defaults when opened
  useEffect(() => {
    if (isOpen) {
      setPeriodMode('este-mes');
      setRangoDesde(hoy);
      setRangoHasta(addDaysISO(hoy, 30));
      setPreviewTheme('dark');
      setActivePreviewPage(0);
      setExportProgress(null);
      setReadyMessage(null);
      setFallbackShareImages(null);
      setExportError(null);
    }
  }, [isOpen, hoy]);

  // Measure preview wrapper width for crisp proportional 1080px scaling
  useEffect(() => {
    if (!isOpen) return;
    const el = previewViewportRef.current;
    if (!el) return;

    const updateScale = () => {
      const available = Math.max(240, el.clientWidth - 16);
      setPreviewScale(Math.min(1, available / DOC_WIDTH));
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  const periodInfo = useMemo(() => {
    if (periodMode === 'este-mes') {
      const prefix = `${hoyParts.year}-${String(hoyParts.month).padStart(2, '0')}`;
      return {
        label: `${MESES_LARGO_ES[hoyParts.month - 1]} ${hoyParts.year}`,
        fileSlug: `${MESES_SLUG_ES[hoyParts.month - 1]}-${hoyParts.year}`,
        matches: (fecha: string) => fecha.startsWith(prefix),
      };
    }
    if (periodMode === 'proximo-mes') {
      const nextMonth = hoyParts.month === 12 ? 1 : hoyParts.month + 1;
      const nextYear = hoyParts.month === 12 ? hoyParts.year + 1 : hoyParts.year;
      const prefix = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
      return {
        label: `${MESES_LARGO_ES[nextMonth - 1]} ${nextYear}`,
        fileSlug: `${MESES_SLUG_ES[nextMonth - 1]}-${nextYear}`,
        matches: (fecha: string) => fecha.startsWith(prefix),
      };
    }

    const start = rangoDesde <= rangoHasta ? rangoDesde : rangoHasta;
    const end = rangoDesde <= rangoHasta ? rangoHasta : rangoDesde;
    const startParts = parseISOParts(start);
    const endParts = parseISOParts(end);
    const sameMonth =
      startParts.year === endParts.year && startParts.month === endParts.month;

    const label = sameMonth
      ? `${MESES_LARGO_ES[startParts.month - 1]} ${startParts.year}`
      : `${formatFechaCorta(start)} – ${formatFechaCorta(end)} ${endParts.year}`;
    const fileSlug = sameMonth
      ? `${MESES_SLUG_ES[startParts.month - 1]}-${startParts.year}`
      : `${start}-a-${end}`;

    return {
      label,
      fileSlug,
      matches: (fecha: string) => fecha >= start && fecha <= end,
    };
  }, [periodMode, hoyParts.year, hoyParts.month, rangoDesde, rangoHasta]);

  const getMemberName = (id: string) =>
    miembros.find((m) => m.id === id)?.nombre || 'Sin asignar';

  const turnosOrdenados = useMemo(() => {
    return [...turnos]
      .filter((t) => periodInfo.matches(t.fecha))
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return (a.tipoCulto || '').localeCompare(b.tipoCulto || '', 'es');
      });
  }, [turnos, periodInfo]);

  const showCultoColumn = useMemo(
    () => turnosOrdenados.some((t) => Boolean(t.tipoCulto && t.tipoCulto.trim())),
    [turnosOrdenados]
  );

  const pagedItems = useMemo(() => {
    const grouped: TurnoGroupItem[] = [];
    let prevDate: string | null = null;

    for (const t of turnosOrdenados) {
      const isNewDateGroup = prevDate !== null && prevDate !== t.fecha;
      const isFirstInDateGroup = prevDate !== t.fecha;
      const ushers: UsherWithPuesto[] = t.ujierIds.map((uid, idx) => ({
        nombre: getMemberName(uid),
        puesto: getUsherPuesto(t, uid, idx),
      }));
      grouped.push({
        turno: t,
        isFirstInDateGroup,
        isNewDateGroup,
        ushers,
      });
      prevDate = t.fecha;
    }

    return paginateItems(grouped);
  }, [turnosOrdenados, miembros]);

  useEffect(() => {
    if (activePreviewPage >= pagedItems.length) {
      setActivePreviewPage(0);
    }
  }, [pagedItems.length, activePreviewPage]);

  if (!isOpen) return null;

  const baseFileName = `turnos-ujieres-${periodInfo.fileSlug}`;

  const jumpToPreviewPage = (idx: number) => {
    const clamped = Math.max(0, Math.min(pagedItems.length - 1, idx));
    setActivePreviewPage(clamped);
    const target = previewPageRefs.current[clamped];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const capturePagesAsCanvases = async (container: HTMLDivElement | null) => {
    if (!container) return [];
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await waitForImagesLoaded(container);

    const pageEls = Array.from(container.children) as HTMLElement[];
    const canvases: HTMLCanvasElement[] = [];

    for (let i = 0; i < pageEls.length; i += 1) {
      setExportProgress({ current: i + 1, total: pageEls.length });
      const canvas = await html2canvas(pageEls[i], {
        width: DOC_WIDTH,
        height: DOC_HEIGHT,
        scale: 1,
        useCORS: true,
        logging: false,
        backgroundColor: null,
      });
      canvases.push(canvas);
    }
    return canvases;
  };

  const handleShareSingleFallbackImage = async (file: File) => {
    const title = `Turnos de ujieres · ${periodInfo.label}`;
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    downloadBlobFile(file, file.name);
  };

  const handleExportPNG = async () => {
    setExportError(null);
    setReadyMessage(null);
    setFallbackShareImages(null);
    setExporting('png');

    try {
      const canvases = await capturePagesAsCanvases(darkPagesContainerRef.current);
      if (canvases.length === 0) return;

      const total = canvases.length;
      const files: File[] = [];
      for (let i = 0; i < total; i += 1) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvases[i].toBlob(resolve, 'image/png')
        );
        if (!blob) continue;
        const fileName =
          total === 1
            ? `${baseFileName}.png`
            : `${baseFileName}-${i + 1}de${total}.png`;
        files.push(new File([blob], fileName, { type: 'image/png' }));
      }

      if (files.length === 0) return;

      const title = `Turnos de ujieres · ${periodInfo.label}`;
      const isMobile = isMobileOrTabletDevice();

      if (isMobile) {
        const canShareAll =
          typeof navigator !== 'undefined' &&
          typeof navigator.share === 'function' &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files });

        if (canShareAll) {
          try {
            await navigator.share({ files, title });
            setReadyMessage(
              `Listo: ${files.length} ${files.length === 1 ? 'imagen' : 'imágenes'}`
            );
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
              return;
            }
            // Device rejected multi-file share -> expose per-page share buttons if > 1
            if (files.length > 1) {
              setFallbackShareImages(files);
              setReadyMessage(`Listo: ${files.length} imágenes`);
              return;
            }
          }
        } else if (files.length > 1) {
          setFallbackShareImages(files);
          setReadyMessage(`Listo: ${files.length} imágenes`);
          return;
        }
      }

      // Desktop: download each PNG sequentially with a 300 ms pause between downloads
      for (let i = 0; i < files.length; i += 1) {
        if (i > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 300));
        }
        downloadBlobFile(files[i], files[i].name);
      }

      setReadyMessage(
        `Listo: ${files.length} ${files.length === 1 ? 'imagen' : 'imágenes'}`
      );
    } catch {
      setExportError('No se pudo generar la imagen. Inténtalo de nuevo.');
    } finally {
      setExporting(null);
      setExportProgress(null);
    }
  };

  const handleExportPDF = async () => {
    setExportError(null);
    setReadyMessage(null);
    setExporting('pdf');
    try {
      const canvases = await capturePagesAsCanvases(lightPagesContainerRef.current);
      if (canvases.length === 0) return;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      canvases.forEach((canvas, idx) => {
        if (idx > 0) pdf.addPage();
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      });

      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `${baseFileName}.pdf`, {
        type: 'application/pdf',
      });
      const title = `Turnos de ujieres · ${periodInfo.label}`;

      if (
        isMobileOrTabletDevice() &&
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        try {
          await navigator.share({ files: [pdfFile], title });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }

      downloadBlobFile(pdfFile, pdfFile.name);
    } catch {
      setExportError('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      setExporting(null);
      setExportProgress(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 md:p-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compartir-turnos-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#2a2f3a] bg-[#1a1d24] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#242832] px-6 py-5">
          <div>
            <h3
              id="compartir-turnos-title"
              className="flex items-center gap-2.5 text-[22px] font-bold text-white"
            >
              <Share2 className="h-6 w-6 text-[#F2A65A]" />
              Compartir turnos
            </h3>
            <p className="mt-1 text-[15px] text-[#9ca3b0]">
              {turnosOrdenados.length}{' '}
              {turnosOrdenados.length === 1 ? 'turno' : 'turnos'} en {periodInfo.label}
              {pagedItems.length > 1 ? ` · ${pagedItems.length} páginas` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] text-[#8a91a0] hover:bg-[#252a34] hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Period Selector */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'este-mes', label: 'Este mes' },
                  { id: 'proximo-mes', label: 'Próximo mes' },
                  { id: 'rango', label: 'Rango de fechas' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setPeriodMode(opt.id);
                    setFallbackShareImages(null);
                    setReadyMessage(null);
                  }}
                  className={`flex h-[46px] items-center rounded-full border px-5 text-[16px] font-medium transition-colors ${
                    periodMode === opt.id
                      ? 'border-[#F2A65A] bg-[#F2A65A]/15 text-[#F2A65A]'
                      : 'border-[#2d3340] bg-[#14171d] text-[#9ca3b0] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {periodMode === 'rango' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="compartir-desde" className="block text-[14px] text-[#9ca3b0]">
                    Desde
                  </label>
                  <input
                    id="compartir-desde"
                    type="date"
                    value={rangoDesde}
                    onChange={(e) => {
                      setRangoDesde(e.target.value);
                      setFallbackShareImages(null);
                      setReadyMessage(null);
                    }}
                    className="mt-1.5 min-h-[50px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] px-4 font-mono-tabular text-[17px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label htmlFor="compartir-hasta" className="block text-[14px] text-[#9ca3b0]">
                    Hasta
                  </label>
                  <input
                    id="compartir-hasta"
                    type="date"
                    value={rangoHasta}
                    onChange={(e) => {
                      setRangoHasta(e.target.value);
                      setFallbackShareImages(null);
                      setReadyMessage(null);
                    }}
                    className="mt-1.5 min-h-[50px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] px-4 font-mono-tabular text-[17px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preview Controls + Scaled Document Preview (All pages visible via scroll + Anterior/Siguiente) */}
          <div className="rounded-xl border border-[#282d39] bg-[#12151b] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[14px] font-medium text-[#9ca3b0]">
                  Vista previa ({DOC_WIDTH}px vertical)
                </span>
                {pagedItems.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => jumpToPreviewPage(activePreviewPage - 1)}
                      disabled={activePreviewPage === 0}
                      className="inline-flex h-[34px] items-center gap-1 rounded-lg border border-[#2d3340] bg-[#1a1d24] px-2.5 text-[13px] font-medium text-[#d4d8e0] hover:text-white disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </button>
                    <span className="px-1.5 font-mono-tabular text-[13px] text-[#9ca3b0]">
                      {activePreviewPage + 1} / {pagedItems.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => jumpToPreviewPage(activePreviewPage + 1)}
                      disabled={activePreviewPage >= pagedItems.length - 1}
                      className="inline-flex h-[34px] items-center gap-1 rounded-lg border border-[#2d3340] bg-[#1a1d24] px-2.5 text-[13px] font-medium text-[#d4d8e0] hover:text-white disabled:opacity-40"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-[#2d3340] bg-[#1a1d24] p-1">
                <button
                  type="button"
                  onClick={() => setPreviewTheme('dark')}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    previewTheme === 'dark'
                      ? 'bg-[#2a303d] text-white'
                      : 'text-[#8a91a0] hover:text-white'
                  }`}
                >
                  Imagen (oscuro)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTheme('light')}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    previewTheme === 'light'
                      ? 'bg-white text-[#111827]'
                      : 'text-[#8a91a0] hover:text-white'
                  }`}
                >
                  PDF (blanco)
                </button>
              </div>
            </div>

            <div
              ref={previewViewportRef}
              className="max-h-[46vh] overflow-y-auto overflow-x-hidden rounded-lg border border-[#242832] bg-[#0a0c10] p-2"
            >
              <div className="flex flex-col items-center gap-4">
                {pagedItems.map((pageItems, idx) => (
                  <div
                    key={idx}
                    ref={(el) => {
                      previewPageRefs.current[idx] = el;
                    }}
                    style={{
                      width: `${Math.round(DOC_WIDTH * previewScale)}px`,
                      height: `${Math.round(DOC_HEIGHT * previewScale)}px`,
                      overflow: 'hidden',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                    }}
                  >
                    <div
                      style={{
                        width: `${DOC_WIDTH}px`,
                        height: `${DOC_HEIGHT}px`,
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      <TurnosDocumentPage
                        pageItems={pageItems}
                        pageIndex={idx}
                        totalPages={pagedItems.length}
                        periodLabel={periodInfo.label}
                        theme={previewTheme}
                        showCultoColumn={showCultoColumn}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fallback separate share buttons if mobile Web Share rejects multi-file share */}
          {fallbackShareImages && fallbackShareImages.length > 1 && (
            <div className="rounded-[12px] border border-[#F2A65A]/45 bg-[#F2A65A]/10 p-4">
              <p className="text-[14px] text-[#f5d0a9]">
                Tu dispositivo no permite enviar varias imágenes juntas. Compártelas una a una:
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {fallbackShareImages.map((file, idx) => (
                  <button
                    key={file.name}
                    type="button"
                    onClick={() => handleShareSingleFallbackImage(file)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-[#F2A65A] bg-[#1a1d24] px-4 text-[15px] font-semibold text-[#F2A65A] hover:bg-[#F2A65A]/15"
                  >
                    <Share2 className="h-4 w-4" />
                    Imagen {idx + 1} de {fallbackShareImages.length}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Export progress / completion status / error */}
          {exporting === 'png' && exportProgress && (
            <p className="text-[15px] font-medium text-[#F2A65A]">
              Generando imágenes... ({exportProgress.current} de {exportProgress.total})
            </p>
          )}
          {exporting === 'pdf' && exportProgress && (
            <p className="text-[15px] font-medium text-[#9ca3b0]">
              Generando PDF... ({exportProgress.current} de {exportProgress.total})
            </p>
          )}
          {!exporting && readyMessage && (
            <p className="text-[15px] font-semibold text-emerald-400">{readyMessage}</p>
          )}
          {exportError && (
            <p className="text-[15px] font-medium text-red-400">{exportError}</p>
          )}
        </div>

        {/* Footer Actions: ONLY Imagen (PNG) (recommended, main orange) + PDF (secondary) + filename below */}
        <div className="flex flex-col gap-2.5 border-t border-[#242832] bg-[#14171d] px-6 py-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleExportPNG}
              disabled={exporting !== null}
              className="inline-flex min-h-[54px] flex-1 items-center justify-center gap-2.5 rounded-[12px] bg-[#F2A65A] px-6 text-[17px] font-semibold text-[#111318] shadow-lg shadow-[#F2A65A]/20 transition-colors hover:bg-[#f5b473] disabled:opacity-50"
            >
              {exporting === 'png' ? (
                <Download className="h-5 w-5 animate-pulse" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
              <span>
                {exporting === 'png' && exportProgress
                  ? `Generando imágenes... (${exportProgress.current} de ${exportProgress.total})`
                  : 'Imagen (PNG)'}
              </span>
              <span className="rounded-md bg-[#111318]/15 px-2 py-0.5 text-[12px] font-bold">
                Recomendado
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={exporting !== null}
              className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[12px] border border-[#2d3340] bg-[#222630] px-6 text-[16px] font-medium text-white transition-colors hover:bg-[#2a2f3c] disabled:opacity-50 sm:w-auto"
            >
              <FileText className="h-5 w-5 text-[#9ca3b0]" />
              {exporting === 'pdf' ? 'Generando PDF...' : 'PDF'}
            </button>
          </div>

          <div className="text-[14px] text-[#8a91a0]">
            Archivo:{' '}
            <span className="font-mono-tabular text-[#c7ccd6]">{baseFileName}</span>
          </div>
        </div>
      </div>

      {/* Offscreen full-resolution 1080px pages for crisp PNG & white-background PDF capture */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          pointerEvents: 'none',
          opacity: 1,
        }}
      >
        <div ref={darkPagesContainerRef}>
          {pagedItems.map((pageItems, idx) => (
            <TurnosDocumentPage
              key={`dark-${idx}`}
              pageItems={pageItems}
              pageIndex={idx}
              totalPages={pagedItems.length}
              periodLabel={periodInfo.label}
              theme="dark"
              showCultoColumn={showCultoColumn}
            />
          ))}
        </div>

        <div ref={lightPagesContainerRef}>
          {pagedItems.map((pageItems, idx) => (
            <TurnosDocumentPage
              key={`light-${idx}`}
              pageItems={pageItems}
              pageIndex={idx}
              totalPages={pagedItems.length}
              periodLabel={periodInfo.label}
              theme="light"
              showCultoColumn={showCultoColumn}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
