import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Dices,
  MapPin,
  Heart,
  Utensils,
  Coffee,
  Wine,
  Smile,
  PawPrint,
  Car,
  ShoppingBag,
  Sun,
  X,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import {
  matchesPostPlanExperience,
  matchesReadyPlanExperience,
} from '../utils/planFilterHelper';

interface SurpriseMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sortOrder: 'recent' | 'distance' | 'price_low';
  onSortChange: (sort: 'recent' | 'distance' | 'price_low') => void;
}

// Curated plan experiences matching real human intentions
const PLAN_EXPERIENCES = [
  {
    id: 'all',
    label: '¡Cualquier plan!',
    icon: Sparkles,
    color: 'from-amber-400 to-[#ff7700]',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-300',
  },
  {
    id: 'plan_comer_algo',
    label: 'Comer y Antojarse',
    icon: Utensils,
    color: 'from-orange-500 to-amber-500',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
  },
  {
    id: 'plan_tomar_algo',
    label: 'Café, Helado o Postre',
    icon: Coffee,
    color: 'from-amber-600 to-yellow-500',
    textColor: 'text-amber-900',
    borderColor: 'border-amber-300',
  },
  {
    id: 'plan_cita_romantica',
    label: 'Cita Romántica',
    icon: Heart,
    color: 'from-rose-500 to-pink-500',
    textColor: 'text-rose-800',
    borderColor: 'border-rose-300',
  },
  {
    id: 'plan_con_amigos',
    label: 'Parche con Amigos',
    icon: Smile,
    color: 'from-sky-500 to-blue-600',
    textColor: 'text-sky-800',
    borderColor: 'border-sky-300',
  },
  {
    id: 'plan_noche_rumba',
    label: 'Noche, Cocteles o Rumba',
    icon: Wine,
    color: 'from-purple-600 to-indigo-600',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-300',
  },
  {
    id: 'plan_dia_con_ninos',
    label: 'En Familia o con Niños',
    icon: Sun,
    color: 'from-emerald-500 to-teal-600',
    textColor: 'text-emerald-800',
    borderColor: 'border-emerald-300',
  },
  {
    id: 'plan_consentir_mascotas',
    label: 'Plan con Mascotas',
    icon: PawPrint,
    color: 'from-teal-500 to-cyan-600',
    textColor: 'text-teal-800',
    borderColor: 'border-teal-300',
  },
  {
    id: 'plan_cuidado_personal',
    label: 'Belleza y Autocuidado',
    icon: Sparkles,
    color: 'from-fuchsia-500 to-pink-600',
    textColor: 'text-fuchsia-800',
    borderColor: 'border-fuchsia-300',
  },
  {
    id: 'plan_comprar_algo',
    label: 'Compras y Vitrineo',
    icon: ShoppingBag,
    color: 'from-blue-600 to-cyan-500',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
  },
  {
    id: 'plan_cuidar_la_nave',
    label: 'Cuidado de mi Vehículo',
    icon: Car,
    color: 'from-slate-600 to-slate-800',
    textColor: 'text-slate-800',
    borderColor: 'border-slate-300',
  },
];

// Curated budget options with clean labels (sin etiquetas inferiores)
const BUDGET_OPTIONS = [
  {
    value: null,
    label: 'Sin límite',
    shortLabel: 'Cualquiera',
    icon: '👑',
  },
  {
    value: 30000,
    label: 'Económico',
    shortLabel: 'Hasta $30k',
    icon: '🪙',
  },
  {
    value: 50000,
    label: 'Moderado',
    shortLabel: 'Hasta $50k',
    icon: '💵',
  },
  {
    value: 100000,
    label: 'Especial',
    shortLabel: 'Hasta $100k',
    icon: '💎',
  },
];

