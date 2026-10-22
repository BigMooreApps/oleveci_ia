import React, { useState, useRef, useEffect } from 'react';
import { Post } from '../types';
import { useApp } from '../context/AppContext';
import { WhatsAppIcon } from './WhatsAppIcon';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Eye,
  MapPin,
  Clock,
  Calendar,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { parseVideoUrl } from '../utils/videoHelper';
import { getFeedCardImageUrl, getAvatarUrl, getBlurBackdropUrl } from '../utils/imageOptimization';

interface QuickPreviewModalProps {
  post: Post | null;
  onClose: () => void;
  onSelectPost: (post: Post) => void;
  onSelectBusiness?: (businessId: string) => void;
}

export const QuickPreviewModal: React.FC<QuickPreviewModalProps> = ({
  post,
  onClose,
  onSelectPost,
  onSelectBusiness,
}) => {
  const { trackInteraction } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (post) {
      trackInteraction(post.id, 'view');
    }
  }, [post, trackInteraction]);

  if (!post) return null;

  const parsedVideo = parseVideoUrl(post.videoUrl);
  const canUseNativeVideo = Boolean(parsedVideo.streamUrl || !parsedVideo.isIframe);
  const videoSrc = parsedVideo.streamUrl || parsedVideo.directUrl || post.videoUrl || '';

  const hasWhatsApp = Boolean(post.businessWhatsapp && post.businessWhatsapp.trim());
  const rawWhatsapp = (post.businessWhatsapp || '').replace(/\D/g, '');
  const cleanWhatsapp =
    rawWhatsapp.length === 10 && rawWhatsapp.startsWith('3') ? `57${rawWhatsapp}` : rawWhatsapp;

  const discountPercent =
    post.originalPrice && post.promotionalPrice && post.originalPrice > post.promotionalPrice
      ? Math.round(((post.originalPrice - post.promotionalPrice) / post.originalPrice) * 100)
      : null;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleOpenFull = () => {
    onClose();
    onSelectPost(post);
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasWhatsApp) return;
    trackInteraction(post.id, 'whatsapp');
    const origin = window.location.origin;
    const postUrl = `${origin}/anuncio/${post.id}`;
    const msg = `Hola, vi su anuncio "${post.title}" en OleVeci y me gustaría más información:\n${postUrl}`;
    window.open(`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleBusinessClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectBusiness && post.businessId) {
      onClose();
      onSelectBusiness(post.businessId);
    }
  };

  return (
    <div
      id="quick-preview-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[3300] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200 select-none overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa rápida de ${post.title}`}
    >
      {/* Decorative ambient glow */}
      <div className="hidden sm:block absolute -top-16 -left-16 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute -bottom-16 -right-16 w-96 h-96 bg-[#007af7]/20 rounded-full blur-3xl pointer-events-none" />

      {/* 9:16 Unified Container */}
      <div
        className="reel-container-9-16 relative w-full sm:w-auto h-[92dvh] sm:h-[calc(100dvh-68px)] sm:max-h-[920px] lg:max-h-[940px] aspect-[9/16] max-w-full mx-auto rounded-3xl bg-black shadow-2xl border border-white/20 overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media Canvas */}
        <div className="relative w-full h-full bg-slate-950 overflow-hidden cursor-pointer" onClick={togglePlay}>
          {post.videoUrl ? (
            canUseNativeVideo && videoSrc ? (
              <>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  poster={post.imageUrl ? getFeedCardImageUrl(post.imageUrl) : undefined}
                  muted={isMuted}
                  loop
                  autoPlay
                  playsInline
                  onLoadedData={() => setVideoLoaded(true)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className={`w-full h-full ${(post.videoFit || post.imageFit || 'cover') === 'contain' ? 'object-contain' : 'object-cover'}`}
                  style={{
                    objectPosition: (post.videoPosition || post.imagePosition)
                      ? `${(post.videoPosition || post.imagePosition)!.x}% ${(post.videoPosition || post.imagePosition)!.y}%`
                      : '50% 50%',
                    transform: (post.videoScale || post.imageScale) && (post.videoScale || post.imageScale) !== 1
                      ? `scale(${post.videoScale || post.imageScale})`
                      : undefined,
                  }}
                />
                {!isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none animate-in fade-in duration-150">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white shadow-xl">
                      <Play className="w-8 h-8 fill-white translate-x-0.5" />
                    </div>
                  </div>
                )}
              </>
            ) : parsedVideo.isIframe && parsedVideo.embedUrl ? (
              <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none bg-black">
                <iframe
                  src={`${parsedVideo.embedUrl}${parsedVideo.embedUrl.includes('?') ? '&' : '?'}autoplay=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3`}
                  scrolling="no"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  className={`border-0 pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${
                    parsedVideo.isVertical ? 'w-[144%] h-[154%]' : 'w-[250%] h-[130%]'
                  }`}
                  tabIndex={-1}
                  title={post.title}
                />
              </div>
            ) : null
          ) : post.imageUrl ? (
            <>
              {(post.imageFit === 'contain' || (post.imageScale && post.imageScale < 1)) && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                  <img
                    alt=""
                    className="w-full h-full object-cover blur-2xl scale-120 opacity-40"
                    src={getBlurBackdropUrl(post.imageUrl)}
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-black/40" />
                </div>
              )}
              <img
                alt={post.title}
                className={`w-full h-full ${post.imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                style={{
                  objectPosition: post.imagePosition
                    ? `${post.imagePosition.x}% ${post.imagePosition.y}%`
                    : '50% 50%',
                  transform: post.imageScale && post.imageScale !== 1 ? `scale(${post.imageScale})` : undefined,
                  filter: post.imageFilter && post.imageFilter !== 'none' ? post.imageFilter : undefined,
                }}
                src={getFeedCardImageUrl(post.imageUrl)}
                loading="eager"
              />
            </>
          ) : (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400 font-bold text-sm">
              OleVeci
            </div>
          )}

          {/* Vignette Overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60 pointer-events-none" />
        </div>

        {/* Floating Top Header */}
        <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between pointer-events-none">
          {/* Quick Preview Badge */}
          <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-cyan-400/40 text-cyan-300 text-xs font-bold shadow-lg shadow-cyan-950/30">
            <Eye className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Vista previa rápida</span>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {/* Audio Toggle (Native Video Only) */}
            {canUseNativeVideo && videoSrc && (
              <button
                type="button"
                onClick={toggleMute}
                className="w-9 h-9 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-md border border-white/25 shadow-lg active:scale-95 transition cursor-pointer"
                title={isMuted ? 'Activar sonido' : 'Silenciar'}
                aria-label="Silenciar o activar sonido"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-md border border-white/25 shadow-lg active:scale-95 transition cursor-pointer"
              title="Cerrar vista previa"
              aria-label="Cerrar vista previa"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Discount Badge */}
        {discountPercent ? (
          <div className="absolute top-16 left-3 z-20 pointer-events-none">
            <span
              className="px-3 py-1 rounded-full text-xs font-black text-white flex items-center gap-1 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #ff6a00 0%, #ff3b00 50%, #d81c00 100%)',
                boxShadow: '0 4px 14px rgba(220, 30, 0, 0.5)',
              }}
            >
              <span>🔥</span>
              <span>-{discountPercent}%</span>
            </span>
          </div>
        ) : null}

        {/* Bottom Card Information & Action Sheet */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-3 sm:p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-2.5">
          {/* Merchant Identity */}
          <div
            onClick={handleBusinessClick}
            className="flex items-center gap-2 cursor-pointer group/biz w-fit"
            title={post.businessName ? `Ver perfil de ${post.businessName}` : undefined}
          >
            {post.businessLogo ? (
              <img
                src={getAvatarUrl(post.businessLogo)}
                alt={post.businessName || ''}
                className="w-7 h-7 rounded-lg object-cover border border-white/20 bg-white shrink-0 shadow-md"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#007af7] text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-md">
                {(post.businessName || 'OV').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="text-xs font-bold text-white group-hover/biz:text-cyan-300 transition-colors flex items-center gap-1">
                {post.businessName || 'Comercio local'}
              </span>
              <span className="text-[10px] text-blue-200/80 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 text-[#ff7700]" />
                {post.businessSector || post.businessCity || 'Cajicá'}
              </span>
            </div>
          </div>

          {/* Title and Description */}
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-black text-white leading-snug line-clamp-2">
              {post.title}
            </h3>
            {post.description && (
              <p className="text-[11px] text-blue-100/80 line-clamp-2 leading-relaxed">
                {post.description}
              </p>
            )}
          </div>

          {/* Price & Schedule Pill */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {post.promotionalPrice ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm sm:text-base font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-500/40">
                    ${post.promotionalPrice.toLocaleString('es-CO')}
                  </span>
                  {post.originalPrice && post.originalPrice > post.promotionalPrice && (
                    <span className="text-xs text-white/50 line-through font-medium">
                      ${post.originalPrice.toLocaleString('es-CO')}
                    </span>
                  )}
                </div>
              ) : post.originalPrice ? (
                <span className="text-sm font-black text-white bg-white/15 px-2.5 py-0.5 rounded-lg border border-white/20">
                  ${post.originalPrice.toLocaleString('es-CO')}
                </span>
              ) : (
                <span className="text-xs font-semibold text-blue-200 bg-white/10 px-2 py-0.5 rounded-lg border border-white/15">
                  Consultar oferta
                </span>
              )}

              {post.expiryLabel && (
                <span className="inline-flex items-center gap-1 text-[10px] text-teal-300 bg-teal-950/70 px-2 py-0.5 rounded-md border border-teal-500/30 font-semibold truncate max-w-[150px]">
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{post.expiryLabel}</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/15">
            <button
              type="button"
              onClick={handleOpenFull}
              className="w-full py-2.5 px-3 rounded-xl bg-[#007af7] hover:bg-[#0066d6] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 active:scale-95 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Ver anuncio completo</span>
            </button>

            {hasWhatsApp ? (
              <button
                type="button"
                onClick={handleWhatsApp}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-700/30 active:scale-95 transition cursor-pointer"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 fill-white" />
                <span>WhatsApp</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenFull}
                className="w-full py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-white/20 active:scale-95 transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Más detalles</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
