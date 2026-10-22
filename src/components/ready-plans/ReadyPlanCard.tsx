import React from 'react';
import { motion } from 'motion/react';
import { Clock, MapPin, Route } from 'lucide-react';
import { SimulatedReadyPlan, resolvePlanPosts } from '../../data/readyPlansData';
import { Post } from '../../types';
import { PlanBackgroundImages } from '../InvitationCardPreview';

export interface ReadyPlanCardProps {
  plan: SimulatedReadyPlan;
  posts: Post[];
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  viewMode?: 'grid' | 'list';
}

export const ReadyPlanCard: React.FC<ReadyPlanCardProps> = ({
  plan,
  posts,
  onClick,
  className = '',
  style,
  priority = false,
  viewMode = 'grid',
}) => {
  const planPosts = resolvePlanPosts(plan, posts);
  const descriptionText = plan.personalNote || planPosts.map((p) => p.businessName).join(', ');

  // Dedicated layout for List View (matching Descubrir list view 1:1)
  if (viewMode === 'list') {
    return (
      <motion.article
        onClick={onClick}
        style={style}
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 380, damping: 25 }}
        className={`group w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all duration-200 p-2.5 sm:p-3.5 flex flex-row items-stretch gap-3 sm:gap-4.5 cursor-pointer select-none overflow-hidden ${className}`}
        title={`Toca para ver el plan: ${plan.planTitle}`}
      >
        {/* Left: Media Thumbnail (9:16 Compact Format, well-balanced) */}
        <div className="w-20 xs:w-24 sm:w-28 md:w-32 shrink-0 relative rounded-xl sm:rounded-2xl overflow-hidden bg-slate-900 aspect-[9/16] select-none">
          <PlanBackgroundImages
            posts={planPosts}
            bgLayout={plan.bgLayout || 'horizontal'}
            theme={plan.theme}
            priority={priority}
            targetWidth={320}
            imageClassName="group-hover:scale-105 transition-transform duration-500 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

          {/* Top-Left Paradas Badge */}
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-20">
            <span
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black text-white flex items-center justify-center shadow-md leading-none gap-1"
              style={{
                background: 'linear-gradient(135deg, #ff6a00 0%, #ff3b00 50%, #d81c00 100%)',
                boxShadow: '0 3px 10px rgba(220, 30, 0, 0.4)',
              }}
            >
              <span>{planPosts.length} PARADAS</span>
            </span>
          </div>

          {/* Expiry / Availability / Schedule Pill */}
          {plan.scheduledTime && (
            <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20 hidden xs:flex items-center gap-1 text-[8.5px] sm:text-[9.5px] font-bold text-white bg-black/65 backdrop-blur-md px-1.5 py-0.5 rounded-full w-fit max-w-[95%] border border-white/20">
              <Clock className="w-2.5 h-2.5 text-cyan-300 shrink-0" />
              <span className="truncate">{plan.scheduledTime}</span>
            </div>
          )}
        </div>

        {/* Right: Content details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 sm:py-1 gap-1.5 sm:gap-2">
          {/* Header & Titles */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-5 h-5 rounded-md bg-[#0056D6] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-[10px]">
                  <Route className="w-3 h-3 text-white" strokeWidth={2.4} />
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                  Itinerario Vecinal
                </span>
              </div>

              {/* Location Badge */}
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium shrink-0 flex items-center gap-0.5">
                <MapPin className="w-3 h-3 text-[#ff7700] shrink-0" />
                <span className="truncate max-w-[100px] sm:max-w-none">
                  {plan.municipality || 'Cajicá'}
                </span>
              </span>
            </div>

            {/* Plan Title */}
            <h3 className="text-xs sm:text-base font-extrabold text-[#0C1D37] group-hover:text-[#0056d6] transition-colors leading-snug line-clamp-1 sm:line-clamp-2">
              {plan.planTitle}
            </h3>

            {/* Description */}
            {descriptionText && (
              <p className="text-[10.5px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                {descriptionText}
              </p>
            )}
          </div>

          {/* Footer: Budget & Schedule */}
          <div className="pt-1.5 sm:pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/80">
                Presupuesto est.: ${plan.estimatedBudget.toLocaleString('es-CO')}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/60">
                {planPosts.length} paradas
              </span>
            </div>

            {plan.scheduledTime && (
              <span className="xs:hidden inline-flex items-center gap-1 text-[9px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200/60 font-semibold truncate max-w-[130px]">
                <Clock className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{plan.scheduledTime}</span>
              </span>
            )}
          </div>
        </div>
      </motion.article>
    );
  }

  // Grid View layout (matches Descubrir cards 1:1)
  return (
    <motion.article
      onClick={onClick}
      style={style}
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 380, damping: 25 }}
      className={`group w-full max-w-none bg-white rounded-[16px] sm:rounded-[22px] p-2 sm:p-2.5 pb-2.5 sm:pb-3 card-elevation border border-slate-200/90 hover:border-blue-300 flex flex-col relative overflow-hidden transition-all duration-300 cursor-pointer select-none ${className}`}
      title={`Toca para ver el plan: ${plan.planTitle}`}
    >
      {/* 1. Main Media Container (Aspect 4/5, rounded corners with equal padding around) */}
      <div className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-inner bg-slate-100 mb-1.5 sm:mb-2 select-none aspect-[4/5]">
        <PlanBackgroundImages
          posts={planPosts}
          bgLayout={plan.bgLayout || 'horizontal'}
          theme={plan.theme}
          priority={priority}
          targetWidth={380}
          imageClassName="group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/15 pointer-events-none group-hover:opacity-85 transition-opacity duration-300" />

        {/* Top-Right Decorative Curve / Swoosh Gradient (Matches Descubrir cards 1:1) */}
        <div className="absolute top-0 right-0 w-10 h-10 sm:w-20 sm:h-20 pointer-events-none select-none z-10 overflow-hidden rounded-tr-xl sm:rounded-tr-2xl transition-transform duration-500 group-hover:scale-110 group-hover:opacity-95">
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={`topCornerGrad-${plan.id}`} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0060E6" />
                <stop offset="40%" stopColor="#0099FF" />
                <stop offset="75%" stopColor="#00CFFF" />
                <stop offset="100%" stopColor="#1BE0F8" />
              </linearGradient>
            </defs>
            <path d="M 0 0 C 45 0, 80 18, 100 68 L 100 0 Z" fill={`url(#topCornerGrad-${plan.id})`} />
          </svg>
        </div>

        {/* Top-Left 3D Badge: Paradas count with Sunburst Spark Rays */}
        <div
          className="absolute select-none z-20 transition-transform duration-300 ease-out left-1 top-1.5 sm:left-2 sm:top-2"
          style={{
            display: 'inline-flex',
            transform: 'rotate(-10deg) scale(0.68) sm:scale(0.74)',
            transformOrigin: 'top left',
          }}
        >
          <div className="relative flex items-center group-hover:scale-105 group-hover:rotate-1 transition-transform duration-300">
            <div
              className="relative z-10 text-white font-black text-xs sm:text-sm px-2.5 py-1 sm:px-3 sm:py-1 tracking-tight rounded-full flex items-center justify-center leading-none transition-shadow duration-300 group-hover:shadow-[0_6px_22px_rgba(230,60,0,0.65)]"
              style={{
                background: 'linear-gradient(rgb(255, 179, 0) 0%, rgb(255, 145, 0) 35%, rgb(240, 80, 0) 70%, rgb(230, 57, 0) 100%)',
                boxShadow: 'rgba(230, 60, 0, 0.52) 0px 4px 16px, rgba(0, 0, 0, 0.22) 0px 2px 6px, rgba(255, 255, 255, 0.65) 0px 1.5px 1.5px inset, rgba(180, 30, 0, 0.4) 0px -1.5px 2px inset',
                textShadow: 'rgba(150, 20, 0, 0.45) 0px 1px 2px',
              }}
            >
              {planPosts.length} {planPosts.length === 1 ? 'PARADA' : 'PARADAS'}
            </div>
            <div className="absolute -top-1.5 -right-1 pointer-events-none w-4 h-4 sm:w-4.5 sm:h-4.5 flex items-center justify-center z-0 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 32 32" fill="none" stroke="#FFB300" strokeLinecap="round">
                <line x1="15" y1="16" x2="24" y2="6" strokeWidth="2.8" />
                <line x1="18" y1="20" x2="30" y2="18" strokeWidth="2.8" />
                <line x1="11" y1="14" x2="13" y2="3" strokeWidth="2.8" />
              </svg>
            </div>
          </div>
        </div>

        {/* Bottom-Left Pill: Scheduled Time matching Descubrir */}
        {plan.scheduledTime ? (
          <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 z-20 bg-gradient-to-r from-teal-500 to-cyan-500/95 text-white text-[7.5px] sm:text-[9.5px] px-1.5 py-0.5 sm:px-2.5 sm:py-1 font-bold rounded-full flex items-center gap-1 sm:gap-1.5 shadow-md backdrop-blur-sm border border-white/25 max-w-[90%] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white shrink-0" />
            <span className="truncate">{plan.scheduledTime}</span>
          </div>
        ) : null}
      </div>

      {/* 2. Title and Description matching Descubrir cards 1:1 */}
      <div className="relative flex-grow flex flex-col justify-start pt-0.5 pb-1">
        <div className="relative z-10 pr-0.5 sm:pr-1">
          <h2
            className="text-[12px] sm:text-sm font-extrabold text-[#0A1D3C] group-hover:text-[#004dc9] leading-tight sm:leading-snug tracking-tight line-clamp-2 transition-colors duration-200"
            style={{ color: 'rgb(8, 28, 68)' }}
          >
            {plan.planTitle}
          </h2>
          {descriptionText && (
            <p className="text-[9.5px] sm:text-[11px] text-slate-500 line-clamp-2 font-normal leading-tight mt-0.5">
              {descriptionText}
            </p>
          )}
        </div>
      </div>
    </motion.article>
  );
};
