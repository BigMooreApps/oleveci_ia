import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';

interface OliWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OliWhatsAppModal: React.FC<OliWhatsAppModalProps> = ({ isOpen, onClose }) => {
  const [botNumber, setBotNumber] = useState('573245168762');
  const [copiedNumber, setCopiedNumber] = useState(false);

  // Load active bot number from config or Baileys status when modal is opened
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/whatsapp/baileys/status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.connectedPhone) {
          setBotNumber(data.connectedPhone);
        } else {
          fetch('/api/whatsapp/config')
            .then((r) => r.json())
            .then((cfg) => {
              if (cfg?.botNumber) setBotNumber(cfg.botNumber);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        fetch('/api/whatsapp/config')
          .then((r) => r.json())
          .then((cfg) => {
            if (cfg?.botNumber) setBotNumber(cfg.botNumber);
          })
          .catch(() => {});
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const cleanBotNumber = (botNumber || '573245168762').replace(/\D/g, '');

  const formatPhoneNumber = (numStr: string) => {
    const digits = numStr.replace(/\D/g, '');
    if (digits.startsWith('57') && digits.length === 12) {
      return `+57 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
    }
    if (digits.length === 10) {
      return `+57 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return `+${digits}`;
  };

  const formattedNumber = formatPhoneNumber(cleanBotNumber);

  const directChatUrl = `https://wa.me/${cleanBotNumber}?text=${encodeURIComponent(
    '¡Hola Oli! Quiero saber qué planes, promociones o comercios me recomiendas hoy en la Sabana Centro.'
  )}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    directChatUrl
  )}&color=075E54&margin=6`;

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(formattedNumber);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shadow-inner">
              <WhatsAppIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                Chatear con OLI
                <span className="text-[10px] bg-emerald-400/30 text-emerald-100 border border-emerald-300/40 px-2 py-0.5 rounded-full font-semibold">
                  WhatsApp
                </span>
              </h3>
              <p className="text-xs text-emerald-100 font-normal">
                Asistente de OleVeci en la Sabana Centro
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: QR + Phone Number Only */}
        <div className="p-6 flex flex-col items-center text-center space-y-5">
          {/* QR Code Container */}
          <div className="flex flex-col items-center">
            <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500 shadow-md transition-transform hover:scale-102 duration-300">
              <img
                src={qrImageUrl}
                alt="Código QR de WhatsApp para hablar con Oli"
                className="w-52 h-52 rounded-xl select-none block"
              />
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              <span>Escanea este código con la cámara de tu celular</span>
            </div>
          </div>

          {/* Phone Number Display with Copy Action */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Número de WhatsApp
                </span>
                <span className="text-base font-black text-slate-900 font-mono tracking-tight">
                  {formattedNumber}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyNumber}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
              title="Copiar número"
            >
              {copiedNumber ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>

          {/* Big Direct Button to Open WhatsApp */}
          <a
            href={directChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-5 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
          >
            <WhatsAppIcon className="w-5 h-5 text-white" />
            <span>Escribirle directo a Oli en WhatsApp</span>
            <ExternalLink className="w-4 h-4 text-white/90" />
          </a>

          {/* Quick Helper Note */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-normal">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Oli te responderá al instante con los mejores planes, promociones y comercios de la Sabana.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="truncate">OleVeci · Sabana Centro</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
