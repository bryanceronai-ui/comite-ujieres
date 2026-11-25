import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { RegistroAsistencia } from '../types';
import { formatFechaLarga, getTodayMadridISO } from './dates';

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
// Always let each church pick or switch its own Google account
provider.setCustomParameters({ prompt: 'select_account' });

// Token lives strictly in memory (never localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el permiso temporal de Gmail.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearAccessToken = (): void => {
  cachedAccessToken = null;
};

export const logoutGmail = async (): Promise<void> => {
  cachedAccessToken = null;
  await auth.signOut();
};

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  if (/[\r\n\0]/.test(trimmed)) return false;
  return /^[^\s@<>()[\]\\,;:\"]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/.test(trimmed);
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]+/g, ' ').trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function utf8ToBase64Url(str: string): string {
  return utf8ToBase64(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeRfc2047Subject(subject: string): string {
  const clean = sanitizeHeaderValue(subject);
  return `=?UTF-8?B?${utf8ToBase64(clean)}?=`;
}

export interface AttendanceEmailPreviewData {
  titulo: string;
  fechaLarga: string;
  grupos: Array<{ label: string; count: number }>;
  total: number;
  tipoCulto: string;
  nota?: string;
}

export function buildAttendanceSummary(registro: RegistroAsistencia): AttendanceEmailPreviewData {
  const hoy = getTodayMadridISO();
  const fechaLarga = formatFechaLarga(registro.fecha);
  const titulo = registro.fecha === hoy ? 'Asistencia de hoy' : `Asistencia · ${fechaLarga}`;
  const grupos =
    registro.grupos && Object.keys(registro.grupos).length > 0
      ? Object.entries(registro.grupos).map(([label, count]) => ({ label, count }))
      : [{ label: 'Asistentes', count: registro.total }];

  return {
    titulo,
    fechaLarga,
    grupos,
    total: registro.total,
    tipoCulto: registro.tipoCulto || 'Sin especificar',
    nota: registro.nota,
  };
}

function buildPlainTextBody(summary: AttendanceEmailPreviewData): string {
  const lines = [
    summary.titulo,
    `Fecha: ${summary.fechaLarga}`,
    '',
    ...summary.grupos.map((g) => `${g.label}: ${g.count}`),
    '------------------------------',
    `Total: ${summary.total}`,
    '',
    `Tipo de culto: ${summary.tipoCulto}`,
  ];
  if (summary.nota) {
    lines.push(`Nota: ${summary.nota}`);
  }
  return lines.join('\r\n');
}

function buildHtmlBody(summary: AttendanceEmailPreviewData): string {
  const rowsHtml = summary.grupos
    .map(
      (g) => `
      <tr>
        <td style="padding:7px 0;font-size:18px;font-weight:700;color:#ffffff;border-bottom:1px dotted #3b4764;white-space:nowrap;">
          ${escapeHtml(g.label)}
        </td>
        <td style="padding:7px 0 7px 16px;font-size:18px;font-weight:700;color:#ffffff;border-bottom:1px dotted #3b4764;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">
          ${g.count}
        </td>
      </tr>`
    )
    .join('');

  const notaHtml = summary.nota
    ? `<p style="margin:12px 0 0;font-size:14px;color:#b8c1d6;text-align:center;">Nota: ${escapeHtml(
        summary.nota
      )}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background-color:#0d0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e6e8ec;">
  <div style="max-width:460px;margin:0 auto;background-color:#0b1428;border:1px solid #26314a;border-radius:14px;padding:28px 26px;">
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#ffffff;text-align:center;">
      ${escapeHtml(summary.titulo)}
    </h1>
    <p style="margin:0 0 20px;font-size:13px;color:#93a1be;text-align:center;">
      ${escapeHtml(summary.fechaLarga)}
    </p>

    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div style="margin:14px 0 10px;border-top:1px solid #27324d;"></div>

    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tbody>
        <tr>
          <td style="padding:4px 0;font-size:21px;font-weight:800;color:#FFD84D;">
            Total
          </td>
          <td style="padding:4px 0;font-size:22px;font-weight:800;color:#FFD84D;text-align:right;font-variant-numeric:tabular-nums;">
            ${summary.total}
          </td>
        </tr>
      </tbody>
    </table>

    <p style="margin:18px 0 0;font-size:18px;font-style:italic;font-family:Georgia,serif;color:#ffffff;text-align:center;">
      ${escapeHtml(summary.tipoCulto)}
    </p>
    ${notaHtml}
  </div>
</body>
</html>`;
}

export interface SendAttendanceEmailParams {
  accessToken: string;
  toEmail: string;
  fromEmail?: string | null;
  registro: RegistroAsistencia;
}

export async function sendAttendanceEmail({
  accessToken,
  toEmail,
  fromEmail,
  registro,
}: SendAttendanceEmailParams): Promise<void> {
  const cleanTo = sanitizeHeaderValue(toEmail);
  if (!isValidEmailAddress(cleanTo)) {
    throw new Error('El correo electrónico de destino no es válido.');
  }

  const summary = buildAttendanceSummary(registro);
  const subjectText = `Asistencia ${summary.fechaLarga} · Total: ${summary.total}`;
  const boundary = `ipue_boundary_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const headers: string[] = [];
  if (fromEmail && isValidEmailAddress(fromEmail)) {
    headers.push(`From: ${sanitizeHeaderValue(fromEmail)}`);
  }
  headers.push(`To: ${cleanTo}`);
  headers.push(`Subject: ${encodeRfc2047Subject(subjectText)}`);
  headers.push('MIME-Version: 1.0');
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const plainBody = buildPlainTextBody(summary);
  const htmlBody = buildHtmlBody(summary);

  const mimeMessage = [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    utf8ToBase64(plainBody),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    utf8ToBase64(htmlBody),
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const raw = utf8ToBase64Url(mimeMessage);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (response.status === 401) {
    clearAccessToken();
    throw new Error(
      'La sesión de Google ha caducado. Pulsa "Conectar Google y enviar" para autorizar de nuevo.'
    );
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errData = (await response.json()) as { error?: { message?: string } };
      detail = errData?.error?.message ? ` (${errData.error.message})` : '';
    } catch {
      // ignore parse failure
    }
    throw new Error(`No se pudo enviar el correo por Gmail${detail}.`);
  }
}
