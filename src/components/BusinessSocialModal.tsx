import React, { useEffect } from 'react';
import { Business } from '../types';
import { getResolvedBusinessSocials, ResolvedSocialItem } from '../utils/socialUtils';
import {
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
  YouTubeIcon,
  WebsiteGlobeIcon,
  TwitterXIcon,
} from './icons/SocialIcons';
import { WhatsAppIcon } from './WhatsAppIcon';
import { X, ExternalLink, ShieldCheck, Phone, Sparkles } from 'lucide-react';
import { normalizeToColombianWa } from '../utils/phoneUtils';

interface BusinessSocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  business?: Partial<Business> | null;
  businessName?: string;
  businessLogo?: string;
  businessWhatsapp?: string;
  businessPhone?: string;
}

export const BusinessSocialModal: React.FC<BusinessSocialModalProps> = ({
  isOpen,
  onClose,
  business,
  businessName = business?.name || 'Comercio',
  businessLogo = business?.logo || '',
  businessWhatsapp = business?.whatsapp || '',
  businessPhone = business?.phone || '',
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const socialItems = getResolvedBusinessSocials(business);

  const rawWa = (businessWhatsapp || '').replace(/\D/g, '');
  const cleanWa = normalizeToColombianWa(rawWa);
  const hasWa = Boolean(cleanWa);
  const hasPhone = Boolean(businessPhone && businessPhone.trim() && businessPhone !== 'No registrado');

  const handleOpenLink = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenWhatsApp = () => {
    if (!hasWa) return;
    const msg = `Hola, los vi en OleVeci y me gustaría conocer más información sobre sus productos y servicios.`;
    window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleCall = () => {
    const callable = businessPhone || businessWhatsapp;
    if (!callable) return;
    window.open(`tel:${callable.replace(/[^\d+]/g, '')}`, '_self');
  };

  const renderNetworkIcon = (key: ResolvedSocialItem['key']) => {
    switch (key) {
      case 'instagram':
        return <InstagramIcon className="w-5 h-5 text-rose-600" size={20} />;
      case 'facebook':
        return <FacebookIcon className="w-5 h-5 text-[#1877F2]" size={20} />;
      case 'tiktok':
        return <TikTokIcon className="w-5 h-5 text-slate-900" size={20} />;
      case 'youtube':
        return <YouTubeIcon className="w-5 h-5 text-[#FF0000]" size={20} />;
      case 'website':
        return <WebsiteGlobeIcon className="w-5 h-5 text-[#007af7]" size={20} />;
      case 'twitter':
        return <TwitterXIcon className="w-5 h-5 text-slate-900" size={20} />;
      default:
        return <WebsiteGlobeIcon className="w-5 h-5 text-[#007af7]" size={20} />;
    }
  };

  const getNetworkStyle = (key: ResolvedSocialItem['key']) => {
    switch (key) {
      case 'instagram':
        return {
          cardBg: 'bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 border-rose-200/80 hover:border-rose-400',
          btnBg: 'bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCB045] hover:opacity-95 text-white',
          btnText: 'Ver Instagram',
        };
      case 'facebook':
        return {
          cardBg: 'bg-blue-50/70 border-blue-200/80 hover:border-blue-400',
          btnBg: 'bg-[#1877F2] hover:bg-[#166fe5] text-white',
          btnText: 'Ver Facebook',
        };
      case 'tiktok':
        return {
          cardBg: 'bg-slate-50 border-slate-200/90 hover:border-slate-400',
          btnBg: 'bg-slate-950 hover:bg-black text-white',
          btnText: 'Ver TikTok',
        };
      case 'youtube':
        return {
          cardBg: 'bg-red-50/70 border-red-200/80 hover:border-red-400',
          btnBg: 'bg-[#FF0000] hover:bg-[#e60000] text-white',
          btnText: 'Ver YouTube',
        };
      case 'website':
        return {
          cardBg: 'bg-indigo-50/70 border-indigo-200/80 hover:border-indigo-400',
          btnBg: 'bg-[#007af7] hover:bg-[#006bd6] text-white',
          btnText: 'Ir al Sitio Web',
        };
      case 'twitter':
        return {
          cardBg: 'bg-slate-50 border-slate-200/80 hover:border-slate-400',
          btnBg: 'bg-slate-900 hover:bg-black text-white',
          btnText: 'Abrir X',
        };
      default:
        return {
          cardBg: 'bg-slate-50 border-slate-200',
          btnBg: 'bg-[#007af7] text-white',
          btnText: 'Visitar',
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="social-modal-title"
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient branding */}
        <div className="relative bg-gradient-to-r from-[#021b58] via-[#041f5e] to-[#0052cc] p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-8">
            <div className="w-12 h-12 rounded-2xl bg-white p-0.5 shadow-md shrink-0 overflow-hidden border border-white/20">
              {businessLogo ? (
                <img
                  src={businessLogo}
                  alt={businessName}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#007af7] to-[#041f5e] flex items-center justify-center text-white font-black text-sm">
                  {businessName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00d8a5] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#ffbe00]" />
                  Canales Oficiales
                </span>
                {business?.verified && (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00d8a5]" title="Comercio Verificado" />
                )}
              </div>
              <h3
                id="social-modal-title"
                className="text-base sm:text-lg font-black tracking-tight text-white truncate"
              >
                {businessName}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de redes"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 scrollbar-thin">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
            <span>Redes sociales y enlaces directos:</span>
            <span className="font-bold text-[#041f5e]">
              {socialItems.length} {socialItems.length === 1 ? 'disponible' : 'disponibles'}
            </span>
          </div>

          {socialItems.length > 0 ? (
            <div className="space-y-2.5">
              {socialItems.map((item) => {
                const style = getNetworkStyle(item.key);
                return (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${style.cardBg}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-slate-100 flex items-center justify-center shrink-0">
                        {renderNetworkIcon(item.key)}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-black text-slate-900 leading-tight">
                          {item.label}
                        </span>
                        <span className="block text-[11px] font-medium text-slate-600 truncate max-w-[140px] sm:max-w-[190px]">
                          {item.handle}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenLink(item.url)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition cursor-pointer shrink-0 ${style.btnBg}`}
                    >
                      <span>{style.btnText}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <WebsiteGlobeIcon className="w-5 h-5 text-slate-400" />
              </div>
              <h4 className="text-xs font-bold text-slate-700">
                Sin redes sociales registradas
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Este comercio aún no ha agregado sus perfiles sociales en su cuenta de OleVeci.
              </p>
            </div>
          )}

          {/* Quick Contact Direct Alternatives */}
          {(hasWa || hasPhone) && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider px-1">
                Contacto Directo
              </span>
              <div className="grid grid-cols-2 gap-2">
                {hasWa && (
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <WhatsAppIcon className="w-4 h-4 fill-white shrink-0" />
                    <span>WhatsApp</span>
                  </button>
                )}

                {hasPhone && (
                  <button
                    type="button"
                    onClick={handleCall}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>Llamar</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span className="truncate">OleVeci · Conectando vecinos</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-slate-600 hover:text-slate-900 font-bold hover:bg-slate-200/60 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
