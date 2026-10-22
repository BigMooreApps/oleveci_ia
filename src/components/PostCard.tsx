import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Post } from '../types';
import { useApp } from '../context/AppContext';
import { Clock, Calendar, Film, MapPin } from 'lucide-react';
import { parseVideoUrl, ParsedVideoInfo } from '../utils/videoHelper';
import { getFeedCardImageUrl, getMobileCardImageUrl, getBlurBackdropUrl, getAvatarUrl } from '../utils/imageOptimization';

interface PostCardProps {
  post: Post;
  onSelectPost: (post: Post) => void;
  onSelectBusiness?: (businessId: string) => void;
  compact?: boolean;
  viewMode?: 'grid' | 'list';
  className?: string;
  cardVariant?: 'default' | 'hero' | 'tall';
  priority?: boolean;
  autoPreview?: boolean;
  isFocused?: boolean;
  isManualPreviewActive?: boolean;
  onToggleManualPreview?: () => void;
  onQuickPeek?: (post: Post) => void;
}

interface CardVideoPreviewProps {
  post: Post;
  parsedVideo: ParsedVideoInfo;
  isHovered: boolean;
  isPreviewActive?: boolean;
  imageFit?: 'cover' | 'contain';
  imagePosition?: { x: number; y: number };
  imageScale?: number;
  className?: string;
  onToggleManualPreview?: () => void;
  isManualPreviewActive?: boolean;
}

const isVideoWebpageUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return (
    url.includes('tiktok.com/') ||
    url.includes('instagram.com/') ||
    url.includes('facebook.com/') ||
    url.includes('fb.watch/') ||
    url.includes('youtube.com/') ||
    url.includes('youtu.be/') ||
    /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url)
  );
};

