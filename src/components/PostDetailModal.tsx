import React, { useEffect } from 'react';
import { Post } from '../types';
import { PostDetailCard } from './PostDetailCard';

export interface PostDetailModalProps {
  post: Post | null;
  onClose: () => void;
  onSelectBusiness?: (businessId: string) => void;
  isBusinessSection?: boolean;
  onEditPost?: (post: Post) => void;
  fromBusinessProfile?: boolean;
  onSelectPost?: (post: Post) => void;
  onBackToProfile?: (businessId: string) => void;
  isPreview?: boolean;
  actionsLayout?: 'side' | 'bottom';
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  onClose,
  onSelectBusiness,
  isBusinessSection,
  onEditPost,
  fromBusinessProfile = false,
  onSelectPost,
  onBackToProfile,
  isPreview = false,
  actionsLayout,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!post) return null;

  return (
    <div
      id="post-detail-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[3200] flex items-center justify-center bg-[#040e28]/90 sm:bg-gradient-to-r sm:from-[#03153d]/95 sm:via-[#052264]/95 sm:to-[#0a3899]/95 backdrop-blur-md p-0 sm:p-2 animate-in fade-in duration-200 overflow-hidden select-none"
    >
      {/* Decorative ambient glow on desktop matching Reels */}
      <div className="hidden sm:block absolute -top-16 -left-16 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute -bottom-16 -right-16 w-96 h-96 bg-[#007af7]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Central Expansive Brand Watermark matching Reels */}
      <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none select-none overflow-hidden z-0">
        <img
          src="/Icono_Oleveci_sin_fondo.png?v=clean"
          alt=""
          aria-hidden="true"
          className="w-[740px] xl:w-[1000px] max-w-none h-auto object-contain opacity-[0.09] pointer-events-none"
        />
      </div>

      <div className="reel-container-9-16 relative z-10 w-full sm:w-auto h-[100dvh] sm:h-[calc(100dvh-68px)] sm:max-h-[920px] lg:max-h-[940px] sm:aspect-[9/16] max-w-full mx-auto rounded-none sm:rounded-3xl bg-black shadow-2xl border-0 sm:border sm:border-white/20 overflow-hidden flex flex-col transition-all">
        <PostDetailCard
          post={post}
          onClose={onClose}
          onSelectBusiness={onSelectBusiness}
          isBusinessSection={isBusinessSection}
          onEditPost={onEditPost}
          fromBusinessProfile={fromBusinessProfile}
          onSelectPost={onSelectPost}
          onBackToProfile={onBackToProfile}
          showCloseButton={true}
          actionsLayout={actionsLayout || 'bottom'}
          isPreview={isPreview}
          className="h-full w-full"
        />
      </div>
    </div>
  );
};
