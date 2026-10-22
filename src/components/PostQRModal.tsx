import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  QrCode,
  Download,
  Copy,
  Check,
  Sparkles,
  Store,
  ShieldCheck,
  Share2,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { Post, Business } from '../types';
import { SharePostModal } from './SharePostModal';

interface PostQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  business?: Business;
}

export const PostQRModal: React.FC<PostQRModalProps> = ({
  isOpen,
  onClose,
  post,
  business,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [validationCode, setValidationCode] = useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !post) return;

    // Generate unique, reproducible-yet-fresh validation code
    const rawCleanId = post.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
    const bizClean = (post.businessId || 'BIZ').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    const code = `OV-${bizClean}-${rawCleanId}`;
    setValidationCode(code);

    // Payload formatted for barcode readers & camera scanners
    const payload = JSON.stringify({
      app: 'oleveci',
      type: 'POST_REDEMPTION',
      code,
      postId: post.id,
      businessId: post.businessId,
      title: post.title,
      ts: Date.now(),
    });

    // Generate high-resolution QR and stamp the OleVeci pin logo in the center
    const generateBrandedQR = async () => {
      try {
        const canvas = document.createElement('canvas');
        await QRCode.toCanvas(canvas, payload, {
          width: 512,
          margin: 2,
          color: {
            dark: '#031c54',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        });

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          logoImg.src = '/Icono_Oleveci_sin_fondo.png';

          await new Promise((resolve) => {
            logoImg.onload = () => resolve(true);
            logoImg.onerror = () => resolve(false);
            setTimeout(() => resolve(false), 600);
          });

          if (logoImg.complete && logoImg.naturalWidth > 0) {
            const center = canvas.width / 2;
            const logoSize = canvas.width * 0.22; // ~112px on a 512px canvas (well under the 30% H-error limit)
            const badgeRadius = logoSize / 2 + 5;

            ctx.save();
            // Outer circular white badge with brand blue ring
            ctx.beginPath();
            ctx.arc(center, center, badgeRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#0056d6';
            ctx.stroke();
            ctx.closePath();

            // Clip and draw logo
            ctx.beginPath();
            ctx.arc(center, center, logoSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(
              logoImg,
              center - logoSize / 2,
              center - logoSize / 2,
              logoSize,
              logoSize
            );
            ctx.restore();
          }
        }
        setQrDataUrl(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Fallback standard QR generation:', err);
        // Fallback without canvas logo
        QRCode.toDataURL(payload, {
          width: 480,
          margin: 2,
          color: { dark: '#031c54', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        })
          .then((url) => setQrDataUrl(url))
          .catch((e) => console.error('Failed QR generation:', e));
      }
    };

    generateBrandedQR();
  }, [isOpen, post]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!validationCode) return;
    navigator.clipboard?.writeText(validationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareCoupon = () => {
    setIsShareModalOpen(true);
  };

  const handleDownload = async () => {
    if (!qrDataUrl) return;

    // Compose a complete high-fidelity branded voucher card
    try {
      const vWidth = 640;
      const vHeight = 880;
      const vCanvas = document.createElement('canvas');
      vCanvas.width = vWidth;
      vCanvas.height = vHeight;
      const ctx = vCanvas.getContext('2d');

      if (!ctx) {
        // Fallback simple download
        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `Cupon-OleVeci-${validationCode || 'pase'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // 1. Background with smooth rounded container
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, vWidth, vHeight);

      // 2. Header banner gradient
      const headGrad = ctx.createLinearGradient(0, 0, vWidth, 140);
      headGrad.addColorStop(0, '#031742');
      headGrad.addColorStop(0.5, '#004bb5');
      headGrad.addColorStop(1, '#0080ff');
      ctx.fillStyle = headGrad;
      ctx.fillRect(0, 0, vWidth, 140);

      // Header labels
      ctx.fillStyle = '#00f2b3';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('✦ CUPÓN OFICIAL OLEVECI', 40, 48);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Pase de Canje en Local', 40, 84);

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Presenta este código al pagar o pedir', 40, 114);

      // 3. Business & Offer Info
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText((post.businessName || 'COMERCIO LOCAL').toUpperCase(), 40, 185);

      ctx.fillStyle = '#041f5e';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const cleanTitle = post.title.length > 42 ? post.title.slice(0, 39) + '...' : post.title;
      ctx.fillText(cleanTitle, 40, 218);

      // Price or discount
      if (post.promotionalPrice) {
        ctx.fillStyle = '#008f58';
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`$${post.promotionalPrice.toLocaleString('es-CO')} COP`, 40, 252);
      }

      // 4. Draw QR Code
      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise((r) => {
        qrImg.onload = r;
        qrImg.onerror = r;
      });
      const qrSize = 360;
      const qrX = (vWidth - qrSize) / 2;
      const qrY = 280;

      // QR white frame
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 4;
      ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
      ctx.shadowColor = 'transparent';

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // 5. Validation Code Box
      ctx.fillStyle = '#041f5e';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`CÓDIGO: ${validationCode}`, vWidth / 2, 720);

      ctx.fillStyle = '#64748b';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Escanea directamente en el establecimiento · OleVeci.com', vWidth / 2, 755);

      // Export and trigger download
      const link = document.createElement('a');
      link.href = vCanvas.toDataURL('image/png');
      link.download = `Cupon-OleVeci-${validationCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Error generating voucher canvas:', e);
      // Fallback
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `Cupon-OleVeci-${validationCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const originalPrice = post.originalPrice;
  const promoPrice = post.promotionalPrice;
  const hasDiscount = Boolean(originalPrice && promoPrice && originalPrice > promoPrice);
  const discountPct = hasDiscount && originalPrice && promoPrice
    ? Math.round(((originalPrice - promoPrice) / originalPrice) * 100)
    : null;
  const displayPrice = promoPrice || originalPrice;

  return (
    <>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      >
      <div
        className="relative w-full max-w-[380px] sm:max-w-[410px] bg-white rounded-[28px] sm:rounded-[32px] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon con Identidad OleVeci */}
        <div className="bg-gradient-to-r from-[#031742] via-[#004bb5] to-[#0080ff] p-4 text-white relative shrink-0 shadow-sm">
          <button
            id="btn-close-post-qr-modal"
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white cursor-pointer backdrop-blur-xs"
            aria-label="Cerrar cupón"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center p-1.5 shrink-0 shadow-inner">
              <img
                src="/Icono_Oleveci_sin_fondo.png"
                alt="OleVeci"
                className="w-full h-full object-contain filter drop-shadow-xs"
              />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#00f2b3]">
                <Sparkles className="w-3 h-3 text-[#00f2b3]" />
                <span>Cupón Oficial OleVeci</span>
              </div>
              <h3 className="text-base font-black text-white leading-tight truncate">
                Canjea en el Establecimiento
              </h3>
              <p className="text-[11px] text-blue-100 font-medium leading-none mt-0.5 truncate">
                Pase exclusivo para el comercio local
              </p>
            </div>
          </div>
        </div>

        {/* Content Body: Voucher Ticket */}
        <div className="overflow-y-auto overflow-x-hidden p-4 sm:p-4.5 space-y-3.5 bg-gradient-to-b from-slate-50/50 via-white to-slate-50/50">
          {/* Post & Business Summary Card (Stub Superior) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none" />
            
            {post.imageUrl ? (
              <img
                src={post.imageUrl}
                alt={post.title}
                className="w-13 h-13 rounded-xl object-cover border border-slate-100 shrink-0 shadow-2xs"
              />
            ) : (
              <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-[#0056d6] shrink-0 border border-blue-200/50">
                <Store className="w-6 h-6" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 truncate">
                <span className="truncate">{post.businessName || business?.name || 'Comercio Local'}</span>
                <CheckCircle2 className="w-3 h-3 text-[#007af7] shrink-0" />
              </div>

              <h4 className="text-xs sm:text-[13px] font-black text-[#041f5e] truncate leading-snug">
                {post.title}
              </h4>

              <div className="flex items-center flex-wrap gap-1.5 mt-1">
                {displayPrice ? (
                  <span className="text-[11px] font-black text-[#008f58]">
                    ${displayPrice.toLocaleString('es-CO')} COP
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500">
                    Beneficio Exclusivo
                  </span>
                )}

                {hasDiscount && discountPct && (
                  <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[9px] shadow-2xs">
                    -{discountPct}%
                  </span>
                )}

                {(post.businessCity || post.businessSector) && (
                  <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-slate-400">
                    <MapPin className="w-2.5 h-2.5" />
                    <span>{post.businessCity || 'Cajicá'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Perforated Divider (Notches laterales) */}
          <div className="relative flex items-center justify-between -mx-4 sm:-mx-4.5 px-0 py-0.5 overflow-hidden">
            <div className="w-4 h-4 rounded-full bg-slate-950/80 -translate-x-2 shadow-inner shrink-0" />
            <div className="flex-1 border-b-2 border-dashed border-slate-200 mx-2" />
            <div className="w-4 h-4 rounded-full bg-slate-950/80 translate-x-2 shadow-inner shrink-0" />
          </div>

          {/* QR Container con Enfoque de Visor y Logo Central OleVeci */}
          <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs text-center relative">
            {/* Viewfinder Corner Brackets */}
            <div className="relative p-2.5 bg-white rounded-2xl shadow-inner border border-slate-100 group">
              <div className="absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-[#0056d6] rounded-tl-sm pointer-events-none" />
              <div className="absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-[#0056d6] rounded-tr-sm pointer-events-none" />
              <div className="absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-[#0056d6] rounded-bl-sm pointer-events-none" />
              <div className="absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-[#0056d6] rounded-br-sm pointer-events-none" />

              <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR de ${post.title}`}
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <div className="w-7 h-7 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                    <span className="text-[11px] font-bold text-slate-500">Generando Cupón...</span>
                  </div>
                )}

                {/* Floating Centered OleVeci Badge */}
                {qrDataUrl && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white border-2 border-[#0056d6] shadow-md flex items-center justify-center p-1 pointer-events-none z-10">
                    <img
                      src="/Icono_Oleveci_sin_fondo.png"
                      alt="OleVeci Pin"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Validation Code Strip */}
            <div className="w-full mt-3 bg-gradient-to-r from-blue-50/80 via-slate-50 to-blue-50/80 border border-blue-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
              <div className="text-left min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block leading-tight">
                  Código de Validación
                </span>
                <span className="text-sm font-black text-[#041f5e] tracking-widest font-mono select-all">
                  {validationCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-xs font-bold text-[#0056d6] hover:bg-blue-50 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                title="Copiar código al portapapeles"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Footer Actions: Botones simétricos para Descargar Cupón y Compartir */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200/90 grid grid-cols-2 gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="h-11 rounded-2xl bg-white border border-slate-200/90 text-xs sm:text-[13px] font-extrabold text-slate-800 hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            title="Descargar cupón digital en imagen PNG"
          >
            <Download className="w-4 h-4 text-[#0056d6]" />
            <span>Descargar Cupón</span>
          </button>

          <button
            type="button"
            onClick={handleShareCoupon}
            className="h-11 rounded-2xl bg-white border border-slate-200/90 text-xs sm:text-[13px] font-extrabold text-slate-800 hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            title="Compartir cupón con un amigo"
          >
            <Share2 className="w-4 h-4 text-[#0056d6]" />
            <span>Compartir</span>
          </button>
        </div>
      </div>
    </div>

    {isShareModalOpen && (
      <SharePostModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        post={post}
        business={business}
      />
    )}
  </>
);
};