export const SurpriseMeModal: React.FC<SurpriseMeModalProps> = ({
  isOpen,
  onClose,
  sortOrder,
  onSortChange,
}) => {
  const {
    municipalities,
    sectors,
    currentCity,
    setCurrentCity,
    setCurrentSector,
    selectedPlanType,
    setSelectedPlanType,
    maxPlanBudget,
    setMaxPlanBudget,
    posts,
    readyPlans,
    isPostActive,
  } = useApp();

  // Internal draft states so user can adjust before committing
  const [draftPlanType, setDraftPlanType] = useState<string>(selectedPlanType || 'all');
  const [draftCity, setDraftCity] = useState<string>(currentCity || 'all');
  const [draftBudget, setDraftBudget] = useState<number | null>(maxPlanBudget);
  const [customBudgetInput, setCustomBudgetInput] = useState<string>(
    maxPlanBudget !== null ? maxPlanBudget.toLocaleString('es-CO') : ''
  );
  const [draftSort, setDraftSort] = useState<'recent' | 'distance' | 'price_low'>(sortOrder);
  const [randomAnimation, setRandomAnimation] = useState(false);

  // Scroll ref and state for municipalities
  const municipalityScrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = React.useCallback(() => {
    if (municipalityScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = municipalityScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }
  }, []);

  const handleScrollMunicipalities = (direction: 'left' | 'right') => {
    if (municipalityScrollRef.current) {
      const scrollAmount = 220;
      municipalityScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(updateScrollButtons, 260);
    }
  };

  // Sync with AppContext when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftPlanType(selectedPlanType || 'all');
      setDraftCity(currentCity || 'all');
      setDraftBudget(maxPlanBudget);
      setCustomBudgetInput(maxPlanBudget !== null ? maxPlanBudget.toLocaleString('es-CO') : '');
      setDraftSort(sortOrder);
      setTimeout(updateScrollButtons, 120);
    }
  }, [isOpen, selectedPlanType, currentCity, maxPlanBudget, sortOrder, updateScrollButtons]);

  // Unique list of municipalities
  const cities: string[] = useMemo(() => {
    const list =
      municipalities && municipalities.length > 0
        ? municipalities.map((m) => m.name)
        : Array.from(new Set(sectors.map((s) => s.cityName)));
    return [...list].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [municipalities, sectors]);

  // Calculate live matching count with current draft choices (matching combined reels feed)
  const matchingReelsCount = useMemo(() => {
    const active = posts.filter(isPostActive);

    // 1. Matching business promo posts
    const matchingPosts = active.filter((post) => {
      // City filter
      if (draftCity && draftCity !== 'all') {
        const postCity = (post.businessCity || '').toLowerCase();
        if (postCity !== draftCity.toLowerCase()) return false;
      }

      // Plan type filter
      if (draftPlanType && draftPlanType !== 'all') {
        if (!matchesPostPlanExperience(post, draftPlanType)) return false;
      }

      // Budget filter
      if (draftBudget !== null) {
        const postPrice = post.promotionalPrice || post.originalPrice || post.price || post.discountPrice;
        if (postPrice && postPrice > draftBudget) {
          return false;
        }
      }

      return true;
    });

    // 2. Matching itinerary reels from readyPlans
    const matchingItineraries = (readyPlans || []).filter((plan) => {
      // City filter
      if (draftCity && draftCity !== 'all') {
        const planMun = (plan.municipality || '').toLowerCase().trim();
        const cityLower = draftCity.toLowerCase().trim();
        if (planMun && !planMun.includes(cityLower) && !cityLower.includes(planMun)) {
          return false;
        }
      }

      // Plan type filter
      if (draftPlanType && draftPlanType !== 'all') {
        if (!matchesReadyPlanExperience(plan, draftPlanType, posts)) {
          return false;
        }
      }

      // Budget filter
      if (draftBudget !== null) {
        if (plan.estimatedBudget > 0 && plan.estimatedBudget > draftBudget) {
          return false;
        }
      }

      return true;
    });

    return matchingPosts.length + matchingItineraries.length;
  }, [posts, readyPlans, isPostActive, draftCity, draftPlanType, draftBudget]);

  // Magic "🎲 Elige por mí" randomizer with dice
  const handleRandomizePlan = () => {
    setRandomAnimation(true);
    setTimeout(() => {
      // Pick random experience (excluding 'all')
      const planOptions = PLAN_EXPERIENCES.filter((p) => p.id !== 'all');
      const randomPlan = planOptions[Math.floor(Math.random() * planOptions.length)];

      // Pick random budget
      const budgetOptions = [null, 30000, 50000, 100000];
      const randomBudget = budgetOptions[Math.floor(Math.random() * budgetOptions.length)];

      setDraftPlanType(randomPlan.id);
      setDraftBudget(randomBudget);
      setCustomBudgetInput(randomBudget !== null ? randomBudget.toLocaleString('es-CO') : '');
      setRandomAnimation(false);
    }, 250);
  };

  // Reset all filters to default
  const handleReset = () => {
    setDraftPlanType('all');
    setDraftCity('all');
    setDraftBudget(null);
    setCustomBudgetInput('');
    setDraftSort('recent');
  };

  // Apply and trigger the surprise in the Reels feed!
  const handleApplySurprise = () => {
    setSelectedPlanType(draftPlanType);
    setCurrentCity(draftCity);
    setCurrentSector('all');
    setMaxPlanBudget(draftBudget);
    onSortChange(draftSort);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="surprise-me-modal-backdrop"
      className="fixed inset-0 z-[2000] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="surprise-me-modal-dialog"
        className="bg-white w-full sm:max-w-xl rounded-t-[32px] sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 border border-white/20"
      >
        {/* Header: Friendly & Conversational with Dice Icon */}
        <div className="relative px-5 pt-4 pb-3.5 border-b border-slate-100 bg-gradient-to-r from-sky-50/80 via-white to-amber-50/70 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-[#ff7700] text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                <Dices className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-[#041f5e] leading-snug flex items-center gap-1.5">
                  <span>¿Qué quieres hacer hoy?</span>
                </h3>
              </div>
            </div>

            {/* Quick Randomizer Button with Dice & Close */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRandomizePlan}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs ${
                  randomAnimation ? 'animate-spin' : ''
                }`}
                title="Elegir una combinación al azar"
              >
                <Dices className="w-4 h-4 text-[#ff7700]" />
                <span className="hidden xs:inline">Al azar</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 space-y-6 overflow-y-auto overscroll-contain">
          {/* PASO 1: ¿Qué tipo de plan buscas? */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#041f5e] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#007af7] text-white text-[11px] font-black flex items-center justify-center">
                  1
                </span>
                <span>¿Qué tipo de plan tienes en mente?</span>
              </label>
              {draftPlanType !== 'all' && (
                <button
                  type="button"
                  onClick={() => setDraftPlanType('all')}
                  className="text-[11px] text-[#007af7] font-semibold hover:underline cursor-pointer"
                >
                  Ver cualquiera
                </button>
              )}
            </div>

            {/* Interactive Grid of Plan Experiences - Compacto en móvil, amplio en escritorio */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {PLAN_EXPERIENCES.map((plan) => {
                const IconComponent = plan.icon;
                const isSelected = draftPlanType === plan.id;

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setDraftPlanType(plan.id)}
                    className={`py-2 px-2 sm:p-3 rounded-xl sm:rounded-2xl text-left transition-all duration-200 border cursor-pointer flex items-center gap-2 sm:gap-2.5 relative select-none active:scale-[0.98] ${
                      isSelected
                        ? 'bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-amber-500/10 border-[#007af7] shadow-sm ring-2 ring-[#007af7]/30'
                        : 'bg-slate-50/70 hover:bg-white hover:border-slate-300 border-slate-200/80'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                        isSelected
                          ? `bg-gradient-to-tr ${plan.color} text-white shadow-xs scale-105`
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>

                    <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                      <span
                        className={`text-[11px] sm:text-xs font-bold leading-tight sm:leading-snug line-clamp-2 ${
                          isSelected ? 'text-[#041f5e]' : 'text-slate-800'
                        }`}
                      >
                        {plan.label}
                      </span>
                      {isSelected && (
                        <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#007af7] text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PASO 2: ¿En dónde quieres tu plan? (Municipio Directo con Flechitas Web) */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#041f5e] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#ff7700] text-white text-[11px] font-black flex items-center justify-center">
                  2
                </span>
                <span>¿En dónde te gustaría vivirlo?</span>
              </label>
            </div>

            {/* Municipalities Pills con Flechitas de Desplazamiento Web */}
            <div className="relative flex items-center">
              {canScrollLeft && (
                <button
                  type="button"
                  onClick={() => handleScrollMunicipalities('left')}
                  className="absolute -left-2 z-10 w-7 h-7 rounded-full bg-white text-slate-700 hover:text-[#007af7] hover:bg-slate-50 shadow-md border border-slate-200 flex items-center justify-center transition active:scale-90 cursor-pointer"
                  title="Desplazar municipios a la izquierda"
                  aria-label="Desplazar a la izquierda"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <div
                ref={municipalityScrollRef}
                onScroll={updateScrollButtons}
                className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth w-full px-1"
              >
                <button
                  type="button"
                  onClick={() => setDraftCity('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer flex items-center gap-1 border ${
                    draftCity === 'all'
                      ? 'bg-[#041f5e] text-white border-[#041f5e] shadow-2xs font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>🌐 Todos</span>
                </button>

                {cities.map((city) => {
                  const isSelected = draftCity.toLowerCase() === city.toLowerCase();
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setDraftCity(city)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer flex items-center gap-1 border ${
                        isSelected
                          ? 'bg-gradient-to-r from-sky-500 to-[#007af7] text-white border-transparent shadow-2xs font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#007af7]'}`} />
                      <span>{city}</span>
                    </button>
                  );
                })}
              </div>

              {canScrollRight && (
                <button
                  type="button"
                  onClick={() => handleScrollMunicipalities('right')}
                  className="absolute -right-2 z-10 w-7 h-7 rounded-full bg-white text-slate-700 hover:text-[#007af7] hover:bg-slate-50 shadow-md border border-slate-200 flex items-center justify-center transition active:scale-90 cursor-pointer"
                  title="Desplazar municipios a la derecha"
                  aria-label="Desplazar a la derecha"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* PASO 3: ¿Cuál sería tu presupuesto? (Con opción para digitar y tarjetas limpias) */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#041f5e] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#00d8a5] text-[#041f5e] text-[11px] font-black flex items-center justify-center">
                  3
                </span>
                <span>¿Cuál es tu presupuesto aproximado?</span>
              </label>
              {draftBudget !== null && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Hasta ${draftBudget.toLocaleString('es-CO')}
                </span>
              )}
            </div>

            {/* Budget Cards - Limpias sin etiquetas inferiores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BUDGET_OPTIONS.map((b) => {
                const isSelected = draftBudget === b.value;
                return (
                  <button
                    key={b.shortLabel}
                    type="button"
                    onClick={() => {
                      setDraftBudget(b.value);
                      setCustomBudgetInput(b.value !== null ? b.value.toLocaleString('es-CO') : '');
                    }}
                    className={`py-2.5 px-3 rounded-2xl text-center border transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none active:scale-95 ${
                      isSelected
                        ? 'bg-gradient-to-b from-emerald-50 to-teal-50 border-emerald-400 shadow-sm ring-2 ring-emerald-400/30'
                        : 'bg-slate-50 hover:bg-white border-slate-200'
                    }`}
                  >
                    <span className="text-base">{b.icon}</span>
                    <span
                      className={`text-xs font-bold ${
                        isSelected ? 'text-emerald-900' : 'text-slate-800'
                      }`}
                    >
                      {b.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Campo para digitar presupuesto exacto */}
            <div className="flex items-center gap-2 pt-0.5">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                  $
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customBudgetInput}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, '');
                    if (rawValue === '') {
                      setCustomBudgetInput('');
                      setDraftBudget(null);
                    } else {
                      const numValue = parseInt(rawValue, 10);
                      setCustomBudgetInput(numValue.toLocaleString('es-CO'));
                      setDraftBudget(numValue);
                    }
                  }}
                  placeholder="Digita tu presupuesto (ej: 40.000 COP)"
                  className="w-full pl-7 pr-8 py-2 rounded-xl bg-slate-50 hover:bg-white focus:bg-white text-xs font-semibold text-slate-800 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                />
                {customBudgetInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBudgetInput('');
                      setDraftBudget(null);
                    }}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Borrar presupuesto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {draftBudget !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomBudgetInput('');
                    setDraftBudget(null);
                  }}
                  className="px-2.5 py-2 text-[11px] font-bold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0 border border-slate-200"
                >
                  Quitar límite
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Dynamic Result Counter and Big Vibrant Surprise CTA with Dices */}
        <div className="p-4 bg-slate-50/90 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="text-xs">
              <span className="font-bold text-[#041f5e] block">
                {matchingReelsCount > 0
                  ? `🎲 ${matchingReelsCount} ${matchingReelsCount === 1 ? 'publicación lista' : 'publicaciones listas'}`
                  : '🔍 Sin coincidencias directas'}
              </span>
              <span className="text-[10px] text-slate-500 font-normal">
                {draftCity !== 'all' ? `En ${draftCity}` : 'En toda la región'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-rose-600 font-medium flex items-center gap-1 transition px-2 py-1 rounded-lg hover:bg-slate-200/60 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleApplySurprise}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-white font-bold text-xs sm:text-sm transition-all duration-300 cursor-pointer active:scale-98 hover:brightness-110 flex items-center justify-center gap-2 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #ff7700 0%, #ff5500 50%, #d9480f 100%)',
              boxShadow: '0 4px 16px -2px rgba(255, 119, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
            }}
          >
            <Dices className="w-5 h-5 text-amber-100" />
            <span>¡Sorpréndeme con este plan!</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
