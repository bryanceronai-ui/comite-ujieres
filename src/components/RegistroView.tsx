import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, X, Plus, Minus, Trash2, Check, Mail, LogOut } from 'lucide-react';
import { User } from 'firebase/auth';
import { AjustesPantalla, ConfigEmailAsistencia, RegistroAsistencia } from '../types';
import { formatFechaLarga, getTodayMadridISO } from '../utils/dates';
import {
  generateId,
  loadConfigEmailAsistencia,
  saveConfigEmailAsistencia,
} from '../utils/storage';
import {
  buildAttendanceSummary,
  getAccessToken,
  googleSignIn,
  initAuth,
  isValidEmailAddress,
  logoutGmail,
  sendAttendanceEmail,
} from '../utils/gmailIntegration';
import { ConfirmModal } from './ConfirmModal';
import { PantallaModal } from './PantallaModal';

interface RegistroViewProps {
  registros: RegistroAsistencia[];
  tiposCulto: string[];
  rotulosGrupos: string[];
  ajustesPantalla: AjustesPantalla;
  pantallaActual: RegistroAsistencia | null;
  onSaveRegistros: (next: RegistroAsistencia[]) => void;
  onSaveTiposCulto: (next: string[]) => void;
  onSaveRotulosGrupos: (next: string[]) => void;
  onSaveAjustesPantalla: (next: AjustesPantalla) => void;
  onSendToPantalla: (registro: RegistroAsistencia | null) => void;
  onOpenPantallaWindow: () => void;
}

