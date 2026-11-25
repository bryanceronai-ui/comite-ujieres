import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${
                danger
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-[#F2A65A]/15 text-[#F2A65A]'
              }`}
            >
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3
                id="confirm-modal-title"
                className="text-[20px] font-semibold text-white"
              >
                {title}
              </h3>
              <p className="mt-2 text-[17px] leading-relaxed text-[#a1a7b5]">
                {message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] text-[#8a91a0] transition-colors hover:bg-[#252a34] hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[52px] w-full rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-[#d4d8e0] transition-colors hover:bg-[#2a2f3c] hover:text-white whitespace-nowrap md:w-auto shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[52px] w-full rounded-[12px] px-[28px] text-[17px] font-semibold transition-colors whitespace-nowrap md:w-auto shrink-0 ${
              danger
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-[#F2A65A] text-[#111318] hover:bg-[#f5b473]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
