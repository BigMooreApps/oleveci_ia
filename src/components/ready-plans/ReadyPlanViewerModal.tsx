import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SimulatedReadyPlan, resolvePlanPosts } from '../../data/readyPlansData';
import { Post } from '../../types';
import { ItineraryPlanCard } from '../ItineraryPlanCard';
import { PostDetailModal } from '../PostDetailModal';
import { SharePostModal } from '../SharePostModal';
import { useApp } from '../../context/AppContext';

export interface ReadyPlanViewerModalProps {
  plan: SimulatedReadyPlan | null;
  posts: Post[];
  currentCity: string;
  onClose: () => void;
  onSelectPost?: (post: Post) => void;
  onOpenItineraryBuilder?: (mode?: 'automatic' | 'manual' | 'mode_select') => void;
  initialTab?: 'card' | 'map';
}

export const ReadyPlanViewerModal: React.FC<ReadyPlanViewerModalProps> = ({
  plan,
  posts,
  currentCity,
  onClose,
  onSelectPost,
  onOpenItineraryBuilder,
  initialTab = 'card',
}) => {
  const { addReadyPlan } = useApp();
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!plan) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [plan]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!plan) return null;

  const modalPosts = resolvePlanPosts(plan, posts);

  const handleSavePlan = () => {
    if (!plan) return;
    addReadyPlan(plan);
    setIsSaved(true);
  };

  const handleOpenDesigner = () => {
    onClose();
    if (onOpenItineraryBuilder) {
      onOpenItineraryBuilder('manual');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[2000] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-lg sm:max-w-xl my-auto animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Floating Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-3 -right-3 sm:-top-3.5 sm:-right-3.5 z-50 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white flex items-center justify-center shadow-xl border border-white/20 active:scale-90 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Unified Itinerary Card Matching image design */}
          <ItineraryPlanCard
            planTitle={plan.planTitle}
            narrativeHook={plan.personalNote}
            stops={modalPosts}
            currentCity={plan.municipality || currentCity}
            totalEstimatedCost={plan.estimatedBudget}
            onSelectPost={(p) => {
              if (onSelectPost) {
                onSelectPost(p);
              } else {
                setPreviewPost(p);
              }
            }}
            onSharePlan={() => setIsShareModalOpen(true)}
            onSavePlan={handleSavePlan}
            onOpenDesigner={handleOpenDesigner}
            isSaved={isSaved}
            initialRouteExpanded={initialTab === 'map'}
          />
        </div>
      </div>

      {previewPost && (
        <PostDetailModal
          post={previewPost}
          onClose={() => setPreviewPost(null)}
          onSelectPost={(nextPost) => setPreviewPost(nextPost)}
        />
      )}

      {isShareModalOpen && plan && (
        <SharePostModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          plan={plan}
          planStops={modalPosts}
        />
      )}
    </>
  );
};