export const RegistroView: React.FC<RegistroViewProps> = ({
  registros,
  tiposCulto,
  rotulosGrupos,
  ajustesPantalla,
  pantallaActual,
  onSaveRegistros,
  onSaveTiposCulto,
  onSaveRotulosGrupos,
  onSaveAjustesPantalla,
  onSendToPantalla,
  onOpenPantallaWindow,
}) => {
  const [fecha, setFecha] = useState<string>(() => getTodayMadridISO());
  const [cantidadesGrupos, setCantidadesGrupos] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    rotulosGrupos.forEach((r) => {
      init[r] = '0';
    });
    return init;
  });
  const [tipoCulto, setTipoCulto] = useState<string>(tiposCulto[0] || 'Sin especificar');
  const [nota, setNota] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Correo (Gmail por iglesia)
  const [emailConfig, setEmailConfig] = useState<ConfigEmailAsistencia>(() =>
    loadConfigEmailAsistencia()
  );
  const [gmailUser, setGmailUser] = useState<User | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(() => getAccessToken());
  const [isLoggingInGmail, setIsLoggingInGmail] = useState(false);
  const [gmailAuthError, setGmailAuthError] = useState<string | null>(null);
  const [pendingEmailRecord, setPendingEmailRecord] = useState<RegistroAsistencia | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sendEmailError, setSendEmailError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGmailUser(user);
        setGmailToken(token);
      },
      () => {
        setGmailUser(null);
        setGmailToken(null);
      }
    );
    return unsubscribe;
  }, []);

  const updateEmailConfig = (patch: Partial<ConfigEmailAsistencia>) => {
    setEmailConfig((prev) => {
      const next = { ...prev, ...patch };
      saveConfigEmailAsistencia(next);
      return next;
    });
  };

  const handleConnectGmail = async () => {
    setGmailAuthError(null);
    setIsLoggingInGmail(true);
    try {
      const res = await googleSignIn();
      setGmailUser(res.user);
      setGmailToken(res.accessToken);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setGmailAuthError('Inicio de sesión cancelado.');
      } else {
        setGmailAuthError('No se pudo conectar con Google. Inténtalo de nuevo.');
      }
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setGmailAuthError(null);
    await logoutGmail();
    setGmailUser(null);
    setGmailToken(null);
  };

  // Modals
  const [showPantallaModal, setShowPantallaModal] = useState(false);
  const [pantallaTarget, setPantallaTarget] = useState<RegistroAsistencia | null>(null);
  const [pantallaModalMode, setPantallaModalMode] = useState<'config' | 'send'>('config');
  const [showRotulosModal, setShowRotulosModal] = useState(false);
  const [showCultosModal, setShowCultosModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RegistroAsistencia | null>(null);

  // Editors for Rotulos & Tipos de culto
  const [draftRotulos, setDraftRotulos] = useState<string[]>(rotulosGrupos);
  const [nuevoRotulo, setNuevoRotulo] = useState('');
  const [rotuloError, setRotuloError] = useState<string | null>(null);
  const rotulosListRef = useRef<HTMLDivElement>(null);
  const rotuloInputRef = useRef<HTMLInputElement>(null);

  const [draftCultos, setDraftCultos] = useState<string[]>(tiposCulto);
  const [nuevoCulto, setNuevoCulto] = useState('');
  const [cultoError, setCultoError] = useState<string | null>(null);
  const cultosListRef = useRef<HTMLDivElement>(null);
  const cultoInputRef = useRef<HTMLInputElement>(null);

  // Sorted newest to oldest
  const sortedRegistros = useMemo(() => {
    return [...registros].sort((a, b) => {
      if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
      return b.creadoEn.localeCompare(a.creadoEn);
    });
  }, [registros]);

  const promedio = useMemo(() => {
    if (registros.length === 0) return 0;
    const sum = registros.reduce((acc, r) => acc + r.total, 0);
    return Math.round(sum / registros.length);
  }, [registros]);

  const totalPorGrupos = useMemo(() => {
    return rotulosGrupos.reduce((acc, label) => {
      const val = parseInt(cantidadesGrupos[label] || '0', 10);
      return acc + (Number.isFinite(val) && val > 0 ? val : 0);
    }, 0);
  }, [rotulosGrupos, cantidadesGrupos]);

  const adjustGrupoCount = (label: string, delta: number) => {
    setErrorMsg(null);
    setCantidadesGrupos((prev) => {
      const current = parseInt(prev[label] || '0', 10);
      const safeCurrent = Number.isFinite(current) && current > 0 ? current : 0;
      const nextVal = Math.max(0, safeCurrent + delta);
      return {
        ...prev,
        [label]: String(nextVal),
      };
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFecha(getTodayMadridISO());
    const init: Record<string, string> = {};
    rotulosGrupos.forEach((r) => {
      init[r] = '0';
    });
    setCantidadesGrupos(init);
    setTipoCulto(tiposCulto[0] || 'Sin especificar');
    setNota('');
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fecha) {
      setErrorMsg('Selecciona una fecha válida.');
      return;
    }

    let totalFinal = 0;
    const gruposFinal: Record<string, number> = {};

    for (const label of rotulosGrupos) {
      const raw = (cantidadesGrupos[label] ?? '').trim();
      if (raw === '') {
        setErrorMsg(`Introduce un valor para «${label}» (puede ser 0).`);
        return;
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setErrorMsg(`El valor de «${label}» no puede ser negativo.`);
        return;
      }
      gruposFinal[label] = parsed;
      totalFinal += parsed;
    }

    let savedRecord: RegistroAsistencia;

    if (editingId) {
      const existing = registros.find((r) => r.id === editingId);
      savedRecord = {
        id: editingId,
        fecha,
        modo: 'grupos',
        total: totalFinal,
        grupos: gruposFinal,
        tipoCulto: tipoCulto || 'Sin especificar',
        nota: nota.trim() || undefined,
        creadoEn: existing?.creadoEn || new Date().toISOString(),
      };
      const updated = registros.map((r) => (r.id === editingId ? savedRecord : r));
      onSaveRegistros(updated);
      setSavedNotice('Registro actualizado');
      resetForm();
    } else {
      savedRecord = {
        id: generateId('reg'),
        fecha,
        modo: 'grupos',
        total: totalFinal,
        grupos: gruposFinal,
        tipoCulto: tipoCulto || 'Sin especificar',
        nota: nota.trim() || undefined,
        creadoEn: new Date().toISOString(),
      };
      onSaveRegistros([savedRecord, ...registros]);
      setSavedNotice('Asistencia guardada');
      // Keep date and reset quantities
      const resetGroups: Record<string, string> = {};
      rotulosGrupos.forEach((r) => {
        resetGroups[r] = '0';
      });
      setCantidadesGrupos(resetGroups);
      setNota('');
    }

    const cleanDestino = emailConfig.destinoEmail.trim();
    if (emailConfig.autoEnviar) {
      if (!cleanDestino) {
        setSavedNotice(
          'Asistencia guardada. Indica el correo de la iglesia abajo si deseas enviarla.'
        );
      } else if (!isValidEmailAddress(cleanDestino)) {
        setErrorMsg(
          'La asistencia se guardó, pero el correo de destino no es válido. Revísalo antes de enviar.'
        );
      } else {
        setSendEmailError(null);
        setPendingEmailRecord(savedRecord);
      }
    }

    setTimeout(() => setSavedNotice(null), 5000);
  };

  const handleConfirmSendEmail = async () => {
    if (!pendingEmailRecord) return;
    const cleanDestino = emailConfig.destinoEmail.trim();
    if (!isValidEmailAddress(cleanDestino)) {
      setSendEmailError('El correo electrónico de destino no es válido.');
      return;
    }

    setSendEmailError(null);
    setIsSendingEmail(true);
    try {
      let token = gmailToken || getAccessToken();
      let activeUser = gmailUser;

      if (!token) {
        const authResult = await googleSignIn();
        token = authResult.accessToken;
        activeUser = authResult.user;
        setGmailUser(authResult.user);
        setGmailToken(authResult.accessToken);
      }

      await sendAttendanceEmail({
        accessToken: token,
        toEmail: cleanDestino,
        fromEmail: activeUser?.email,
        registro: pendingEmailRecord,
      });

      setPendingEmailRecord(null);
      setSavedNotice(`Asistencia guardada y enviada a ${cleanDestino}`);
      setTimeout(() => setSavedNotice(null), 5500);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setSendEmailError('Se canceló el inicio de sesión con Google.');
      } else {
        setGmailToken(getAccessToken());
        setSendEmailError(
          err instanceof Error
            ? err.message
            : 'No se pudo enviar el correo. Revisa la conexión e inténtalo de nuevo.'
        );
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleEditRow = (reg: RegistroAsistencia) => {
    setEditingId(reg.id);
    setFecha(reg.fecha);
    setTipoCulto(reg.tipoCulto || 'Sin especificar');
    setNota(reg.nota || '');
    setErrorMsg(null);
    setSavedNotice(null);

    const nextG: Record<string, string> = {};
    if (reg.modo === 'simple') {
      rotulosGrupos.forEach((label, index) => {
        nextG[label] = index === 0 ? String(reg.total) : '0';
      });
    } else {
      rotulosGrupos.forEach((label) => {
        nextG[label] = String(reg.grupos?.[label] ?? 0);
      });
      // Also preserve any historical group label from that record
      if (reg.grupos) {
        Object.entries(reg.grupos).forEach(([k, v]) => {
          if (!(k in nextG)) nextG[k] = String(v);
        });
      }
    }
    setCantidadesGrupos(nextG);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const next = registros.filter((r) => r.id !== deleteTarget.id);
    onSaveRegistros(next);
    if (editingId === deleteTarget.id) {
      resetForm();
    }
    if (pantallaActual?.id === deleteTarget.id) {
      onSendToPantalla(null);
    }
    setDeleteTarget(null);
  };

  const handleOpenRotulos = () => {
    setDraftRotulos([...rotulosGrupos]);
    setNuevoRotulo('');
    setRotuloError(null);
    setShowRotulosModal(true);
  };

  const handleAddDraftRotulo = () => {
    const clean = nuevoRotulo.trim();
    if (!clean) {
      setRotuloError('Escribe un nombre para el nuevo grupo.');
      rotuloInputRef.current?.focus();
      return;
    }
    if (draftRotulos.some((r) => r.trim().toLowerCase() === clean.toLowerCase())) {
      setRotuloError('Ese grupo ya existe en la lista.');
      return;
    }
    setDraftRotulos((prev) => [...prev, clean]);
    setNuevoRotulo('');
    setRotuloError(null);
    requestAnimationFrame(() => {
      if (rotulosListRef.current) {
        rotulosListRef.current.scrollTop = rotulosListRef.current.scrollHeight;
      }
      rotuloInputRef.current?.focus();
    });
  };

  const handleSaveRotulos = () => {
    const pending = nuevoRotulo.trim();
    const combined = pending ? [...draftRotulos, pending] : draftRotulos;
    const cleaned = combined.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    const unique = Array.from(new Set(cleaned));
    onSaveRotulosGrupos(unique);
    setCantidadesGrupos((prev) => {
      const next: Record<string, string> = {};
      unique.forEach((label) => {
        next[label] = prev[label] ?? '0';
      });
      return next;
    });
    setNuevoRotulo('');
    setRotuloError(null);
    setShowRotulosModal(false);
  };

  const handleOpenCultos = () => {
    setDraftCultos([...tiposCulto]);
    setNuevoCulto('');
    setCultoError(null);
    setShowCultosModal(true);
  };

  const handleAddDraftCulto = () => {
    const clean = nuevoCulto.trim();
    if (!clean) {
      setCultoError('Escribe un nombre para añadir.');
      cultoInputRef.current?.focus();
      return;
    }
    if (draftCultos.some((c) => c.trim().toLowerCase() === clean.toLowerCase())) {
      setCultoError('Ese tipo de culto ya está en la lista.');
      return;
    }
    setDraftCultos((prev) => [...prev, clean]);
    setNuevoCulto('');
    setCultoError(null);
    requestAnimationFrame(() => {
      if (cultosListRef.current) {
        cultosListRef.current.scrollTop = cultosListRef.current.scrollHeight;
      }
      cultoInputRef.current?.focus();
    });
  };

  const handleSaveCultos = () => {
    const pending = nuevoCulto.trim();
    const combined = pending ? [...draftCultos, pending] : draftCultos;
    const cleaned = combined.map((s) => s.trim()).filter(Boolean);
    const hasSinEsp = cleaned.includes('Sin especificar');
    const finalList = hasSinEsp ? cleaned : ['Sin especificar', ...cleaned];
    const unique = Array.from(new Set(finalList));
    onSaveTiposCulto(unique);
    if (!unique.includes(tipoCulto)) {
      setTipoCulto(unique[0] || 'Sin especificar');
    }
    setNuevoCulto('');
    setCultoError(null);
    setShowCultosModal(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1900px] px-[24px] py-6">
      <div className="flex flex-col items-start gap-[24px] md:flex-row">
        {/* Left Panel: Registrar asistencia */}
        <section className="w-full rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px] md:w-[420px] md:shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[24px] font-bold text-white">
              {editingId ? 'Editar registro' : 'Registrar asistencia'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[15px] text-[#9ca3b0] underline underline-offset-2 hover:text-white"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            {/* Fecha */}
            <div>
              <label htmlFor="reg-fecha" className="block text-[15px] text-[#9ca3b0]">
                Fecha
              </label>
              <input
                id="reg-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] font-mono-tabular text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                required
              />
            </div>

            {/* Por grupos con contador táctil (+) */}
            <div>
              <div className="space-y-3">
                {rotulosGrupos.map((label) => {
                  const currentVal = parseInt(cantidadesGrupos[label] || '0', 10);
                  const isZero = !Number.isFinite(currentVal) || currentVal <= 0;
                  return (
                    <div
                      key={label}
                      className="flex flex-col gap-2.5 rounded-[12px] border border-[#282d39] bg-[#14171d] p-4"
                    >
                      <label
                        htmlFor={`grupo-${label}`}
                        className="truncate text-[17px] font-semibold text-[#e6e8ec]"
                        title={label}
                      >
                        {label}
                      </label>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => adjustGrupoCount(label, -1)}
                          disabled={isZero}
                          aria-label={`Restar 1 a ${label}`}
                          className="inline-flex h-[64px] w-[68px] shrink-0 touch-manipulation select-none items-center justify-center rounded-[12px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] transition-transform hover:bg-[#2a2f3c] hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Minus className="h-6 w-6 stroke-[2.5]" />
                        </button>

                        <input
                          id={`grupo-${label}`}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={cantidadesGrupos[label] ?? '0'}
                          onChange={(e) =>
                            setCantidadesGrupos((prev) => ({
                              ...prev,
                              [label]: e.target.value,
                            }))
                          }
                          className="h-[64px] w-[80px] shrink-0 rounded-[12px] border border-[#2d3340] bg-[#12151b] px-2 text-center font-mono-tabular text-[28px] font-bold text-white [appearance:textfield] focus:border-[#F2A65A] focus:outline-hidden sm:w-[92px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />

                        <button
                          type="button"
                          onClick={() => adjustGrupoCount(label, 1)}
                          aria-label={`Sumar 1 a ${label}`}
                          className="inline-flex h-[64px] min-w-[90px] flex-1 touch-manipulation select-none items-center justify-center rounded-[12px] bg-[#F2A65A] px-4 text-[#111318] transition-transform hover:bg-[#f5b473] active:scale-95"
                        >
                          <Plus className="h-8 w-8 stroke-[2.75]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleOpenRotulos}
                  className="text-[15px] font-medium text-[#F2A65A] underline decoration-[#F2A65A]/50 underline-offset-4 transition-colors hover:text-[#f6b879]"
                >
                  Editar rótulos
                </button>
                <span className="text-[15px] text-[#9ca3b0]">
                  Total:{' '}
                  <strong className="font-mono-tabular text-[20px] font-bold text-white">
                    {totalPorGrupos}
                  </strong>
                </span>
              </div>
            </div>

            {/* Tipo de culto */}
            <div>
              <label htmlFor="reg-tipo-culto" className="block text-[15px] text-[#9ca3b0]">
                Tipo de culto
              </label>
              <select
                id="reg-tipo-culto"
                value={tipoCulto}
                onChange={(e) => setTipoCulto(e.target.value)}
                className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden"
              >
                {tiposCulto.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleOpenCultos}
                  className="text-[15px] font-medium text-[#F2A65A] underline decoration-[#F2A65A]/50 underline-offset-4 transition-colors hover:text-[#f6b879]"
                >
                  Editar tipos de culto
                </button>
              </div>
            </div>

            {/* Nota */}
            <div>
              <label htmlFor="reg-nota" className="block text-[15px] text-[#9ca3b0]">
                Nota (opcional)
              </label>
              <input
                id="reg-nota"
                type="text"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Quién predicó, quién dirigió, el tema..."
                className="mt-2 min-h-[56px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#5c6373] focus:border-[#F2A65A] focus:outline-hidden"
              />
            </div>

            {/* Envío automático por correo (configurable por iglesia) */}
            <div className="space-y-3 rounded-[12px] border border-[#282d39] bg-[#14171d] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#e6e8ec]">
                  <Mail className="h-4 w-4 text-[#F2A65A]" />
                  Copia por correo (Gmail)
                </span>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] text-[#9ca3b0]">
                  <input
                    type="checkbox"
                    checked={emailConfig.autoEnviar}
                    onChange={(e) => updateEmailConfig({ autoEnviar: e.target.checked })}
                    className="h-4 w-4 rounded border-[#2d3340] accent-[#F2A65A]"
                  />
                  Enviar al guardar
                </label>
              </div>

              <div>
                <label htmlFor="reg-email-destino" className="block text-[14px] text-[#9ca3b0]">
                  Correo de la iglesia (destinatario)
                </label>
                <input
                  id="reg-email-destino"
                  type="email"
                  value={emailConfig.destinoEmail}
                  onChange={(e) => updateEmailConfig({ destinoEmail: e.target.value })}
                  placeholder="ejemplo@iglesia.org"
                  autoComplete="email"
                  className="mt-1.5 min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#12151b] px-4 py-3 text-[16px] text-white placeholder:text-[#5c6373] focus:border-[#F2A65A] focus:outline-hidden"
                />
                <p className="mt-1.5 text-[13px] leading-snug text-[#8a91a0]">
                  Cada iglesia escribe su propio correo y conecta su cuenta de Google.
                </p>
              </div>

              {gmailUser && gmailToken ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                  <span className="truncate text-[14px] text-emerald-300">
                    Gmail: <strong>{gmailUser.email}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectGmail}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-[#d4d8e0] underline underline-offset-2 hover:text-white"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Cambiar cuenta
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGmail}
                  disabled={isLoggingInGmail}
                  className="gsi-material-button inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#747775]/40 bg-white px-4 py-2 text-[15px] font-medium text-[#1f1f1f] transition-colors hover:bg-[#f2f4f8] disabled:opacity-60"
                >
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="h-5 w-5 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span className="gsi-material-button-contents">
                    {isLoggingInGmail ? 'Conectando...' : 'Sign in with Google'}
                  </span>
                </button>
              )}

              {gmailAuthError && (
                <p className="text-[14px] text-red-400" role="alert">
                  {gmailAuthError}
                </p>
              )}
            </div>

            {errorMsg && (
              <p className="text-[15px] font-medium text-red-400" role="alert">
                {errorMsg}
              </p>
            )}

            {savedNotice && (
              <p className="flex items-center gap-2 text-[15px] font-medium text-emerald-400">
                <Check className="h-5 w-5 shrink-0" />
                <span>{savedNotice}</span>
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] whitespace-nowrap shrink-0 md:w-auto"
              >
                {editingId ? 'Guardar cambios' : 'Guardar'}
              </button>
            </div>
          </form>
        </section>

        {/* Right Panel: Registros */}
        <section className="w-full min-w-0 flex-1 rounded-xl border border-[#242832] bg-[#1a1d24] p-[28px]">
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-[24px] font-bold text-white">Registros</h2>
              <span className="font-mono-tabular text-[15px] text-[#9ca3b0]">
                {registros.length} {registros.length === 1 ? 'registro' : 'registros'} · Promedio:{' '}
                <strong className="font-semibold text-white">{promedio}</strong>
              </span>
            </div>
          </div>

          {sortedRegistros.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-[#2a2f3a] bg-[#14171d] px-6 py-12 text-center">
              <p className="text-[18px] font-medium text-[#d4d8e0]">
                Todavía no hay registros de asistencia
              </p>
              <p className="mt-1.5 text-[15px] text-[#8a91a0]">
                Usa el formulario de la izquierda para guardar la primera reunión.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-[16px]">
                <thead>
                  <tr className="border-b border-[#242832] text-[14px] font-semibold uppercase tracking-wider text-[#8a91a0]">
                    <th className="py-3.5 pr-3">Fecha</th>
                    <th className="px-3 py-3.5">Total</th>
                    <th className="px-3 py-3.5">Detalle</th>
                    <th className="px-3 py-3.5">Culto y nota</th>
                    <th className="py-3.5 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222630]">
                  {sortedRegistros.map((reg) => {
                    const isOnScreen = pantallaActual?.id === reg.id;
                    const detalleText =
                      reg.modo === 'grupos' && reg.grupos
                        ? Object.entries(reg.grupos)
                            .map(([k, v]) => `${k} ${v}`)
                            .join(' · ')
                        : '—';

                    return (
                      <tr
                        key={reg.id}
                        className={`transition-colors hover:bg-[#20242d] ${
                          editingId === reg.id ? 'bg-[#F2A65A]/[0.06]' : ''
                        }`}
                      >
                        <td className="whitespace-nowrap py-[18px] pr-3 font-mono-tabular text-[16px] text-[#e6e8ec]">
                          {formatFechaLarga(reg.fecha)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-[18px] font-mono-tabular text-[20px] font-bold text-white">
                          {reg.total}
                        </td>
                        <td className="max-w-[260px] px-3 py-[18px] text-[16px] leading-snug text-[#8f96a4]">
                          {detalleText}
                        </td>
                        <td className="px-3 py-[18px] text-[16px]">
                          <div className="font-medium text-[#c7ccd6]">
                            {reg.tipoCulto || 'Sin especificar'}
                          </div>
                          {reg.nota && (
                            <div className="mt-0.5 text-[15px] text-[#858c9b]">{reg.nota}</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-[18px] pl-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPantallaTarget(reg);
                                setPantallaModalMode('send');
                                setShowPantallaModal(true);
                              }}
                              className={`min-h-[44px] rounded-[10px] border px-4 text-[15px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                                isOnScreen
                                  ? 'border-[#F2A65A] bg-[#F2A65A]/20 text-[#F2A65A]'
                                  : 'border-[#F2A65A]/70 bg-transparent text-[#F2A65A] hover:bg-[#F2A65A]/15'
                              }`}
                            >
                              Ver detalles
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditRow(reg)}
                              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] transition-colors hover:border-[#434c60] hover:text-white"
                              aria-label="Editar registro"
                              title="Editar"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(reg)}
                              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] transition-colors hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-400"
                              aria-label="Eliminar registro"
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

      {/* Modal: Cómo se ve en pantalla */}
      <PantallaModal
        open={showPantallaModal}
        ajustes={ajustesPantalla}
        registro={pantallaTarget}
        mode={pantallaModalMode}
        onSave={(next) => {
          onSaveAjustesPantalla(next);
          setShowPantallaModal(false);
        }}
        onSend={(reg, next) => {
          onSaveAjustesPantalla(next);
          onSendToPantalla(reg);
          onOpenPantallaWindow();
          setShowPantallaModal(false);
        }}
        onClose={() => setShowPantallaModal(false)}
      />

      {/* Modal: Editar rótulos */}
      {showRotulosModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl">
            <h3 className="text-[24px] font-bold text-white">Editar rótulos de grupos</h3>
            <p className="mt-1.5 text-[15px] text-[#9ca3b0]">
              Añade, renombra o quita los grupos que se suman en modo «Por grupos».
            </p>

            <div ref={rotulosListRef} className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
              {draftRotulos.map((rotulo, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={rotulo}
                    onChange={(e) => {
                      const next = [...draftRotulos];
                      next[i] = e.target.value;
                      setDraftRotulos(next);
                    }}
                    className="min-h-[56px] flex-1 rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    disabled={draftRotulos.length <= 1}
                    onClick={() => setDraftRotulos(draftRotulos.filter((_, idx) => idx !== i))}
                    className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[10px] border border-[#2d3340] text-[#9ca3b0] transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-35"
                    aria-label="Quitar rótulo"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2.5 md:flex-row md:items-center">
              <input
                ref={rotuloInputRef}
                type="text"
                value={nuevoRotulo}
                onChange={(e) => {
                  setNuevoRotulo(e.target.value);
                  if (rotuloError) setRotuloError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDraftRotulo();
                  }
                }}
                placeholder="Nuevo grupo (ej. Jóvenes)..."
                className="min-h-[56px] flex-1 rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#5c6373] focus:border-[#F2A65A] focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddDraftRotulo}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-white hover:bg-[#2b303c] whitespace-nowrap shrink-0 md:w-auto"
              >
                <Plus className="h-5 w-5" />
                Añadir
              </button>
            </div>
            {rotuloError && <p className="mt-2 text-[15px] text-red-400">{rotuloError}</p>}

            <div className="mt-6 flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() => setShowRotulosModal(false)}
                className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-[#d4d8e0] hover:text-white md:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRotulos}
                className="min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] hover:bg-[#f5b473] md:w-auto"
              >
                Guardar rótulos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar tipos de culto */}
      {showCultosModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[24px] font-bold text-white">Editar tipos de culto</h3>
              <span className="font-mono-tabular text-[15px] text-[#8a91a0]">
                {draftCultos.length} en lista
              </span>
            </div>
            <p className="mt-1.5 text-[15px] text-[#9ca3b0]">
              Se comparten entre Registro por reunión, Gráficos y Turnos del comité.
            </p>

            <div ref={cultosListRef} className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
              {draftCultos.map((culto, i) => {
                const isDefault = culto === 'Sin especificar';
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <input
                      type="text"
                      value={culto}
                      disabled={isDefault}
                      onChange={(e) => {
                        const next = [...draftCultos];
                        next[i] = e.target.value;
                        setDraftCultos(next);
                      }}
                      className="min-h-[56px] flex-1 rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white focus:border-[#F2A65A] focus:outline-hidden disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={isDefault}
                      onClick={() => setDraftCultos(draftCultos.filter((_, idx) => idx !== i))}
                      className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[10px] border border-[#2d3340] text-[#9ca3b0] transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-30"
                      aria-label="Borrar tipo de culto"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2.5 md:flex-row md:items-center">
              <input
                ref={cultoInputRef}
                type="text"
                value={nuevoCulto}
                onChange={(e) => {
                  setNuevoCulto(e.target.value);
                  if (cultoError) setCultoError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDraftCulto();
                  }
                }}
                placeholder="Nuevo tipo de culto o comité..."
                className="min-h-[56px] flex-1 rounded-[12px] border border-[#2d3340] bg-[#12151b] p-[16px] text-[18px] text-white placeholder:text-[#5c6373] focus:border-[#F2A65A] focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddDraftCulto}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-white hover:bg-[#2b303c] whitespace-nowrap shrink-0 md:w-auto"
              >
                <Plus className="h-5 w-5" />
                Añadir
              </button>
            </div>
            {cultoError && <p className="mt-2 text-[15px] text-red-400">{cultoError}</p>}

            <div className="mt-6 flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() => setShowCultosModal(false)}
                className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-[#d4d8e0] hover:text-white md:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCultos}
                className="min-h-[52px] w-full rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] hover:bg-[#f5b473] md:w-auto"
              >
                Guardar tipos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Borrar registro de asistencia"
        message={
          deleteTarget
            ? `¿Seguro que quieres borrar el registro del ${formatFechaLarga(deleteTarget.fecha)} (${deleteTarget.total} personas)? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Borrar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Confirm Email Send Modal */}
      {pendingEmailRecord && (() => {
        const preview = buildAttendanceSummary(pendingEmailRecord);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-confirm-title"
          >
            <div className="w-full max-w-lg rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#F2A65A]/15 text-[#F2A65A]">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 id="email-confirm-title" className="text-[20px] font-bold text-white">
                      Enviar resumen por correo
                    </h3>
                    <p className="mt-1 text-[15px] text-[#9ca3b0]">
                      Para: <strong className="text-white">{emailConfig.destinoEmail.trim()}</strong>
                    </p>
                    {gmailUser?.email && gmailToken ? (
                      <p className="text-[14px] text-emerald-400">
                        Desde: {gmailUser.email}
                      </p>
                    ) : (
                      <p className="text-[14px] text-[#8a91a0]">
                        Se abrirá Google para elegir la cuenta de correo de la iglesia.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={() => setPendingEmailRecord(null)}
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] text-[#8a91a0] transition-colors hover:bg-[#252a34] hover:text-white disabled:opacity-40"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Resumen visual igual a imagen 2 */}
              <div className="mt-5 rounded-[14px] border border-[#26314a] bg-[#0b1428] p-6">
                <h4 className="text-center text-[22px] font-bold text-white">{preview.titulo}</h4>
                <p className="mt-0.5 text-center text-[13px] text-[#93a1be]">
                  {preview.fechaLarga}
                </p>

                <div className="mt-4 space-y-2">
                  {preview.grupos.map((g) => (
                    <div key={g.label} className="flex items-baseline gap-2.5 text-[18px] font-bold text-white">
                      <span className="shrink-0">{g.label}</span>
                      <span className="flex-1 border-b border-dotted border-[#3b4764]" />
                      <span className="shrink-0 font-mono-tabular">{g.count}</span>
                    </div>
                  ))}
                </div>

                <div className="my-3.5 border-t border-[#27324d]" />

                <div className="flex items-baseline gap-2.5 text-[21px] font-bold text-[#FFD84D]">
                  <span className="shrink-0">Total</span>
                  <span className="flex-1 border-b border-dotted border-[#FFD84D]/45" />
                  <span className="shrink-0 font-mono-tabular">{preview.total}</span>
                </div>

                <p className="mt-4 text-center font-serif text-[18px] italic text-white">
                  {preview.tipoCulto}
                </p>
                {preview.nota && (
                  <p className="mt-2 text-center text-[14px] text-[#b8c1d6]">
                    Nota: {preview.nota}
                  </p>
                )}
              </div>

              {sendEmailError && (
                <p className="mt-4 text-[15px] font-medium text-red-400" role="alert">
                  {sendEmailError}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-end">
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={() => setPendingEmailRecord(null)}
                  className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#222630] px-[24px] text-[17px] font-medium text-[#d4d8e0] transition-colors hover:bg-[#2a2f3c] hover:text-white disabled:opacity-40 md:w-auto"
                >
                  Solo guardar
                </button>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={handleConfirmSendEmail}
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#F2A65A] px-[24px] text-[17px] font-semibold text-[#111318] transition-colors hover:bg-[#f5b473] disabled:opacity-60 md:w-auto"
                >
                  <Mail className="h-5 w-5" />
                  {isSendingEmail
                    ? 'Enviando...'
                    : gmailToken
                      ? 'Confirmar y enviar'
                      : 'Conectar Google y enviar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
