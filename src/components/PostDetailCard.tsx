import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Post } from '../types';
import { useApp } from '../context/AppContext';
import { WhatsAppIcon } from './WhatsAppIcon';
import {
  X,
  Clock,
  Calendar,
  Store,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Film,
  QrCode,
  Sparkles,
  MapPin,
  Phone,
  Share2,
  Navigation,
  CheckCircle2,
} from 'lucide-react';
import { PostQRModal } from './PostQRModal';
import { BusinessLocationMapModal } from './BusinessLocationMapModal';
import { parseVideoUrl } from '../utils/videoHelper';
import { sharePostNative } from '../utils/shareUtils';
import { SharePostModal } from './SharePostModal';

export interface PostCardColorTheme {
  id?: string;
  name?: string;
  isDark?: boolean;
  cardBg?: string;
  headerBg?: string;
  bodyBg?: string;
  footerBg?: string;
  borderColor?: string;
  accentText?: string;
  badgeBg?: string;
  headerTextColor?: string;
  headerSubtextColor?: string;
  titleColor?: string;
  descColor?: string;
  profileButtonBg?: string;
  actionButtonBg?: string;
}

const getCroppedBoxClass = (ratio?: string) => {
  switch (ratio) {
    case '1:1':
      return 'w-full aspect-[1/1] max-h-full shrink-0 shadow-lg';
    case '4:5':
      return 'w-full aspect-[4/5] max-h-full shrink-0 shadow-lg';
    case '2:3':
      return 'w-full aspect-[2/3] max-h-full shrink-0 shadow-lg';
    case '16:9':
      return 'w-full aspect-[16/9] max-h-full shrink-0 shadow-lg';
    case '9:16':
    default:
      return 'w-full h-full';
  }
};

export interface PostDetailCardProps {
  post: Post;
  onClose?: () => void;
  onSelectBusiness?: (businessId: string) => void;
  isBusinessSection?: boolean;
  onEditPost?: (post: Post) => void;
  fromBusinessProfile?: boolean;
  onSelectPost?: (post: Post) => void;
  onBackToProfile?: (businessId: string) => void;
  showCloseButton?: boolean;
  className?: string;
  colorTheme?: PostCardColorTheme;
  actionsLayout?: 'side' | 'bottom';
  isPreview?: boolean;
}

