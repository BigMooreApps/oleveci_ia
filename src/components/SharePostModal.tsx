import React, { useState, useMemo } from 'react';
import { Post, Business } from '../types';
import { SimulatedReadyPlan, resolvePlanPosts } from '../data/readyPlansData';
import { INITIAL_POSTS } from '../data/seedData';
import { PlanBackgroundImages, THEMES } from './InvitationCardPreview';
import { WhatsAppIcon } from './WhatsAppIcon';
import {
  formatPostShareText,
  formatBusinessShareText,
  formatPlanShareText,
  getWhatsAppWebUrl,
  downloadPostCardImage,
  downloadDirectImage,
} from '../utils/shareUtils';
import {
  X,
  Link2,
  Check,
  Share2,
  Download,
  Play,
  Film,
  CheckCircle2,
  Sparkles,
  Clock,
  MapPin,
  Route,
  Store,
} from 'lucide-react';

export interface SharePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post?: Post | null;
  business?: Business | null;
  plan?: SimulatedReadyPlan | null;
  planStops?: Post[];
}

const formatCOP = (val?: number) => {
  if (val === undefined || val === null) return '';
  return `$${val.toLocaleString('es-CO')}`;
};

async function downloadCompositePlanImage(
  title: string,
  stops: Post[],
  _bgLayout: string = 'horizontal'
): Promise<boolean> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Fill background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 1080, 1920);

    const validStops = stops.filter((s) => Boolean(s.imageUrl));
    if (validStops.length === 0) return false;

    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
        img.src = url;
      });
    };

    const drawCover = (img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
      const imgRatio = img.width / img.height;
      const targetRatio = dw / dh;
      let sw = img.width;
      let sh = img.height;
      let sx = 0;
      let sy = 0;
      if (imgRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    };

    const count = Math.min(validStops.length, 3);
    const loadedImages: (HTMLImageElement | null)[] = await Promise.all(
      validStops.slice(0, count).map(async (s) => {
        try {
          return await loadImage(s.imageUrl!);
        } catch {
          return null;
        }
      })
    );

    const successfulImages = loadedImages.filter(Boolean) as HTMLImageElement[];
    if (successfulImages.length === 0) return false;

    if (successfulImages.length === 1) {
      drawCover(successfulImages[0], 0, 0, 1080, 1920);
    } else {
      const sliceW = 1080 / successfulImages.length;
      successfulImages.forEach((img, idx) => {
        const x = idx * sliceW;
        drawCover(img, x, 0, sliceW, 1920);
        if (idx > 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 1920);
          ctx.stroke();
        }
      });
    }

    // Top vignette
    const topGrad = ctx.createLinearGradient(0, 0, 0, 360);
    topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    topGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, 1080, 360);

    // Bottom vignette
    const bottomGrad = ctx.createLinearGradient(0, 1920 - 720, 0, 1920);
    bottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.7)');
    bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, 1920 - 720, 1080, 720);

    // Header badge
    ctx.fillStyle = 'rgba(147, 51, 234, 0.9)';
    ctx.beginPath();
    ctx.roundRect(60, 90, 260, 56, 28);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`📍 ${validStops.length} Paradas`, 96, 128);

    // Plan Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(title.slice(0, 38), 60, 1720);

    // Stops names
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '32px sans-serif';
    const names = validStops.map((s) => s.businessName).join(' • ');
    ctx.fillText(names.slice(0, 52), 60, 1780);

    // Footer hashtag
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('#ViveTuPueblo ✨ • OleVeci', 60, 1840);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) return false;

    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `OleVeci_${safeName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Error generating composite plan image:', err);
    return false;
  }
}

export const SharePostModal: React.FC<SharePostModalProps> = ({
  isOpen,
  onClose,
  post,
  business,
  plan,
  planStops = [],
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;
  if (!post && !business && !plan) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://oleveci.com';

  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  const showToast = (message: string) => {
    setFeedbackToast(message);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // Determine item type and normalize share payload
  const resolvedPlan = plan || (post?.isPlan && post.planData ? (post.planData as SimulatedReadyPlan) : null);
  const resolvedStops = planStops.length > 0 ? planStops : (post?.planStops || []);

  const effectivePlanStops = useMemo(() => {
    if (resolvedStops.length > 0) return resolvedStops;
    if (resolvedPlan) {
      return resolvePlanPosts(resolvedPlan, INITIAL_POSTS);
    }
    return [];
  }, [resolvedStops, resolvedPlan]);

  const isPlan = Boolean(resolvedPlan);
  const isPost = Boolean(post) && !isPlan;
  const isBusiness = !post && !isPlan && Boolean(business);

  const shareData = isPlan
    ? formatPlanShareText(resolvedPlan!, effectivePlanStops, origin)
    : isBusiness
    ? formatBusinessShareText(business!, origin)
    : formatPostShareText(post!, origin);

  const modalHeaderTitle = isPlan
    ? 'Compartir itinerario'
    : isBusiness
    ? 'Compartir comercio'
    : 'Compartir publicación';

  const isVideo = Boolean(post?.videoUrl);

  const hasDiscount = Boolean(
    post?.originalPrice &&
    post?.promotionalPrice &&
    post.originalPrice > post.promotionalPrice
  );

  const discountPercent = hasDiscount
    ? Math.round(((post!.originalPrice! - post!.promotionalPrice!) / post!.originalPrice!) * 100)
    : 0;

  const cardImage = isPlan
    ? resolvedPlan?.coverImage || (resolvedStops.length > 0 ? resolvedStops[0].imageUrl : post?.imageUrl) || '/Icono_Oleveci_sin_fondo.png?v=clean'
    : isBusiness
    ? business?.coverImage || business?.logo
    : post?.imageUrl;

  const cardTitle = isPlan
    ? resolvedPlan?.planTitle || post?.title
    : isBusiness
    ? business?.name
    : post?.title;

  const cardBusinessName = isPlan
    ? `OleVeci · ${resolvedPlan?.municipality || post?.businessCity || 'Sabana Centro'}`
    : isBusiness
    ? business?.name
    : post?.businessName;

  const cardLogo = isPlan
    ? (resolvedStops.length > 0 ? resolvedStops[0].businessLogo : '/Icono_Oleveci_sin_fondo.png?v=clean')
    : isBusiness
    ? business?.logo
    : business?.logo || post?.businessLogo || '/Icono_Oleveci_sin_fondo.png?v=clean';

  // 1. WhatsApp Action (Apertura directa nativa en celular sin pedir ventanas emergentes, estilo TikTok/Instagram)
  const handleShareWhatsApp = () => {
    const text = shareData.shareMessage;
    const isMobileDevice =
      isMobile ||
      (typeof window !== 'undefined' &&
        (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768));

    if (isMobileDevice) {
      // En móvil, la navegación directa a api.whatsapp.com abre la app instalada sin bloquear ventanas emergentes
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.location.href = waUrl;
    } else {
      const waUrl = getWhatsAppWebUrl(text);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 1B. Compartir Nativo del Sistema (Bandeja nativa de Android/iOS con WhatsApp, Instagram, Telegram)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const handleShareNative = async () => {
    if (!navigator.share) {
      handleShareWhatsApp();
      return;
    }
    try {
      await navigator.share({
        title: shareData.title,
        text: shareData.shareMessage,
        url: shareData.url,
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        handleShareWhatsApp();
      }
    }
  };

  // 2. Copiar Enlace
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareData.url);
      } else {
        const input = document.createElement('input');
        input.value = shareData.url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      showToast('¡Enlace copiado al portapapeles!');
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      showToast('No se pudo copiar el enlace');
    }
  };

  // 6. Descargar Imagen
  const handleDownloadCard = async () => {
    setIsDownloading(true);
    let success = false;
    if (isPlan && effectivePlanStops.length > 0) {
      success = await downloadCompositePlanImage(cardTitle || 'Itinerario', effectivePlanStops, resolvedPlan?.bgLayout || 'horizontal');
    } else if (isPost && post) {
      success = await downloadPostCardImage(post.id, post.title, 'story');
    } else if (cardImage) {
      const safeName = (cardTitle || 'oleveci').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      success = await downloadDirectImage(cardImage, `OleVeci_${safeName}.png`);
    }
    setIsDownloading(false);
    if (success) {
      showToast('¡Imagen descargada con éxito!');
    } else {
      showToast('No se pudo descargar la imagen');
    }
  };

  const renderBusinessAvatar = () => {
    if (cardLogo) {
      return (
        <img
          src={cardLogo}
          alt={cardBusinessName || ''}
          referrerPolicy="no-referrer"
          className="w-full h-full rounded-full object-cover"
        />
      );
    }
    return (
      <div className="flex items-center justify-center w-full h-full text-white font-black text-xs uppercase bg-slate-900">
        {(cardBusinessName || 'OV').slice(0, 2)}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-[3500] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#040e28] text-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-white/10 flex flex-col max-h-[96vh] overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drawer handle bar */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-5 pt-2.5 sm:pt-4 pb-2.5 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#007af7] to-[#38bdf8] flex items-center justify-center shadow-md text-white">
              <Share2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 id="share-modal-title" className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {modalHeaderTitle}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto overscroll-contain">
          {/* ======================================================== */}
          {/* 9:16 PREVIEW CARD (MATCHES IN-APP PUBLICATION / PLAN / BIZ) */}
          {/* ======================================================== */}
          <div className="relative w-full aspect-[9/16] max-h-[420px] sm:max-h-[460px] rounded-[24px] sm:rounded-[28px] overflow-hidden bg-black shadow-2xl border border-white/20 select-none mx-auto flex flex-col justify-between">
            {/* 1. Full-Bleed Media (Image, Multi-Photo Itinerary Layout, or Video) */}
            <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center bg-black">
              {isPlan && effectivePlanStops.length > 0 ? (
                <div className="relative w-full h-full bg-black overflow-hidden select-none">
                  <PlanBackgroundImages
                    posts={effectivePlanStops}
                    bgLayout={resolvedPlan?.bgLayout || 'horizontal'}
                    theme={resolvedPlan?.theme || THEMES.blue_brand}
                    isReel={true}
                    targetWidth={1080}
                  />
                </div>
              ) : cardImage ? (
                <img
                  src={cardImage}
                  alt={cardTitle || ''}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: post?.imagePosition
                      ? `${post.imagePosition.x}% ${post.imagePosition.y}%`
                      : '50% 50%',
                    transform:
                      post?.imageScale && post.imageScale !== 1
                        ? `scale(${post.imageScale})`
                        : undefined,
                    filter:
                      post?.imageFilter && post.imageFilter !== 'none'
                        ? post.imageFilter
                        : undefined,
                  }}
                />
              ) : (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 font-bold text-xs">
                  <Film className="w-10 h-10 text-cyan-400/40" />
                </div>
              )}

              {/* Cinematic Vignettes */}
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none z-10" />
              <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/95 via-black/75 to-transparent pointer-events-none z-10" />
            </div>

            {/* 2. Top Bar: Badge depending on item type */}
            <div className="relative z-20 pt-3 px-3 flex items-center justify-between">
              {isPost && discountPercent > 0 ? (
                <div
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-white font-black text-xs tracking-tight shadow-xl border border-white/30 backdrop-blur-md"
                  style={{
                    background: 'linear-gradient(135deg, #ff3366 0%, #ff5e36 100%)',
                    boxShadow:
                      '0 4px 15px rgba(255, 51, 102, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)',
                  }}
                >
                  <span className="drop-shadow-xs">-{discountPercent}% OFF</span>
                </div>
              ) : isBusiness ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white font-black text-xs tracking-tight shadow-xl border border-white/30 backdrop-blur-md bg-blue-600/80">
                  <Store className="w-3.5 h-3.5 text-cyan-300" />
                  <span>{business?.verified ? '✓ Verificado' : 'Comercio local'}</span>
                </div>
              ) : isPlan ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white font-black text-xs tracking-tight shadow-xl border border-white/30 backdrop-blur-md bg-purple-600/80">
                  <Route className="w-3.5 h-3.5 text-cyan-300" />
                  <span>{resolvedStops.length > 0 ? `${resolvedStops.length} paradas` : 'Itinerario'}</span>
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Video center play icon indicator if post is video */}
            {isVideo && (
              <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-black/60 border border-white/80 text-white flex items-center justify-center shadow-xl">
                  <Play className="w-5 h-5 ml-0.5 fill-white" />
                </div>
              </div>
            )}

            {/* 3. Bottom Content Overlay */}
            <div className="relative z-20 pb-4 px-3.5 flex flex-col pointer-events-auto">
              {/* Business Name / Creator with Avatar */}
              <div className="inline-flex items-center gap-2 text-white font-extrabold text-sm tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-md overflow-hidden shrink-0 flex items-center justify-center">
                  {renderBusinessAvatar()}
                </div>
                <span>{cardBusinessName}</span>
                <CheckCircle2 className="w-4 h-4 text-cyan-400 fill-cyan-400/20 shrink-0" />
              </div>

              {/* Title */}
              <h2
                className={`text-white font-black leading-tight mt-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
                  (cardTitle || '').length > 50 ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
                }`}
              >
                {cardTitle}
              </h2>

              {/* Info Pill / Pricing */}
              {isPost && (
                <div className="mt-2 inline-flex items-center gap-2 p-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 shadow-xl w-fit">
                  {post?.promotionalPrice ? (
                    <>
                      <span className="bg-emerald-500 text-white font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs tracking-tight">
                        {formatCOP(post.promotionalPrice)}
                      </span>
                      {post.originalPrice && post.originalPrice > post.promotionalPrice && (
                        <span className="text-white/60 line-through text-xs font-semibold pr-2">
                          {formatCOP(post.originalPrice)}
                        </span>
                      )}
                    </>
                  ) : post?.originalPrice ? (
                    <span className="text-white font-black text-xs px-3 py-0.5">
                      {formatCOP(post.originalPrice)}
                    </span>
                  ) : (
                    <span className="text-emerald-300 font-bold text-xs px-2.5 py-0.5">
                      Consultar precio
                    </span>
                  )}
                </div>
              )}

              {isBusiness && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-xs font-bold text-sky-200 w-fit">
                  <MapPin className="w-3.5 h-3.5 text-orange-400" />
                  <span>
                    {[business?.sector, business?.city].filter(Boolean).join(', ') || 'Cajicá'}
                  </span>
                </div>
              )}

              {isPlan && (
                <div className="mt-2 inline-flex items-center gap-2 p-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 shadow-xl w-fit">
                  <span className="bg-emerald-500 text-white font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs tracking-tight">
                    {resolvedPlan?.estimatedBudget && resolvedPlan.estimatedBudget > 0
                      ? formatCOP(resolvedPlan.estimatedBudget)
                      : 'Presupuesto variable'}
                  </span>
                  <span className="text-cyan-200 text-xs font-bold pr-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-orange-400" />
                    {resolvedPlan?.municipality || 'Sabana Centro'}
                  </span>
                </div>
              )}

              {/* Validity / Schedule Tag */}
              {isPost && post?.expiryLabel ? (
                <div className="mt-1.5 flex items-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e293b]/85 backdrop-blur-md border border-white/25 text-sky-200 text-xs font-bold shadow-lg">
                    <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span className="truncate max-w-[260px] leading-tight">
                      {post.expiryLabel}
                    </span>
                  </div>
                </div>
              ) : isBusiness && business?.hours ? (
                <div className="mt-1.5 flex items-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e293b]/85 backdrop-blur-md border border-white/25 text-sky-200 text-xs font-bold shadow-lg">
                    <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span className="truncate max-w-[260px] leading-tight">
                      {business.hours}
                    </span>
                  </div>
                </div>
              ) : isPlan && plan?.scheduledTime ? (
                <div className="mt-1.5 flex items-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e293b]/85 backdrop-blur-md border border-white/25 text-sky-200 text-xs font-bold shadow-lg">
                    <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span className="truncate max-w-[260px] leading-tight">
                      {plan.scheduledTime}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Description */}
              {(isPost && post?.description) ||
              (isBusiness && business?.description) ||
              (isPlan && plan?.personalNote) ? (
                <div className="mt-1.5 max-h-24 sm:max-h-32 overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
                  <p className="text-white/95 text-xs sm:text-[13px] leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-pre-line select-text">
                    {isPost
                      ? post?.description
                      : isBusiness
                      ? business?.description
                      : plan?.personalNote}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* ======================================================== */}
          {/* ACTION BUTTONS (Unified Native Share + Copy & Download) */}
          {/* ======================================================== */}
          <div className="pt-2 space-y-2.5">
            {/* Main Share Button: Native Web Share API (mobile/desktop) or Direct WhatsApp */}
            <button
              type="button"
              id="btn-share-main"
              onClick={canNativeShare ? handleShareNative : handleShareWhatsApp}
              className="w-full group relative overflow-hidden py-3 px-4 rounded-2xl bg-gradient-to-r from-[#0056D6] via-[#006ee6] to-[#00C2FF] hover:from-[#004bb8] hover:via-[#005ec8] hover:to-[#00aee6] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl shadow-blue-600/30 border border-cyan-300/40 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              {/* Luminous sheen effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform shrink-0">
                {canNativeShare ? (
                  <Share2 className="w-4 h-4 text-white stroke-[2.5]" />
                ) : (
                  <WhatsAppIcon className="w-4 h-4 fill-white" />
                )}
              </div>

              <div className="text-left leading-tight">
                <div className="font-black text-xs sm:text-sm tracking-wide text-white drop-shadow-sm">
                  {canNativeShare
                    ? isPlan
                      ? 'Compartir Itinerario'
                      : isBusiness
                      ? 'Compartir Comercio'
                      : 'Compartir Publicación'
                    : 'Compartir en WhatsApp'}
                </div>
                <div className="text-[10px] font-semibold text-cyan-100/90 tracking-normal normal-case">
                  {canNativeShare
                    ? 'WhatsApp, Instagram, historias y contactos'
                    : 'Abrir chat directo con el enlace'}
                </div>
              </div>
            </button>

            {/* Secondary actions: Copiar enlace & Descargar imagen */}
            <div className="grid grid-cols-2 gap-2">
              {/* Copiar Enlace */}
              <button
                type="button"
                id="btn-copy-link"
                onClick={handleCopyLink}
                className="py-2.5 px-3 rounded-xl bg-[#111f36] hover:bg-[#182c4c] border border-white/10 hover:border-cyan-400/30 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-sm"
                title="Copiar enlace directo"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                    <span className="text-emerald-300 font-extrabold">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 text-sky-400" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </button>

              {/* Descargar Imagen */}
              <button
                type="button"
                id="btn-download-card"
                onClick={handleDownloadCard}
                disabled={isDownloading}
                className="py-2.5 px-3 rounded-xl bg-[#111f36] hover:bg-[#182c4c] border border-white/10 hover:border-purple-400/30 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                title="Descargar imagen"
              >
                <Download className={`w-4 h-4 text-cyan-300 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span>{isDownloading ? 'Guardando...' : 'Descargar imagen'}</span>
              </button>
            </div>
          </div>

          {/* Feedback Toast */}
          {feedbackToast && (
            <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackToast}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
