import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PostCard } from './PostCard';
import { FilterModal } from './FilterModal';
import { QuickPreviewModal } from './QuickPreviewModal';
import { MerchantCtaBanner } from './MerchantCtaBanner';
import { Post } from '../types';
import {
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
  Plus,
  Store,
  Compass,
} from 'lucide-react';

interface FeedProps {
  onSelectPost: (post: Post) => void;
  onSelectBusiness: (businessId: string) => void;
  onOpenCreatePost?: () => void;
  onOpenCreateBusiness?: () => void;
  onOpenLocationPicker?: () => void;
}

export const Feed: React.FC<FeedProps> = ({
  onSelectPost,
  onSelectBusiness,
  onOpenCreatePost,
  onOpenCreateBusiness,
}) => {
  const {
    filteredPosts,
    posts,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    currentCity,
    currentSector,
    setCurrentSector,
    activeFeedFilter,
    setActiveFeedFilter,
    maxPlanBudget,
    setMaxPlanBudget,
    getDistanceKm,
  } = useApp();

  // Initial view mode: 'grid' (default) or 'list' (supports ?view=list)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const v = new URLSearchParams(window.location.search).get('view');
      if (v === 'list') return 'list';
    }
    return 'grid';
  });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'recent' | 'distance' | 'price_low'>('recent');
  const [autoPreview] = useState(true);
  const [quickPeekPost, setQuickPeekPost] = useState<Post | null>(null);

  // Focal post management: ensures only ONE post with video plays at a time as you scroll
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [manualActivePostId, setManualActivePostId] = useState<string | null>(null);

  // Scroll focal tracking: dynamically identifies the single card in focus during scrolling
  useEffect(() => {
    if (!autoPreview) {
      setFocusedPostId(null);
      return;
    }

    let rafId: number | null = null;

    const findFocusedPost = () => {
      // In mobile and desktop viewports, focal reading center is around 45% of viewport height
      const focalY = window.innerHeight * 0.45;
      const focalX = window.innerWidth / 2;

      const cardNodes = document.querySelectorAll<HTMLElement>('[data-card-post-id]');
      if (!cardNodes.length) return;

      let bestId: string | null = null;
      let minScore = Infinity;

      cardNodes.forEach((node, index) => {
        const pid = node.getAttribute('data-card-post-id');
        const hasVideo = node.getAttribute('data-has-video') === 'true';
        if (!pid || !hasVideo) return;

        const rect = node.getBoundingClientRect();

        // Must be in active viewport reading zone (with margins to prevent offscreen play)
        if (rect.bottom < 80 || rect.top > window.innerHeight - 60) {
          return;
        }

        const cardCenterY = (rect.top + rect.bottom) / 2;
        const cardCenterX = (rect.left + rect.right) / 2;

        const distY = Math.abs(cardCenterY - focalY);
        const distX = Math.abs(cardCenterX - focalX);

        // Distance score: vertical distance is paramount (1.8x weight).
        // Tie-breaker slight penalty based on index ensures deterministic single focus in grid columns.
        const score = Math.hypot(distX * 0.7, distY * 1.8) + index * 0.01;

        // Card must be within reasonable focus range of the center line
        const cardHeight = rect.height || 260;
        const isNearCenter =
          distY < cardHeight * 0.95 || (rect.top <= focalY && rect.bottom >= focalY);

        if (isNearCenter && score < minScore) {
          minScore = score;
          bestId = pid;
        }
      });

      setFocusedPostId(bestId);
    };

    const handleScrollOrResize = () => {
      // When scrolling, clear manual focus override so scroll focus seamlessly takes over
      if (manualActivePostId) {
        setManualActivePostId(null);
      }

      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        findFocusedPost();
        rafId = null;
      });
    };

    // Calculate on mount or mode change with a short delay for DOM layout
    const initialTimer = setTimeout(findFocusedPost, 120);

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      clearTimeout(initialTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [autoPreview, viewMode, manualActivePostId]);

  // Active filter count for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory && selectedCategory !== 'all') count++;
    if (currentSector && currentSector !== 'all') count++;
    if (maxPlanBudget !== null) count++;
    if (currentCity && currentCity !== 'all') count++;
    if (activeFeedFilter && activeFeedFilter !== 'today') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [selectedCategory, currentSector, maxPlanBudget, currentCity, activeFeedFilter, searchQuery]);

  // Posts to display with sorting
  const displayPosts = useMemo(() => {
    let list = [...filteredPosts];

    if (sortOrder === 'price_low') {
      list.sort((a, b) => {
        const priceA = a.promotionalPrice || a.originalPrice || 99999999;
        const priceB = b.promotionalPrice || b.originalPrice || 99999999;
        return priceA - priceB;
      });
    } else if (sortOrder === 'distance') {
      list.sort((a, b) => {
        const distA = getDistanceKm(a.coordinates) ?? 999999;
        const distB = getDistanceKm(b.coordinates) ?? 999999;
        return distA - distB;
      });
    } else if (sortOrder === 'recent') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [filteredPosts, sortOrder, getDistanceKm]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setActiveFeedFilter('today');
    setSelectedCategory('all');
    setCurrentSector('all');
    setMaxPlanBudget(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Top Banner - Authentic original Descubrir header bar matching Image 1 */}
      <div className="relative overflow-hidden flex items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-3.5 md:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#03153d] via-[#052264] to-[#0a3899] text-white shadow-xl shadow-blue-950/20 border border-white/15">
        {/* Subtle ambient light glow */}
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-cyan-400/25 via-blue-500/20 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(6,182,212,0.35)] backdrop-blur-md">
            <div className="absolute inset-1 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-600/40 opacity-80 pointer-events-none" />
            <Compass className="relative w-5 h-5 text-cyan-300 drop-shadow-[0_2px_8px_rgba(0,180,216,0.6)]" strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base md:text-lg font-black text-white tracking-tight whitespace-nowrap">
              Descubrir
            </h2>
            <p className="text-[10px] text-blue-200/80 font-medium hidden sm:block">
              Ofertas y publicaciones de hoy
            </p>
          </div>
        </div>

        {/* Search input on the right of the banner */}
        <div className="relative flex-1 min-w-0 max-w-[210px] xs:max-w-[250px] sm:max-w-xs md:max-w-sm">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="feed-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar planes en ${currentCity || 'Cajicá'}...`}
            className="w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 rounded-xl bg-black/30 backdrop-blur-md text-white placeholder:text-blue-200/60 text-xs border border-white/15 focus:outline-hidden focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-200 hover:text-white cursor-pointer"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Controls Row: Filtros button on Left + View Mode Toggle on Right */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Filtros button + location indicator */}
        <div className="flex items-center gap-2">
          <button
            id="btn-feed-filter-modal"
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
              activeFiltersCount > 0
                ? 'bg-[#007af7] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/90'
            }`}
            title="Abrir opciones de filtros"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-[#007af7] text-[10px] font-black flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Location indicator chip */}
          <span className="text-xs text-slate-500 hidden sm:inline">
            📍 {currentCity && currentCity !== 'all' ? currentCity : 'Todos los municipios'}{currentSector && currentSector !== 'all' ? ` · ${currentSector}` : ''}
          </span>

          {/* Quick active budget indicator if set */}
          {maxPlanBudget !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-xs shrink-0">
              Hasta ${maxPlanBudget.toLocaleString('es-CO')}
              <button onClick={() => setMaxPlanBudget(null)} className="hover:text-emerald-950 cursor-pointer" title="Quitar filtro de precio">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Quick active sector indicator if set */}
          {currentSector && currentSector !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200 text-xs shrink-0">
              {currentSector}
              <button onClick={() => setCurrentSector('all')} className="hover:text-amber-950 cursor-pointer" title="Quitar filtro de sector">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {/* Right: Layout Switchers (Grid, List) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/90 shrink-0">
            <button
              id="btn-feed-view-grid"
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#007af7] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en Cuadrícula (2 Columnas)"
              aria-label="Vista cuadrícula"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>

            <button
              id="btn-feed-view-list"
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#007af7] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en Lista"
              aria-label="Vista lista"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* POSTS FEED */}
      {displayPosts.length > 0 ? (
        <>
          {/* A. Grid Mode (2-Columns on mobile, strictly 3 columns on tablet/desktop for bigger announcements) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 sm:gap-4.5">
              {displayPosts.map((post, idx) => {
                const isPostFocused = manualActivePostId
                  ? manualActivePostId === post.id
                  : focusedPostId === post.id;

                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    viewMode="grid"
                    priority={idx < 2}
                    autoPreview={autoPreview}
                    isFocused={isPostFocused}
                    isManualPreviewActive={manualActivePostId === post.id}
                    onToggleManualPreview={() => {
                      setManualActivePostId((prev) => (prev === post.id ? null : post.id));
                    }}
                    onQuickPeek={(p) => setQuickPeekPost(p)}
                    onSelectPost={onSelectPost}
                    onSelectBusiness={onSelectBusiness}
                  />
                );
              })}
            </div>
          )}

          {/* B. List Mode (Full-width cards matching section header) */}
          {viewMode === 'list' && (
            <div className="space-y-3 sm:space-y-3.5 w-full">
              {displayPosts.map((post, idx) => {
                const isPostFocused = manualActivePostId
                  ? manualActivePostId === post.id
                  : focusedPostId === post.id;

                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    viewMode="list"
                    priority={idx < 2}
                    autoPreview={autoPreview}
                    isFocused={isPostFocused}
                    isManualPreviewActive={manualActivePostId === post.id}
                    onToggleManualPreview={() => {
                      setManualActivePostId((prev) => (prev === post.id ? null : post.id));
                    }}
                    onQuickPeek={(p) => setQuickPeekPost(p)}
                    onSelectPost={onSelectPost}
                    onSelectBusiness={onSelectBusiness}
                  />
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200/90 p-8 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0056d6] flex items-center justify-center mx-auto">
            <Compass className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-[#031c54]">
            No hay publicaciones en este momento
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Intenta cambiar tus filtros de búsqueda o consulta más sectores del municipio.
          </p>
          <button
            onClick={handleClearAllFilters}
            className="px-4 py-2 bg-[#0056d6] hover:bg-[#0047ba] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Ver todo lo disponible
          </button>
        </div>
      )}

      {/* BOTTOM MERCHANT BANNER */}
      <MerchantCtaBanner
        className="mt-8"
        onOpenCreateBusiness={onOpenCreateBusiness}
      />

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
      />

      {/* Quick Preview Modal for Mobile & Long-Press Peeks */}
      <QuickPreviewModal
        post={quickPeekPost}
        onClose={() => setQuickPeekPost(null)}
        onSelectPost={onSelectPost}
        onSelectBusiness={onSelectBusiness}
      />
    </div>
  );
};
