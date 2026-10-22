import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ReelFeedView } from './ReelFeedView';
import { SurpriseMeModal } from './SurpriseMeModal';
import { SimulatedReadyPlan, resolvePlanPosts } from '../data/readyPlansData';
import { ReadyPlanViewerModal } from './ready-plans/ReadyPlanViewerModal';
import { Post } from '../types';
import {
  matchesPostPlanExperience,
  matchesReadyPlanExperience,
} from '../utils/planFilterHelper';

interface HomeReelsViewProps {
  onSelectPost: (post: Post) => void;
  onSelectBusiness: (businessId: string) => void;
  onOpenItineraryBuilder?: () => void;
  targetReelId?: string | null;
  isPaused?: boolean;
}

export const HomeReelsView: React.FC<HomeReelsViewProps> = ({
  onSelectPost,
  onSelectBusiness,
  onOpenItineraryBuilder,
  targetReelId: propTargetReelId,
  isPaused: externalPaused = false,
}) => {
  const effectiveTargetReelId = useMemo(() => {
    if (propTargetReelId) return propTargetReelId;
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const r = search.get('reel');
      if (r) return r;
      const path = window.location.pathname;
      if (path.startsWith('/reel/')) {
        return path.replace('/reel/', '').split('/')[0];
      }
    }
    return null;
  }, [propTargetReelId]);
  const {
    filteredPosts,
    posts,
    readyPlans,
    selectedCategory,
    setSelectedCategory,
    selectedPlanType,
    setSelectedPlanType,
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

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedPlanModal, setSelectedPlanModal] = useState<SimulatedReadyPlan | null>(null);
  const [planModalTab, setPlanModalTab] = useState<'card' | 'map'>('card');
  const [sortOrder, setSortOrder] = useState<'recent' | 'distance' | 'price_low'>('recent');

  // Active plan/surprise filter state
  const isPlanFiltered = Boolean(
    (selectedPlanType && selectedPlanType !== 'all') ||
    maxPlanBudget !== null ||
    (selectedCategory && selectedCategory !== 'all') ||
    (currentSector && currentSector !== 'all') ||
    searchQuery.trim().length > 0
  );

  // Active filter count for Sorprendeme button badge
  const activeFiltersCount = isPlanFiltered ? 1 : 0;

  // Combined posts: Publicaciones de Descubrir + Itinerarios Armados oficiales
  const combinedReelPosts = useMemo(() => {
    const list: Post[] = [];
    const seenPostIds = new Set<string>();
    const q = searchQuery.trim().toLowerCase();

    // 1. Build all Itinerary Reel Posts from readyPlans (the same ones in the Itinerarios section)
    const allItineraryReels: Post[] = [];
    (readyPlans || []).forEach((plan) => {
      // Filter by municipality if city is set
      if (currentCity && currentCity !== 'all') {
        const planMun = (plan.municipality || '').toLowerCase().trim();
        const cityLower = currentCity.toLowerCase().trim();
        if (planMun && !planMun.includes(cityLower) && !cityLower.includes(planMun)) {
          return;
        }
      }

      // Filter by category if set
      if (selectedCategory && selectedCategory !== 'all') {
        const catLower = selectedCategory.toLowerCase();
        const planCatLower = (plan.category || '').toLowerCase();
        const planStops = resolvePlanPosts(plan, posts);
        const stopsMatchCat = planStops.some(
          (p) =>
            p.categoryId === selectedCategory ||
            (p.tags || []).some((t) => t.toLowerCase().includes(catLower))
        );

        const matchCat =
          stopsMatchCat ||
          planCatLower === catLower ||
          (plan.tags || []).some((t) => t.toLowerCase().includes(catLower)) ||
          (catLower === 'plan_cita_romantica' && (planCatLower === 'romance' || planCatLower === 'plan_cita_romantica')) ||
          (catLower === 'plan_comer_algo' && (planCatLower === 'gastronomia' || planCatLower === 'parrilla' || planCatLower === 'plan_comer_algo')) ||
          (catLower === 'plan_tomar_algo' && (planCatLower === 'cafe' || planCatLower === 'plan_tomar_algo')) ||
          (catLower === 'plan_noche_rumba' && (planCatLower === 'rumba' || planCatLower === 'plan_noche_rumba')) ||
          (catLower === 'plan_con_amigos' && (planCatLower === 'amigos' || planCatLower === 'plan_con_amigos')) ||
          (catLower === 'plan_cuidado_personal' && (planCatLower === 'wellness' || planCatLower === 'plan_cuidado_personal')) ||
          (catLower === 'plan_dia_con_ninos' && (planCatLower === 'naturaleza' || planCatLower === 'plan_dia_con_ninos'));
        if (!matchCat) return;
      }

      // Filter by plan type / experience (Cita Romántica, Amigos, etc.) if set
      if (selectedPlanType && selectedPlanType !== 'all') {
        if (!matchesReadyPlanExperience(plan, selectedPlanType, posts)) {
          return;
        }
      }

      // Filter by sector if set
      if (currentSector && currentSector !== 'all') {
        const sectorLower = currentSector.toLowerCase().trim();
        const planStops = resolvePlanPosts(plan, posts);
        const matchSector =
          (plan.tags || []).some((t) => t.toLowerCase().includes(sectorLower)) ||
          planStops.some((p) => (p.businessSector || '').toLowerCase().includes(sectorLower));
        if (!matchSector) return;
      }

      // Filter by budget if set
      if (maxPlanBudget !== null && maxPlanBudget > 0) {
        if (plan.estimatedBudget > maxPlanBudget) return;
      }

      // Filter by search query if set
      if (q) {
        const planStops = resolvePlanPosts(plan, posts);
        const stopsText = planStops.map((s) => s.businessName).join(' ').toLowerCase();
        const titleMatch = plan.planTitle.toLowerCase().includes(q);
        const noteMatch = (plan.personalNote || '').toLowerCase().includes(q);
        const tagMatch = (plan.tags || []).some((t) => t.toLowerCase().includes(q));
        const stopMatch = stopsText.includes(q);
        if (!titleMatch && !noteMatch && !tagMatch && !stopMatch) return;
      }

      const stops = resolvePlanPosts(plan, posts);
      const stopsNames = stops.map((s) => s.businessName).filter(Boolean);
      const firstStop = stops[0];

      const itineraryReelPost: Post = {
        id: `itinerary_${plan.id}`,
        businessId: firstStop?.businessId || 'itinerary_hub',
        businessName: stopsNames.length > 0 ? stopsNames.slice(0, 2).join(' + ') : 'Itinerario Veci',
        businessLogo: firstStop?.businessLogo || '/Icono_Oleveci_sin_fondo.png?v=clean',
        businessCity: plan.municipality || currentCity || 'Cajicá',
        businessSector: firstStop?.businessSector || 'Ruta Destacada',
        businessWhatsapp: firstStop?.businessWhatsapp || '573001234567',
        businessPhone: firstStop?.businessPhone || '',
        businessAddress: firstStop?.businessAddress || plan.municipality || 'Cajicá',
        coordinates: firstStop?.coordinates || { lat: 4.9184, lng: -74.0259 },
        type: 'service',
        title: plan.planTitle,
        description: plan.personalNote
          ? `${plan.personalNote} • ${stops.length} paradas: ${stopsNames.join(' ➔ ')}`
          : `Itinerario con ${stops.length} paradas: ${stopsNames.join(' ➔ ')}`,
        imageUrl: plan.coverImage || firstStop?.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
        promotionalPrice: plan.estimatedBudget > 0 ? plan.estimatedBudget : undefined,
        originalPrice: undefined,
        expiryLabel: plan.scheduledTime || 'Disponible hoy',
        categoryId: plan.category,
        planCategoryId: plan.category,
        planCategoryName: plan.planTitle,
        tags: ['itinerario', 'plan', ...(plan.tags || [])],
        isPlan: true,
        planData: plan,
        planStops: stops,
        createdAt: '2026-01-01T00:00:00.000Z',
        startsAt: '2026-01-01T00:00:00.000Z',
        metrics: {
          views: 280,
          whatsappClicks: 42,
          mapsClicks: 35,
          calls: 18,
          shares: 12,
        },
      };

      allItineraryReels.push(itineraryReelPost);
    });

    // 2. Discover Promo posts (excluded if filtering exclusively for itineraries)
    const discoverPosts: Post[] = [];
    if (activeFeedFilter !== 'itineraries') {
      filteredPosts.forEach((p) => {
        if (seenPostIds.has(p.id)) return;

        // Filter by selected plan experience if active
        if (selectedPlanType && selectedPlanType !== 'all') {
          if (!matchesPostPlanExperience(p, selectedPlanType)) {
            return;
          }
        }

        // Filter by max budget if active
        if (maxPlanBudget !== null && maxPlanBudget > 0) {
          const price = p.promotionalPrice || p.originalPrice || p.price;
          if (price && price > maxPlanBudget) {
            return;
          }
        }

        seenPostIds.add(p.id);
        discoverPosts.push(p);
      });
    }

    // 3. Assemble list: If activeFeedFilter === 'itineraries', ONLY itineraries are shown!
    if (activeFeedFilter === 'itineraries') {
      allItineraryReels.forEach((it) => {
        if (!seenPostIds.has(it.id)) {
          seenPostIds.add(it.id);
          list.push(it);
        }
      });
    } else {
      let itinIdx = 0;
      let discIdx = 0;

      while (itinIdx < allItineraryReels.length || discIdx < discoverPosts.length) {
        if (itinIdx < allItineraryReels.length) {
          list.push(allItineraryReels[itinIdx++]);
        }
        for (let k = 0; k < 2 && discIdx < discoverPosts.length; k++) {
          list.push(discoverPosts[discIdx++]);
        }
      }
    }

    // 4. Fallback if empty and no strict search
    if (
      activeFeedFilter !== 'itineraries' &&
      list.length === 0 &&
      posts.length > 0 &&
      !searchQuery.trim() &&
      selectedCategory === 'all' &&
      selectedPlanType === 'all' &&
      maxPlanBudget === null
    ) {
      posts.forEach((p) => {
        if (!seenPostIds.has(p.id)) {
          seenPostIds.add(p.id);
          list.push(p);
        }
      });
    }

    // 5. Pin the OleVeci Welcome Reel ALWAYS at index 0 (in default unfiltered view)
    if (activeFeedFilter !== 'itineraries' && !isPlanFiltered) {
      const welcomeReelIdx = list.findIndex(
        (p) =>
          p.id === 'post_oleveci_bienvenida' ||
          (p.businessId === 'biz_oleveci' && (p.videoUrl || p.tags?.includes('bienvenida') || p.title.toLowerCase().includes('bienvenid')))
      );

      let welcomePost: Post | null = null;
      if (welcomeReelIdx >= 0) {
        [welcomePost] = list.splice(welcomeReelIdx, 1);
      } else {
        // Find in all posts if not already present
        const officialWelcome = posts.find(
          (p) =>
            p.id === 'post_oleveci_bienvenida' ||
            (p.businessId === 'biz_oleveci' && (p.videoUrl || p.tags?.includes('bienvenida') || p.title.toLowerCase().includes('bienvenid')))
        );
        if (officialWelcome) {
          welcomePost = officialWelcome;
        }
      }

      // Place the OleVeci welcome reel at the very beginning (Index 0 ALWAYS)
      if (welcomePost) {
        list.unshift(welcomePost);
      }
    }

    // If a specific reel was targeted (via deep link or share), ensure it appears at Index 0!
    if (effectiveTargetReelId) {
      let targetPost = list.find(
        (p) =>
          p.id === effectiveTargetReelId ||
          p.id === `itinerary_${effectiveTargetReelId}` ||
          p.id.replace('itinerary_', '') === effectiveTargetReelId
      );

      if (!targetPost) {
        // Search in all posts
        const rawPost = posts.find((p) => p.id === effectiveTargetReelId);
        if (rawPost) {
          targetPost = rawPost;
        } else {
          // Search in all ready plans
          const planId = effectiveTargetReelId.replace('itinerary_', '');
          const rawPlan = (readyPlans || []).find((p) => p.id === planId);
          if (rawPlan) {
            const stops = resolvePlanPosts(rawPlan, posts);
            const stopsNames = stops.map((s) => s.businessName).filter(Boolean);
            const firstStop = stops[0];
            targetPost = {
              id: `itinerary_${rawPlan.id}`,
              businessId: firstStop?.businessId || 'itinerary_hub',
              businessName: stopsNames.length > 0 ? stopsNames.slice(0, 2).join(' + ') : 'Itinerario Veci',
              businessLogo: firstStop?.businessLogo || '/Icono_Oleveci_sin_fondo.png?v=clean',
              businessCity: rawPlan.municipality || currentCity || 'Cajicá',
              businessSector: firstStop?.businessSector || 'Ruta Destacada',
              businessWhatsapp: firstStop?.businessWhatsapp || '573001234567',
              businessPhone: firstStop?.businessPhone || '',
              businessAddress: firstStop?.businessAddress || rawPlan.municipality || 'Cajicá',
              coordinates: firstStop?.coordinates || { lat: 4.9184, lng: -74.0259 },
              type: 'service',
              title: rawPlan.planTitle,
              description: rawPlan.personalNote
                ? `${rawPlan.personalNote} • ${stops.length} paradas: ${stopsNames.join(' ➔ ')}`
                : `Itinerario con ${stops.length} paradas: ${stopsNames.join(' ➔ ')}`,
              imageUrl: rawPlan.coverImage || firstStop?.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
              promotionalPrice: rawPlan.estimatedBudget > 0 ? rawPlan.estimatedBudget : undefined,
              originalPrice: undefined,
              expiryLabel: rawPlan.scheduledTime || 'Disponible hoy',
              categoryId: rawPlan.category,
              planCategoryId: rawPlan.category,
              planCategoryName: rawPlan.planTitle,
              tags: ['itinerario', 'plan', ...(rawPlan.tags || [])],
              isPlan: true,
              planData: rawPlan,
              planStops: stops,
              createdAt: '2026-01-01T00:00:00.000Z',
              startsAt: '2026-01-01T00:00:00.000Z',
              metrics: { views: 280, whatsappClicks: 42, mapsClicks: 35, calls: 18, shares: 12 },
            };
          }
        }
      }

      if (targetPost) {
        const remaining = list.filter((p) => p.id !== targetPost!.id);
        return [targetPost, ...remaining];
      }
    }

    // Apply sortOrder to the posts, keeping welcome reel at index 0 if present
    const welcomeReel = list.find(
      (p) =>
        p.id === 'post_oleveci_bienvenida' ||
        (p.businessId === 'biz_oleveci' && (p.videoUrl || p.tags?.includes('bienvenida') || p.title.toLowerCase().includes('bienvenid')))
    );
    const itemsToSort = welcomeReel ? list.filter((p) => p.id !== welcomeReel.id) : [...list];

    if (sortOrder === 'price_low') {
      itemsToSort.sort((a, b) => {
        const priceA = a.promotionalPrice || a.originalPrice || 99999999;
        const priceB = b.promotionalPrice || b.originalPrice || 99999999;
        return priceA - priceB;
      });
    } else if (sortOrder === 'distance') {
      itemsToSort.sort((a, b) => {
        const distA = getDistanceKm(a.coordinates) ?? 999999;
        const distB = getDistanceKm(b.coordinates) ?? 999999;
        return distA - distB;
      });
    } else if (sortOrder === 'recent') {
      itemsToSort.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return welcomeReel ? [welcomeReel, ...itemsToSort] : itemsToSort;
  }, [readyPlans, filteredPosts, posts, currentCity, currentSector, selectedCategory, selectedPlanType, searchQuery, maxPlanBudget, activeFeedFilter, sortOrder, getDistanceKm, effectiveTargetReelId]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setActiveFeedFilter('today');
    setSelectedCategory('all');
    setSelectedPlanType('all');
    setCurrentSector('all');
    setMaxPlanBudget(null);
  };

  const handleSelectPost = (post: Post, initialTab: 'card' | 'map' = 'card') => {
    if (post.isPlan && post.planData) {
      setSelectedPlanModal(post.planData);
      setPlanModalTab(initialTab);
    } else {
      onSelectPost(post);
    }
  };

  return (
    <div className="relative w-full h-[calc(100dvh-53px)] sm:h-[calc(100dvh-64px)] min-h-[calc(100dvh-53px)] sm:min-h-[calc(100dvh-64px)] bg-[#040e28] sm:bg-gradient-to-r sm:from-[#03153d] sm:via-[#052264] sm:to-[#0a3899] flex flex-col items-center justify-center sm:py-1.5 overflow-hidden select-none">
      {/* Decorative ambient glow on desktop matching the Descubrir and Itinerarios banners */}
      <div className="hidden sm:block absolute -top-16 -left-16 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute -bottom-16 -right-16 w-96 h-96 bg-[#007af7]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Central Expansive Brand Watermark behind the Reel Player */}
      <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none select-none overflow-hidden z-0">
        <img
          src="/Icono_Oleveci_sin_fondo.png?v=clean"
          alt=""
          aria-hidden="true"
          className="w-[740px] xl:w-[1000px] max-w-none h-auto object-contain opacity-[0.09] pointer-events-none"
        />
      </div>

      {/* Home TikTok Reels Feed: Discover + Itinerary Publications */}
      <ReelFeedView
        posts={combinedReelPosts}
        onSelectPost={handleSelectPost}
        onSelectBusiness={onSelectBusiness}
        onOpenFilterModal={() => setIsFilterModalOpen(true)}
        activeFiltersCount={activeFiltersCount}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentCity={currentCity}
        onClearFilters={handleClearAllFilters}
        isPaused={externalPaused || Boolean(selectedPlanModal || isFilterModalOpen)}
      />

      {/* ¿Qué quieres hacer hoy? · Sorpréndeme Modal */}
      <SurpriseMeModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
      />

      {/* Ready Plan Viewer Modal when an itinerary reel is tapped */}
      {selectedPlanModal && (
        <ReadyPlanViewerModal
          plan={selectedPlanModal}
          posts={posts}
          currentCity={currentCity || 'Cajicá'}
          initialTab={planModalTab}
          onClose={() => setSelectedPlanModal(null)}
          onSelectPost={onSelectPost}
          onOpenItineraryBuilder={onOpenItineraryBuilder}
        />
      )}
    </div>
  );
};