const CardVideoPreview: React.FC<CardVideoPreviewProps> = ({
  post,
  parsedVideo,
  isHovered,
  isPreviewActive = false,
  imageFit = 'cover',
  imagePosition,
  imageScale,
  className = '',
  onToggleManualPreview,
  isManualPreviewActive = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const shouldPlay = isHovered || Boolean(isPreviewActive) || Boolean(isManualPreviewActive);
  const canUseNativeVideo = Boolean(parsedVideo.streamUrl || !parsedVideo.isIframe);
  const videoSrc = parsedVideo.streamUrl || parsedVideo.directUrl || post.videoUrl || '';

  const hasValidDirectImage = Boolean(post.imageUrl && !isVideoWebpageUrl(post.imageUrl) && !imgError);
  const posterUrl = hasValidDirectImage
    ? getFeedCardImageUrl(post.imageUrl)
    : (!thumbError ? parsedVideo.defaultThumbnail : undefined);

  const handleImgError = () => {
    if (hasValidDirectImage) {
      setImgError(true);
    } else {
      setThumbError(true);
    }
  };

  // Autoplay without sound when shouldPlay is active, pause and rewind on release
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canUseNativeVideo || !videoSrc) return;

    if (shouldPlay) {
      video.muted = true;
      video.volume = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            if (video) {
              video.muted = true;
              video.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          });
      }
    } else {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {}
      setIsPlaying(false);
    }
  }, [shouldPlay, canUseNativeVideo, videoSrc]);

  return (
    <div className={`relative w-full h-full bg-slate-950 overflow-hidden select-none ${className}`}>
      {/* 1. Base Poster Image */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          onError={handleImgError}
          className={`w-full h-full select-none transition-opacity duration-300 ${
            (isPlaying || shouldPlay) && (videoLoaded || parsedVideo.isIframe) ? 'opacity-0' : 'opacity-100'
          } ${(post.imageFit || 'cover') === 'contain' ? 'object-contain' : 'object-cover'}`}
          style={{
            objectPosition: post.imagePosition ? `${post.imagePosition.x}% ${post.imagePosition.y}%` : '50% 50%',
            transform: post.imageScale && post.imageScale !== 1 ? `scale(${post.imageScale})` : undefined,
            transformOrigin: post.imagePosition ? `${post.imagePosition.x}% ${post.imagePosition.y}%` : '50% 50%',
          }}
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Ambient background if no image or image error */}
      {!posterUrl && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950/60 to-slate-900 flex items-center justify-center pointer-events-none">
          <Film className="w-8 h-8 text-cyan-500/20" />
        </div>
      )}

      {/* 2. HTML5 Video Stream Player (Mounted & streamed ONLY when active/shouldPlay to maximize mobile performance) */}
      {canUseNativeVideo && videoSrc && shouldPlay ? (
        <video
          ref={videoRef}
          src={videoSrc}
          poster={posterUrl}
          muted
          loop
          playsInline
          preload="auto"
          onLoadedData={() => setVideoLoaded(true)}
          onPlaying={() => {
            setVideoLoaded(true);
            setIsPlaying(true);
          }}
          className={`absolute inset-0 w-full h-full select-none pointer-events-none transition-opacity duration-300 z-1 ${
            isPlaying ? 'opacity-100' : posterUrl ? 'opacity-0' : 'opacity-100'
          } ${(post.videoFit || post.imageFit || 'cover') === 'contain' ? 'object-contain' : 'object-cover'}`}
          style={{
            objectPosition: (post.videoPosition || post.imagePosition) ? `${(post.videoPosition || post.imagePosition)!.x}% ${(post.videoPosition || post.imagePosition)!.y}%` : '50% 50%',
            transform: (post.videoScale || post.imageScale) && (post.videoScale || post.imageScale) !== 1 ? `scale(${post.videoScale || post.imageScale})` : undefined,
            transformOrigin: (post.videoPosition || post.imagePosition) ? `${(post.videoPosition || post.imagePosition)!.x}% ${(post.videoPosition || post.imagePosition)!.y}%` : '50% 50%',
          }}
        />
      ) : parsedVideo.isIframe && shouldPlay && parsedVideo.embedUrl ? (
        /* Fallback for YouTube or other iframes when hovered/active: Overbleed cropped so NO YouTube title, channel, "Guardar", "Silencio", or shortcut links are visible */
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-1 bg-black">
          <iframe
            src={`${parsedVideo.embedUrl}${parsedVideo.embedUrl.includes('?') ? '&' : '?'}autoplay=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3`}
            scrolling="no"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            className={`border-0 pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${
              parsedVideo.isVertical
                ? 'w-[144%] h-[154%]'
                : 'w-[250%] h-[130%]'
            }`}
            style={{
              transform: (post.videoScale || post.imageScale) && (post.videoScale || post.imageScale) !== 1 ? `scale(${post.videoScale || post.imageScale}) translate(-50%, -50%)` : undefined,
              transformOrigin: 'center center',
            }}
            tabIndex={-1}
            title={post.title}
          />
        </div>
      ) : null}
    </div>
  );
};

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onSelectPost,
  onSelectBusiness,
  compact,
  viewMode,
  className = '',
  cardVariant = 'default',
  priority = false,
  autoPreview = false,
  isFocused,
  isManualPreviewActive,
  onToggleManualPreview,
  onQuickPeek,
}) => {
  const {
    trackInteraction,
  } = useApp();

  const articleRef = useRef<HTMLElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [localManualPreview, setLocalManualPreview] = useState(false);

  const effectiveManualPreview =
    isManualPreviewActive !== undefined ? isManualPreviewActive : localManualPreview;

  const handleToggleManualPreview = () => {
    if (onToggleManualPreview) {
      onToggleManualPreview();
    } else {
      setLocalManualPreview((prev) => !prev);
    }
  };

  // Touch gesture state for long-press preview peek
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef<boolean>(false);

  // Fallback IntersectionObserver: only active when isFocused is NOT managed by parent
  useEffect(() => {
    if (isFocused !== undefined || !autoPreview || !post.videoUrl) {
      setIsInViewport(false);
      return;
    }

    const el = articleRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            setIsInViewport(true);
          } else {
            setIsInViewport(false);
          }
        });
      },
      {
        threshold: [0, 0.5, 0.8],
        rootMargin: '0px 0px -10% 0px',
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [autoPreview, post.videoUrl, isFocused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!onQuickPeek) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isLongPressTriggered.current = false;

    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(40);
        }
      } catch {}
      onQuickPeek(post);
    }, 380);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchStartPos.current.x);
    const diffY = Math.abs(touch.clientY - touchStartPos.current.y);

    // Cancel if moved more than 8px so normal scrolling stays 100% smooth
    if (diffX > 8 || diffY > 8) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Only the single focused card (or hovered / manually toggled) plays preview
  const isAutoPreviewActive =
    autoPreview && (isFocused !== undefined ? isFocused : isInViewport);

  const isPreviewActive =
    isHovered || Boolean(effectiveManualPreview) || Boolean(isAutoPreviewActive);

  const isGrid = viewMode === 'grid' || compact;
  const isCompact = Boolean(compact);

  // Discount percentage calculation
  const discountPercent =
    post.originalPrice && post.promotionalPrice && post.originalPrice > post.promotionalPrice
      ? Math.round(((post.originalPrice - post.promotionalPrice) / post.originalPrice) * 100)
      : null;

  // Check if badge is people/capacity related or time related
  const isCapacityBadge =
    post.expiryLabel &&
    (post.expiryLabel.toLowerCase().includes('cupo') ||
      post.expiryLabel.toLowerCase().includes('persona') ||
      post.expiryLabel.toLowerCase().includes('disponible') ||
      post.expiryLabel.toLowerCase().includes('abierto'));

  const isCalendarBadge =
    post.validitySchedule?.mode === 'days_of_week' ||
    post.validitySchedule?.mode === 'specific_date' ||
    Boolean(
      post.expiryLabel &&
      (post.expiryLabel.toLowerCase().includes('lunes') ||
        post.expiryLabel.toLowerCase().includes('martes') ||
        post.expiryLabel.toLowerCase().includes('miércoles') ||
        post.expiryLabel.toLowerCase().includes('jueves') ||
        post.expiryLabel.toLowerCase().includes('viernes') ||
        post.expiryLabel.toLowerCase().includes('sábado') ||
        post.expiryLabel.toLowerCase().includes('domingo') ||
        post.expiryLabel.toLowerCase().includes('semana') ||
        post.expiryLabel.toLowerCase().includes('hasta el'))
    );

  const parsedVideo = parseVideoUrl(post.videoUrl);

  const handleCardClick = () => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }
    trackInteraction(post.id, 'view');
    onSelectPost(post);
  };

  const handleBusinessClick = (e: React.MouseEvent) => {
    if (onSelectBusiness && post.businessId) {
      e.stopPropagation();
      onSelectBusiness(post.businessId);
    }
  };

  // Dedicated layout for Business Profile Modal (compact=true)
  // Reorganized to prevent visual crowding ("amontonamiento"):
  // - Removes redundant business header (since user is already inside that business profile)
  // - Gives the image generous breathing room with full-bleed top media
  // - Places discount and bookmark neatly in top corners
  // - Clean schedule/expiry pill at bottom of image
  // - Clear title, description, price badge and proportional CTA button
  if (isCompact) {
    return (
      <motion.article
        ref={articleRef as any}
        id={`post-card-compact-${post.id}`}
        data-card-post-id={post.id}
        data-has-video={Boolean(post.videoUrl)}
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 380, damping: 25 }}
        className="group w-full bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 shadow-2xs hover:shadow-md flex flex-col overflow-hidden transition-all duration-300 cursor-pointer select-none"
      >
        {/* Top Media Container */}
        <div className="relative w-full aspect-[4/5] bg-slate-100 overflow-hidden select-none">
          {post.videoUrl ? (
            <CardVideoPreview
              post={post}
              parsedVideo={parsedVideo}
              isHovered={isHovered}
              isPreviewActive={isPreviewActive}
              imageFit={post.imageFit}
              imagePosition={post.imagePosition}
              imageScale={post.imageScale}
              onToggleManualPreview={handleToggleManualPreview}
              isManualPreviewActive={effectiveManualPreview}
            />
          ) : post.imageUrl ? (
            <>
              {/* Ambient backdrop when contain */}
              {(post.imageFit === 'contain' || (post.imageScale && post.imageScale < 1)) && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                  <img
                    alt=""
                    className="w-full h-full object-cover blur-xl scale-125 opacity-40"
                    style={{
                      objectPosition: post.imagePosition
                        ? `${post.imagePosition.x}% ${post.imagePosition.y}%`
                        : '50% 50%',
                    }}
                    src={getBlurBackdropUrl(post.imageUrl)}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/40" />
                </div>
              )}
              <img
                alt={post.title}
                className={`w-full h-full transform group-hover:scale-105 transition-transform duration-500 ease-out relative z-1 ${
                  post.imageFit === 'contain' ? 'object-contain' : 'object-cover'
                }`}
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
                src={getMobileCardImageUrl(post.imageUrl, 380, 70)}
                referrerPolicy="no-referrer"
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={priority ? 'high' : 'auto'}
              />
            </>
          ) : (
            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">
              Sin foto
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

          {/* Top-Left Discount Badge */}
          {discountPercent ? (
            <div className="absolute top-2 left-2 z-20">
              <span
                className="px-2.5 py-1 rounded-full text-xs font-black text-white flex items-center justify-center tracking-tight shadow-md gap-1"
                style={{
                  background: 'linear-gradient(135deg, #ff6a00 0%, #ff3b00 50%, #d81c00 100%)',
                  boxShadow: '0 3px 10px rgba(220, 30, 0, 0.4)',
                }}
              >
                <span>🔥</span>
                <span>-{discountPercent}%</span>
              </span>
            </div>
          ) : null}

          {/* Bottom-Left Expiry / Availability Pill */}
          {post.expiryLabel ? (
            <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center gap-1 text-[9.5px] font-bold text-white bg-black/65 backdrop-blur-md px-2 py-0.5 rounded-full w-fit max-w-[92%] border border-white/20">
              {isCapacityBadge ? (
                <svg className="w-3 h-3 text-teal-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              ) : isCalendarBadge ? (
                <Calendar className="w-3 h-3 text-sky-300 shrink-0" />
              ) : (
                <Clock className="w-3 h-3 text-amber-300 shrink-0" />
              )}
              <span className="truncate">{post.expiryLabel}</span>
            </div>
          ) : null}
        </div>

        {/* Content Body: Title and Description */}
        <div className="p-2.5 sm:p-3 flex flex-col flex-grow justify-start">
          <h3 className="text-xs sm:text-[13px] font-extrabold text-[#0C1D37] group-hover:text-[#007af7] leading-snug line-clamp-2 transition-colors">
            {post.title}
          </h3>
          {post.description && (
            <p className="text-[10px] sm:text-[11px] text-slate-500 line-clamp-2 mt-1 leading-tight">
              {post.description}
            </p>
          )}
        </div>
      </motion.article>
    );
  }

  // Dedicated layout for Descubrir List View (matching Directorio & Itinerarios)
  if (viewMode === 'list') {
    return (
      <motion.article
        ref={articleRef as any}
        id={`post-card-list-${post.id}`}
        data-card-post-id={post.id}
        data-has-video={Boolean(post.videoUrl)}
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 380, damping: 25 }}
        className={`group w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all duration-200 p-2.5 sm:p-3.5 flex flex-row items-stretch gap-3 sm:gap-4.5 cursor-pointer select-none overflow-hidden ${className}`}
      >
        {/* Left: Media Thumbnail (9:16 Compact Format, well-balanced) */}
        <div className="w-20 xs:w-24 sm:w-28 md:w-32 shrink-0 relative rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 aspect-[9/16] select-none">
          {post.videoUrl ? (
            <CardVideoPreview
              post={post}
              parsedVideo={parsedVideo}
              isHovered={isHovered}
              isPreviewActive={isPreviewActive}
              imageFit={post.imageFit}
              imagePosition={post.imagePosition}
              imageScale={post.imageScale}
              onToggleManualPreview={handleToggleManualPreview}
              isManualPreviewActive={effectiveManualPreview}
            />
          ) : post.imageUrl ? (
            <>
              {(post.imageFit === 'contain' || (post.imageScale && post.imageScale < 1)) && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                  <img
                    alt=""
                    className="w-full h-full object-cover blur-xl scale-125 opacity-40"
                    src={getBlurBackdropUrl(post.imageUrl)}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/40" />
                </div>
              )}
              <img
                alt={post.title}
                className={`w-full h-full transform group-hover:scale-105 transition-transform duration-500 ease-out relative z-1 ${
                  post.imageFit === 'contain' ? 'object-contain' : 'object-cover'
                }`}
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
                src={getMobileCardImageUrl(post.imageUrl, 400, 75)}
                referrerPolicy="no-referrer"
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={priority ? 'high' : 'auto'}
              />
            </>
          ) : (
            <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">
              Sin foto
            </div>
          )}

          {/* Top-Left Discount Badge */}
          {discountPercent ? (
            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-20">
              <span
                className="px-2.5 py-1 rounded-full text-xs sm:text-sm font-black text-white flex items-center justify-center shadow-md leading-none gap-1"
                style={{
                  background: 'linear-gradient(135deg, #ff6a00 0%, #ff3b00 50%, #d81c00 100%)',
                  boxShadow: '0 3px 10px rgba(220, 30, 0, 0.4)',
                }}
              >
                <span>🔥</span>
                <span>-{discountPercent}%</span>
              </span>
            </div>
          ) : null}

          {/* Expiry / Availability Pill on thumbnail for screens that have space */}
          {post.expiryLabel ? (
            <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20 hidden xs:flex items-center gap-1 text-[8.5px] sm:text-[9.5px] font-bold text-white bg-black/65 backdrop-blur-md px-1.5 py-0.5 rounded-full w-fit max-w-[95%] border border-white/20">
              {isCapacityBadge ? (
                <svg className="w-2.5 h-2.5 text-teal-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              ) : isCalendarBadge ? (
                <Calendar className="w-2.5 h-2.5 text-sky-300 shrink-0" />
              ) : (
                <Clock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
              )}
              <span className="truncate">{post.expiryLabel}</span>
            </div>
          ) : null}
        </div>

        {/* Right: Content details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 sm:py-1 gap-1.5 sm:gap-2">
          {/* Header & Titles */}
          <div className="space-y-1">
            {/* Merchant Identity & Municipality/Sector */}
            <div className="flex items-center justify-between gap-2">
              <div
                onClick={handleBusinessClick}
                className="flex items-center gap-1.5 min-w-0 group/biz hover:opacity-85 transition cursor-pointer"
                title={post.businessName ? `Ver perfil de ${post.businessName}` : undefined}
              >
                {post.businessLogo ? (
                  <img
                    src={getAvatarUrl(post.businessLogo)}
                    alt={post.businessName || ''}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg object-cover border border-slate-200 bg-white shrink-0 shadow-2xs"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-[#041f5e] text-white flex items-center justify-center font-bold text-[9px] sm:text-[10px] shrink-0 shadow-2xs">
                    {(post.businessName || 'OV').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover/biz:text-[#0056d6] transition-colors truncate">
                  {post.businessName || 'Comercio local'}
                </span>
              </div>

              {/* Location Badge */}
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium shrink-0 flex items-center gap-0.5">
                <MapPin className="w-3 h-3 text-[#ff7700] shrink-0" />
                <span className="truncate max-w-[100px] sm:max-w-none">
                  {post.businessSector || post.businessCity || 'Cajicá'}
                </span>
              </span>
            </div>

            {/* Post Title */}
            <h3 className="text-xs sm:text-base font-extrabold text-[#0C1D37] group-hover:text-[#0056d6] transition-colors leading-snug line-clamp-1 sm:line-clamp-2">
              {post.title}
            </h3>

            {/* Post Description */}
            {post.description && (
              <p className="text-[10.5px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                {post.description}
              </p>
            )}
          </div>

          {/* Footer: Price, Schedule Pill & Action */}
          <div className="pt-1.5 sm:pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Pricing */}
              {post.promotionalPrice ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs sm:text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/80">
                    ${post.promotionalPrice.toLocaleString('es-CO')}
                  </span>
                  {post.originalPrice && post.originalPrice > post.promotionalPrice ? (
                    <span className="text-[10px] sm:text-xs text-slate-400 line-through font-medium">
                      ${post.originalPrice.toLocaleString('es-CO')}
                    </span>
                  ) : null}
                </div>
              ) : post.originalPrice ? (
                <span className="text-xs sm:text-sm font-extrabold text-[#031c54] bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/80">
                  ${post.originalPrice.toLocaleString('es-CO')}
                </span>
              ) : (
                <span className="text-[10px] sm:text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/60">
                  Consultar oferta
                </span>
              )}

              {/* Mobile fallback for expiry */}
              {post.expiryLabel ? (
                <span className="xs:hidden inline-flex items-center gap-1 text-[9px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200/60 font-semibold truncate max-w-[130px]">
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{post.expiryLabel}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      ref={articleRef as any}
      id={`post-card-${post.id}`}
      data-card-post-id={post.id}
      data-has-video={Boolean(post.videoUrl)}
      onClick={handleCardClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-purpose="gym-promotion-card"
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 380, damping: 25 }}
      className={`group w-full ${className ? className : isCompact ? 'max-w-none' : 'max-w-none'} bg-white ${
        isCompact
          ? 'rounded-[16px] sm:rounded-[20px] p-2 sm:p-2.5 pb-2.5 sm:pb-3'
          : isGrid
          ? 'rounded-[16px] sm:rounded-[22px] p-2 sm:p-2.5 pb-2.5 sm:pb-3'
          : 'rounded-[22px] sm:rounded-[26px] p-2.5 sm:p-3 pb-3 sm:pb-4'
      } card-elevation border border-slate-200/90 hover:border-blue-300 flex flex-col relative overflow-hidden transition-all duration-300 cursor-pointer select-none`}
    >
      {/* 1. Main Media Container */}
      <div
        style={
          post.mediaBgFill === 'fixed'
            ? {
                background: 'linear-gradient(180deg, #00163A 0%, #001D4A 50%, #001026 100%)',
              }
            : undefined
        }
        className={`relative w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-inner ${post.mediaBgFill === 'fixed' ? 'bg-[#001D4A]' : 'bg-slate-100'} mb-1.5 sm:mb-2 select-none aspect-[4/5]`}
      >
        {post.videoUrl ? (
          <CardVideoPreview
            post={post}
            parsedVideo={parsedVideo}
            isHovered={isHovered}
            isPreviewActive={isPreviewActive}
            imageFit={post.imageFit}
            imagePosition={post.imagePosition}
            imageScale={post.imageScale}
            onToggleManualPreview={handleToggleManualPreview}
            isManualPreviewActive={effectiveManualPreview}
          />
        ) : post.imageUrl ? (
          <>
            {/* Ambient backdrop when contained or scaled down to fill predefined space (Ultra-light 48px) */}
            {(post.imageFit === 'contain' || (post.imageScale && post.imageScale < 1)) && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                <img
                  alt=""
                  className="w-full h-full object-cover blur-2xl scale-120 opacity-40"
                  style={{
                    objectPosition: post.imagePosition
                      ? `${post.imagePosition.x}% ${post.imagePosition.y}%`
                      : '50% 50%',
                    filter: post.imageFilter && post.imageFilter !== 'none' ? `${post.imageFilter} blur(24px)` : 'blur(24px)',
                  }}
                  src={getBlurBackdropUrl(post.imageUrl)}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-black/40" />
              </div>
            )}
            <img
              alt={post.title}
              className={`w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out relative z-1 ${
                post.imageFit === 'contain' ? 'object-contain' : 'object-cover'
              }`}
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
              src={isGrid ? getMobileCardImageUrl(post.imageUrl, 380, 70) : getFeedCardImageUrl(post.imageUrl)}
              referrerPolicy="no-referrer"
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : 'auto'}
            />
          </>
        ) : (
          <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">
            Sin foto
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/15 pointer-events-none group-hover:opacity-85 transition-opacity duration-300" />

        {/* Top-Right Decorative Curve / Swoosh Gradient */}
        <div
          className={`absolute top-0 right-0 ${
            isCompact ? 'w-10 h-10' : isGrid ? 'w-10 h-10 sm:w-20 sm:h-20' : 'w-20 h-20'
          } pointer-events-none select-none z-10 overflow-hidden rounded-tr-xl sm:rounded-tr-2xl transition-transform duration-500 group-hover:scale-110 group-hover:opacity-95`}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={`topCornerGrad-${post.id}`} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0060E6" />
                <stop offset="40%" stopColor="#0099FF" />
                <stop offset="75%" stopColor="#00CFFF" />
                <stop offset="100%" stopColor="#1BE0F8" />
              </linearGradient>
            </defs>
            <path d="M 0 0 C 45 0, 80 18, 100 68 L 100 0 Z" fill={`url(#topCornerGrad-${post.id})`} />
          </svg>
        </div>

        {/* 3D Diagonal Discount Badge with Sunburst Spark Rays */}
        {discountPercent ? (
          <div
            className={`absolute select-none z-10 transition-transform duration-300 ease-out ${
              isCompact ? 'left-1 top-1.5' : isGrid ? 'left-1 top-1.5 sm:left-2 sm:top-2' : 'left-2.5 top-3'
            }`}
            style={{
              display: 'inline-flex',
              zIndex: 20,
              transform: isCompact ? 'rotate(-10deg) scale(0.65)' : isGrid ? 'rotate(-10deg) scale(0.68) sm:scale(0.74)' : 'rotate(-12deg) scale(0.80)',
              transformOrigin: 'top left',
            }}
          >
            <div className="relative flex items-center group-hover:scale-105 group-hover:rotate-1 transition-transform duration-300">
              <div
                className={`relative z-10 text-white font-black ${
                  isCompact ? 'text-xs px-2 py-1' : isGrid ? 'text-xs sm:text-sm px-2 py-1 sm:px-2.5 sm:py-1' : 'text-base px-3 py-1.5'
                } tracking-tight rounded-full flex items-center justify-center leading-none transition-shadow duration-300 group-hover:shadow-[0_6px_22px_rgba(230,60,0,0.65)]`}
                style={{
                  background: 'linear-gradient(rgb(255, 179, 0) 0%, rgb(255, 145, 0) 35%, rgb(240, 80, 0) 70%, rgb(230, 57, 0) 100%)',
                  boxShadow: 'rgba(230, 60, 0, 0.52) 0px 4px 16px, rgba(0, 0, 0, 0.22) 0px 2px 6px, rgba(255, 255, 255, 0.65) 0px 1.5px 1.5px inset, rgba(180, 30, 0, 0.4) 0px -1.5px 2px inset',
                  textShadow: 'rgba(150, 20, 0, 0.45) 0px 1px 2px',
                }}
              >
                -{discountPercent}%
              </div>
              <div className={`absolute -top-1.5 -right-1 pointer-events-none ${isCompact ? 'w-4 h-4' : isGrid ? 'w-4 h-4 sm:w-4.5 sm:h-4.5' : 'w-5 h-5'} flex items-center justify-center z-0 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12`}>
                <svg className="w-full h-full overflow-visible" viewBox="0 0 32 32" fill="none" stroke="#FFB300" strokeLinecap="round">
                  <line x1="15" y1="16" x2="24" y2="6" strokeWidth="2.8" />
                  <line x1="18" y1="20" x2="30" y2="18" strokeWidth="2.8" />
                  <line x1="11" y1="14" x2="13" y2="3" strokeWidth="2.8" />
                </svg>
              </div>
            </div>
          </div>
        ) : null}

        {/* Bottom-Left Pill: Expiry / Availability / Schedule */}
        {post.expiryLabel ? (
          <div
            className={`absolute bottom-1.5 left-1.5 ${isCompact ? '' : 'sm:bottom-2 sm:left-2'} z-20 bg-gradient-to-r from-teal-500 to-cyan-500/95 text-white ${
              isCompact ? 'text-[7.5px] px-1.5 py-0.5' : isGrid ? 'text-[7.5px] sm:text-[9.5px] px-1.5 py-0.5 sm:px-2.5 sm:py-1' : 'text-xs px-3 py-1.5'
            } font-bold rounded-full flex items-center gap-1 sm:gap-1.5 shadow-md backdrop-blur-sm border border-white/25 max-w-[90%] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg`}
          >
            {isCapacityBadge ? (
              <svg className={`${isCompact ? 'w-2.5 h-2.5' : isGrid ? 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5' : 'w-4 h-4'} text-white shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            ) : isCalendarBadge ? (
              <Calendar className={`${isCompact ? 'w-2.5 h-2.5' : isGrid ? 'w-2.5 h-2.5 sm:w-3 sm:h-3' : 'w-3.5 h-3.5'} text-white shrink-0`} />
            ) : (
              <Clock className={`${isCompact ? 'w-2.5 h-2.5' : isGrid ? 'w-2.5 h-2.5 sm:w-3 sm:h-3' : 'w-3.5 h-3.5'} text-white shrink-0`} />
            )}
            <span className="truncate">{post.expiryLabel}</span>
          </div>
        ) : null}
      </div>

      {/* 2. Title and Description */}
      <div className="relative flex-grow flex flex-col justify-start pt-0.5 pb-1">
        <div className="relative z-10 pr-0.5 sm:pr-1">
          <h2
            className="text-[12px] sm:text-sm font-extrabold text-[#0A1D3C] group-hover:text-[#004dc9] leading-tight sm:leading-snug tracking-tight line-clamp-2 transition-colors duration-200"
            style={{ color: 'rgb(8, 28, 68)' }}
          >
            {post.title}
          </h2>
          {post.description && (
            <p className="text-[9.5px] sm:text-[11px] text-slate-500 line-clamp-2 font-normal leading-tight mt-0.5">
              {post.description}
            </p>
          )}
        </div>
      </div>
    </motion.article>
  );
};