export const PostDetailCard: React.FC<PostDetailCardProps> = ({
  post,
  onClose,
  onSelectBusiness,
  isBusinessSection,
  fromBusinessProfile = false,
  onSelectPost,
  onBackToProfile,
  showCloseButton = false,
  className = '',
  actionsLayout = 'side',
  isPreview = false,
}) => {
  const isBottomActions = actionsLayout === 'bottom' || isPreview;
  const {
    businesses,
    posts,
    getDistanceKm,
    trackInteraction,
    isPostActive,
    currentRole,
  } = useApp();

  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const isBusinessMode = isBusinessSection !== undefined
    ? isBusinessSection
    : currentRole === 'business';

  const business = businesses.find((b) => b.id === post.businessId);
  const distance = getDistanceKm(post.coordinates);

  const formatCOPDisplay = (num?: number) => {
    if (num === undefined || num === null) return null;
    return `$${num.toLocaleString('es-CO')}`;
  };

  const discountPercent =
    post.originalPrice && post.promotionalPrice && post.originalPrice > post.promotionalPrice
      ? Math.round(((post.originalPrice - post.promotionalPrice) / post.originalPrice) * 100)
      : null;

  const businessLogo = business?.logo || post.businessLogo;
  const parsedVideo = parseVideoUrl(post.videoUrl);

  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 380, height: 600 });

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else if (iframeRef.current?.contentWindow) {
      try {
        if (isPlaying) {
          iframeRef.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
          iframeRef.current.contentWindow.postMessage('{"method":"pause"}', '*');
          setIsPlaying(false);
        } else {
          iframeRef.current.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
          iframeRef.current.contentWindow.postMessage('{"method":"play"}', '*');
          setIsPlaying(true);
        }
      } catch {}
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    if (iframeRef.current?.contentWindow) {
      try {
        if (nextMuted) {
          iframeRef.current.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
        } else {
          iframeRef.current.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
        }
      } catch {}
    }
  };

  const pauseVideo = () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        setIsPlaying(false);
      } catch (err) {
        console.warn('Error pausing native video:', err);
      }
    }
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        iframeRef.current.contentWindow.postMessage('{"method":"pause"}', '*');
        setIsPlaying(false);
      } catch {}
    }
  };

  // Auto-play when post is opened
  useEffect(() => {
    let isMounted = true;
    if (videoRef.current) {
      const vid = videoRef.current;
      vid.currentTime = 0;
      vid.muted = isMuted;
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (isMounted) setIsPlaying(true);
          })
          .catch(() => {
            if (isMounted && vid) {
              vid.muted = true;
              setIsMuted(true);
              vid.play().catch(() => {});
            }
          });
      }
    }
    return () => {
      isMounted = false;
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {}
      }
    };
  }, [post.id, post.videoUrl]);

  useEffect(() => {
    if (!mediaContainerRef.current) return;
    const updateDims = () => {
      if (mediaContainerRef.current) {
        const rect = mediaContainerRef.current.getBoundingClientRect();
        if (rect.height > 50 && rect.width > 50) {
          setContainerDimensions({ width: rect.width, height: rect.height });
        }
      }
    };
    updateDims();
    const observer = new ResizeObserver(updateDims);
    observer.observe(mediaContainerRef.current);
    return () => observer.disconnect();
  }, [post.id, post.imageUrl, post.videoUrl, post.aspectRatio]);

  const [streamFailed, setStreamFailed] = useState(false);
  const [streamRetryCount, setStreamRetryCount] = useState(0);

  useEffect(() => {
    setStreamFailed(false);
    setStreamRetryCount(0);
  }, [post.id, post.videoUrl]);

  const isTikTok = parsedVideo.platform === 'tiktok';
  const isInstagram = parsedVideo.platform === 'instagram';
  const isShorts = parsedVideo.platform === 'youtube' && parsedVideo.isVertical;
  const isFacebookReel = parsedVideo.platform === 'facebook' && parsedVideo.isVertical;
  const isFacebook = parsedVideo.platform === 'facebook';
  const isYouTube = parsedVideo.platform === 'youtube';
  const isVerticalEmbed = isTikTok || isInstagram || isShorts || isFacebookReel;
  const canUseNativeStream = Boolean(parsedVideo.streamUrl && !streamFailed);

  const effectiveEmbedUrl = useMemo(() => {
    if (!parsedVideo.embedUrl) return '';
    if (parsedVideo.platform === 'youtube') {
      const muteParam = isMuted ? 1 : 0;
      if (parsedVideo.embedUrl.includes('mute=')) {
        return parsedVideo.embedUrl.replace(/mute=[01]/, `mute=${muteParam}`);
      }
      return `${parsedVideo.embedUrl}&mute=${muteParam}`;
    }
    return parsedVideo.embedUrl;
  }, [parsedVideo.embedUrl, parsedVideo.platform, isMuted]);

  const nativeW = isTikTok ? 325 : isInstagram ? 270 : (isShorts || isFacebookReel) ? 320 : 320;
  const nativeH = isTikTok ? 575 : isInstagram ? 480 : isShorts ? 560 : isFacebookReel ? 570 : 540;

  const effectiveVideoFit = post.videoFit || post.imageFit || 'cover';
  const effectiveVideoScale = post.videoScale !== undefined ? post.videoScale : (post.imageScale || 1);
  const effectiveVideoPosition = post.videoPosition || post.imagePosition || { x: 50, y: 50 };

  const fitScale = containerDimensions.height / nativeH;
  const coverScale = containerDimensions.width / nativeW;
  const baseScale = effectiveVideoFit === 'contain' ? Math.min(coverScale, fitScale) : Math.max(coverScale, fitScale);
  const finalScale = baseScale * effectiveVideoScale;

  const hasWhatsApp = Boolean(post.businessWhatsapp && post.businessWhatsapp.trim());
  const rawWhatsapp = (post.businessWhatsapp || '').replace(/\D/g, '');
  const cleanWhatsapp = rawWhatsapp.length === 10 && rawWhatsapp.startsWith('3') ? `57${rawWhatsapp}` : rawWhatsapp;

  const hasPhone = Boolean(
    post.businessPhone && post.businessPhone.trim() && post.businessPhone !== 'No registrado'
  );
  const callablePhone = hasPhone ? post.businessPhone : (hasWhatsApp ? post.businessWhatsapp : null);

  const hasLocation = Boolean(
    (post.businessAddress && post.businessAddress.trim()) ||
    (post.coordinates?.lat && post.coordinates?.lng)
  );

  const handleWhatsApp = () => {
    pauseVideo();
    if (!hasWhatsApp) return;
    trackInteraction(post.id, 'whatsapp');
    const origin = window.location.origin;
    const postUrl = `${origin}/anuncio/${post.id}`;
    const msg = `Hola, quisiera más información sobre esta publicación:\n${postUrl}`;
    window.open(`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleMaps = () => {
    pauseVideo();
    if (!hasLocation) return;
    trackInteraction(post.id, 'maps');
    setIsLocationMapOpen(true);
  };

  const handleCall = () => {
    pauseVideo();
    if (!callablePhone) return;
    trackInteraction(post.id, 'call');
    const cleanCallable = callablePhone.replace(/[^\d+]/g, '');
    window.location.href = `tel:${cleanCallable}`;
  };

  const handleShare = () => {
    pauseVideo();
    trackInteraction(post.id, 'share');
    setIsShareModalOpen(true);
  };

  const renderBusinessAvatar = () => {
    if (businessLogo) {
      return (
        <img
          src={businessLogo}
          alt={post.businessName}
          referrerPolicy="no-referrer"
          className="w-full h-full rounded-full object-cover"
        />
      );
    }
    return (
      <div className="flex items-center justify-center w-full h-full text-white font-black text-xs uppercase bg-slate-900">
        {post.businessName.slice(0, 2)}
      </div>
    );
  };

  return (
    <>
      <div
        ref={mediaContainerRef}
        className={`relative w-full h-full overflow-hidden bg-black select-none flex flex-col justify-between ${className}`}
      >
        {/* ======================================================== */}
        {/* 1. BACKGROUND MEDIA (9:16 Full Canvas Video / Image)     */}
        {/* ======================================================== */}
        <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center bg-black">
          {post.videoUrl ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {parsedVideo.isIframe && !canUseNativeStream ? (
                isVerticalEmbed ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                    {(post.imageUrl || parsedVideo.defaultThumbnail) && (
                      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                        <img
                          src={post.imageUrl || parsedVideo.defaultThumbnail}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover blur-2xl scale-125 opacity-40"
                        />
                        <div className="absolute inset-0 bg-black/30" />
                      </div>
                    )}
                    <div className={`relative z-1 overflow-hidden flex items-center justify-center transition-all ${getCroppedBoxClass(post.aspectRatio)}`}>
                      <div
                        className="relative flex items-center justify-center select-none shadow-2xl overflow-hidden z-10"
                        style={{
                          width: `${nativeW}px`,
                          height: `${nativeH}px`,
                          transform: `scale(${finalScale}) translate(${((effectiveVideoPosition.x - 50) * 0.4)}%, ${((effectiveVideoPosition.y - 50) * 0.4)}%)`,
                          transformOrigin: 'center center',
                        }}
                      >
                        <iframe
                          ref={iframeRef}
                          src={effectiveEmbedUrl}
                          scrolling="no"
                          sandbox="allow-scripts allow-same-origin allow-presentation"
                          className={`border-0 select-none ${
                            isInstagram
                              ? 'absolute left-1/2 -translate-x-1/2 w-[480px] h-[640px] -top-[54px]'
                              : isTikTok
                              ? 'absolute left-1/2 -translate-x-1/2 w-[340px] h-[660px] -top-[48px]'
                              : isFacebook || isFacebookReel
                              ? 'absolute left-1/2 -translate-x-1/2 w-[340px] h-[640px] -top-[46px]'
                              : isShorts
                              ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[128%] h-[138%] pointer-events-none'
                              : 'w-full h-full'
                          }`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          title={post.title}
                        />
                        <div className="absolute inset-x-0 top-0 h-16 z-20 pointer-events-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePlayPause(); }} />
                        <div className="absolute inset-x-0 bottom-0 h-20 z-20 pointer-events-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePlayPause(); }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center bg-black"
                    style={{
                      transform: effectiveVideoScale !== 1 ? `scale(${effectiveVideoScale})` : undefined,
                      transformOrigin: `${effectiveVideoPosition.x}% ${effectiveVideoPosition.y}%`,
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      src={effectiveEmbedUrl}
                      scrolling="no"
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                      className={`border-0 relative z-1 select-none pointer-events-none ${
                        isYouTube
                          ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340%] h-[126%]'
                          : 'w-full h-full'
                      }`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      title={post.title}
                    />
                    <div className="absolute inset-0 z-20 cursor-pointer pointer-events-auto" onClick={togglePlayPause} />
                  </div>
                )
              ) : (
                <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    src={canUseNativeStream ? parsedVideo.streamUrl : (post.videoUrl || '')}
                    poster={post.imageUrl}
                    playsInline
                    autoPlay
                    loop
                    muted={isMuted}
                    onError={() => {
                      if (canUseNativeStream) {
                        if (streamRetryCount < 2) {
                          setStreamRetryCount((c) => c + 1);
                          setTimeout(() => {
                            if (videoRef.current) {
                              videoRef.current.load();
                              videoRef.current.play().catch(() => {});
                            }
                          }, 800);
                        } else {
                          setStreamFailed(true);
                        }
                      }
                    }}
                    className={`w-full h-full object-cover relative z-1`}
                    style={{
                      objectPosition: `${effectiveVideoPosition.x}% ${effectiveVideoPosition.y}%`,
                      transform: effectiveVideoScale !== 1 ? `scale(${effectiveVideoScale})` : undefined,
                      transformOrigin: `${effectiveVideoPosition.x}% ${effectiveVideoPosition.y}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ) : post.imageUrl ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
              <img
                src={post.imageUrl}
                alt={post.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: post.imagePosition
                    ? `${post.imagePosition.x}% ${post.imagePosition.y}%`
                    : '50% 50%',
                  transform: post.imageScale && post.imageScale !== 1 ? `scale(${post.imageScale})` : undefined,
                  transformOrigin: post.imagePosition
                    ? `${post.imagePosition.x}% ${post.imagePosition.y}%`
                    : '50% 50%',
                  filter: post.imageFilter && post.imageFilter !== 'none' ? post.imageFilter : undefined,
                }}
              />
            </div>
          ) : (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 font-bold text-xs">
              Sin contenido multimedia
            </div>
          )}

          {/* Cinematic Top and Bottom Vignettes for perfect text readability */}
          <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none z-10" />
        </div>

        {/* ======================================================== */}
        {/* 2. TOP BAR (Discount, Play/Mute, Location & Close)       */}
        {/* ======================================================== */}
        <div className="relative z-30 pt-3 sm:pt-4 px-3 sm:px-4 flex items-center justify-between gap-2">
          {/* Top-Left: Discount Badge */}
          <div className="shrink-0">
            {discountPercent ? (
              <div
                className="inline-flex items-center px-3 py-1.5 rounded-full text-white font-black text-xs sm:text-sm tracking-tight shadow-xl border border-white/30 backdrop-blur-md"
                style={{
                  background: 'linear-gradient(135deg, #ff3366 0%, #ff5e36 100%)',
                  boxShadow: '0 4px 15px rgba(255, 51, 102, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)',
                }}
              >
                <span className="drop-shadow-xs">-{discountPercent}% OFF</span>
              </div>
            ) : null}
          </div>

          {/* Top-Center: Playback & Audio Controls */}
          {post.videoUrl ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-8.5 h-8.5 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition active:scale-90 cursor-pointer shadow-md"
                title={isPlaying ? 'Pausar video' : 'Reproducir video'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-white" />
                ) : (
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="w-8.5 h-8.5 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition active:scale-90 cursor-pointer shadow-md"
                title={isMuted ? 'Activar sonido' : 'Desactivar sonido'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-white" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          ) : (
            <div />
          )}

          {/* Top-Right: Close Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {showCloseButton && onClose && (
              <button
                type="button"
                onClick={() => {
                  pauseVideo();
                  onClose();
                }}
                className="w-8.5 h-8.5 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition active:scale-90 cursor-pointer shadow-md"
                title="Cerrar"
                aria-label="Cerrar"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. MIDDLE AREA WITH FLOATING RIGHT ACTION BUTTONS        */}
        {/* ======================================================== */}
        <div className="relative z-20 flex-1 flex flex-col justify-end pointer-events-none">
          {/* Right Floating Actions Stack (Only shown when not using bottom actions) */}
          {!isBottomActions && (
            <div className="absolute right-3 sm:right-4 bottom-24 flex flex-col items-center gap-3.5 pointer-events-auto">
              {/* 1. Veci (Avatar + Profile link) */}
              <button
                type="button"
                onClick={() => {
                  pauseVideo();
                  if (onClose) onClose();
                  if (onSelectBusiness) onSelectBusiness(post.businessId);
                }}
                className="flex flex-col items-center gap-1 group cursor-pointer"
                title={`Ver perfil de ${post.businessName}`}
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full p-[2px] bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-xl overflow-hidden flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform">
                  {renderBusinessAvatar()}
                </div>
                <span className="text-[10px] sm:text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  Veci
                </span>
              </button>

              {/* 2. WhatsApp */}
              <button
                type="button"
                id={`modal-btn-wa-${post.id}`}
                onClick={handleWhatsApp}
                disabled={!hasWhatsApp}
                className={`flex flex-col items-center gap-1 group cursor-pointer ${
                  !hasWhatsApp ? 'opacity-40 cursor-not-allowed' : ''
                }`}
                title={hasWhatsApp ? 'Contactar por WhatsApp' : 'Sin WhatsApp registrado'}
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xl group-hover:scale-110 active:scale-95 transition-transform">
                  <WhatsAppIcon className="w-6 h-6 fill-white" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  WhatsApp
                </span>
              </button>

              {/* 3. Llamar */}
              <button
                type="button"
                id={`modal-btn-call-${post.id}`}
                onClick={handleCall}
                disabled={!callablePhone}
                className={`flex flex-col items-center gap-1 group cursor-pointer ${
                  !callablePhone ? 'opacity-40 cursor-not-allowed' : ''
                }`}
                title={callablePhone ? `Llamar a ${post.businessName}` : 'Sin teléfono registrado'}
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#0070f3] text-white flex items-center justify-center shadow-xl group-hover:scale-110 active:scale-95 transition-transform">
                  <Phone className="w-5 h-5 fill-white" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  Llamar
                </span>
              </button>

              {/* 4. Cómo llegar */}
              <button
                type="button"
                id={`modal-btn-maps-${post.id}`}
                onClick={handleMaps}
                disabled={!hasLocation}
                className={`flex flex-col items-center gap-1 group cursor-pointer ${
                  !hasLocation ? 'opacity-40 cursor-not-allowed' : ''
                }`}
                title={hasLocation ? 'Cómo llegar y ver en mapa' : 'Sin ubicación registrada'}
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#00b4d8] text-white flex items-center justify-center shadow-xl group-hover:scale-110 active:scale-95 transition-transform">
                  <Navigation className="w-5 h-5 fill-white ml-0.5" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-nowrap">
                  Cómo llegar
                </span>
              </button>

              {/* 5. Compartir */}
              <button
                type="button"
                id={`modal-btn-share-${post.id}`}
                onClick={handleShare}
                className="flex flex-col items-center gap-1 group cursor-pointer"
                title="Compartir anuncio"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-xl group-hover:scale-110 active:scale-95 transition-transform">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  Compartir
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 4. BOTTOM OVERLAY (Merchant, Title, Price, Validity, Desc & Bottom Actions) */}
        {/* ======================================================== */}
        <div className={`relative z-30 pb-4 sm:pb-5 px-3.5 sm:px-4 pointer-events-auto ${isBottomActions ? 'pr-3.5 sm:pr-4' : 'pr-20'}`}>
          {/* Business Name with Verified Checkmark & Avatar */}
          <div
            onClick={() => {
              if (onSelectBusiness) {
                pauseVideo();
                if (onClose) onClose();
                onSelectBusiness(post.businessId);
              }
            }}
            className={`inline-flex items-center gap-2 text-white font-extrabold text-sm sm:text-base tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
              onSelectBusiness ? 'hover:underline cursor-pointer' : ''
            }`}
          >
            {isBottomActions && (
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-md overflow-hidden shrink-0 flex items-center justify-center">
                {renderBusinessAvatar()}
              </div>
            )}
            <span>{post.businessName}</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400 fill-cyan-400/20 shrink-0" />
          </div>

          {/* Title */}
          <h1 className="text-white font-black text-lg sm:text-xl md:text-2xl leading-tight mt-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] line-clamp-2">
            {post.title}
          </h1>

          {/* Pricing Row Pill */}
          <div className="mt-2 inline-flex items-center gap-2 p-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 shadow-xl">
            {post.promotionalPrice ? (
              <>
                <span className="bg-emerald-500 text-white font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-full shadow-xs tracking-tight">
                  {formatCOPDisplay(post.promotionalPrice)}
                </span>
                {post.originalPrice && post.originalPrice > post.promotionalPrice && (
                  <span className="text-white/60 line-through text-xs font-semibold pr-2">
                    {formatCOPDisplay(post.originalPrice)}
                  </span>
                )}
              </>
            ) : post.originalPrice ? (
              <span className="text-white font-black text-xs sm:text-sm px-3 py-0.5">
                {formatCOPDisplay(post.originalPrice)}
              </span>
            ) : (
              <span className="text-emerald-300 font-bold text-xs px-2.5 py-0.5">
                Consultar precio
              </span>
            )}
          </div>

          {/* Validity / Expiry Tag */}
          {post.expiryLabel ? (
            <div className="mt-1.5 flex items-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e293b]/85 backdrop-blur-md border border-white/25 text-sky-200 text-xs font-bold shadow-lg">
                <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span className="truncate max-w-[260px] leading-tight">{post.expiryLabel}</span>
              </div>
            </div>
          ) : null}

          {/* Description - Aparece completa al abrir el anuncio */}
          {post.description ? (
            <div className="mt-2 max-h-32 sm:max-h-40 overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
              <p className="text-white/95 text-xs sm:text-[13px] leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-pre-line select-text">
                {post.description}
              </p>
            </div>
          ) : null}

          {/* Bottom Action Bar: WhatsApp, Llamar, Ubicación, Compartir, Generar QR */}
          {isBottomActions && (
            <div className="mt-3.5 pt-2.5 border-t border-white/20 grid grid-cols-5 gap-1.5 items-center justify-items-center">
              {/* 1. WhatsApp */}
              <button
                type="button"
                id={`bottom-btn-wa-${post.id}`}
                onClick={handleWhatsApp}
                disabled={!hasWhatsApp}
                className={`w-full flex flex-col items-center gap-1 group cursor-pointer transition ${
                  !hasWhatsApp ? 'opacity-40 cursor-not-allowed' : ''
                }`}
                title={hasWhatsApp ? 'Contactar por WhatsApp' : 'Sin WhatsApp registrado'}
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-transform">
                  <WhatsAppIcon className="w-5 h-5 fill-white" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate max-w-full text-center">
                  WhatsApp
                </span>
              </button>

              {/* 2. Llamar */}
              <button
                type="button"
                id={`bottom-btn-call-${post.id}`}
                onClick={handleCall}
                disabled={!callablePhone}
                className={`w-full flex flex-col items-center gap-1 group cursor-pointer transition ${
                  !callablePhone ? 'opacity-40 cursor-not-allowed' : ''
                }`}
                title={callablePhone ? `Llamar a ${post.businessName}` : 'Sin teléfono registrado'}
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#0070f3] text-white flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-transform">
                  <Phone className="w-4.5 h-4.5 fill-white" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate max-w-full text-center">
                  Llamar
                </span>
              </button>

              {/* 3. Ubicación */}
              <button
                type="button"
                id={`bottom-btn-maps-${post.id}`}
                onClick={handleMaps}
                disabled={!hasLocation}
                className={`w-full flex flex-col items-center gap-1 group cursor-pointer transition ${
                  !hasLocation ? 'opacity-40 cursor-not-allowed' : ''
                }`}
                title={hasLocation ? 'Ver ubicación en mapa' : 'Sin ubicación registrada'}
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#00b4d8] text-white flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-transform">
                  <Navigation className="w-4.5 h-4.5 fill-white ml-0.5" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate max-w-full text-center whitespace-nowrap">
                  Ubicación
                </span>
              </button>

              {/* 4. Compartir */}
              <button
                type="button"
                id={`bottom-btn-share-${post.id}`}
                onClick={handleShare}
                className="w-full flex flex-col items-center gap-1 group cursor-pointer transition"
                title="Compartir anuncio"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-transform">
                  <Share2 className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate max-w-full text-center">
                  Compartir
                </span>
              </button>

              {/* 5. Generar QR */}
              <button
                type="button"
                id={`bottom-btn-qr-${post.id}`}
                onClick={() => {
                  pauseVideo();
                  setIsQROpen(true);
                }}
                className="w-full flex flex-col items-center gap-1 group cursor-pointer transition"
                title="Generar código QR interactivo"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 border border-white/25 text-white flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-transform">
                  <QrCode className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate max-w-full text-center whitespace-nowrap">
                  Generar
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Location Map Modal */}
      {isLocationMapOpen && (
        <BusinessLocationMapModal
          isOpen={true}
          onClose={() => setIsLocationMapOpen(false)}
          business={{
            name: post.businessName || business?.name || '',
            address: post.businessAddress || business?.address || '',
            city: post.businessCity || business?.city || 'Cajicá',
            sector: post.businessSector || business?.sector || 'Centro',
            coordinates: post.coordinates || business?.coordinates,
            logo: businessLogo || business?.logo,
            category: post.category || business?.category,
            subCategory: post.subCategory || business?.subCategory,
            whatsapp: post.businessWhatsapp || business?.whatsapp,
            phone: post.businessPhone || business?.phone,
            verified: business?.verified ?? true,
          }}
        />
      )}

      {/* QR Coupon Modal */}
      {isQROpen && (
        <PostQRModal
          isOpen={isQROpen}
          onClose={() => setIsQROpen(false)}
          post={post}
          business={business}
        />
      )}

      {/* Toast de compartir / enlace copiado */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[4000] px-4 py-2.5 rounded-2xl bg-slate-900/95 text-white text-xs font-bold shadow-2xl border border-sky-400/40 backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>¡Enlace copiado al portapapeles listo para compartir!</span>
        </div>
      )}

      {/* Share Post Modal */}
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
