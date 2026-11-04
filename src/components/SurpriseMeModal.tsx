import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronDown,
  Globe,
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
    subtitle: 'Explorar todas las categorías disponibles',
    icon: Sparkles,
    color: 'from-amber-400 to-[#ff7700]',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-300',
  },
  {
    id: 'plan_comer_algo',
    label: 'Comer y Antojarse',
    subtitle: 'Restaurantes, comida rápida, delicias locales',
    icon: Utensils,
    color: 'from-orange-500 to-amber-500',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
  },
  {
    id: 'plan_tomar_algo',
    label: 'Café, Helado o Postre',
    subtitle: 'Cafeterías de especialidad, postres y meriendas',
    icon: Coffee,
    color: 'from-amber-600 to-yellow-500',
    textColor: 'text-amber-900',
    borderColor: 'border-amber-300',
  },
  {
    id: 'plan_cita_romantica',
    label: 'Cita Romántica',
    subtitle: 'Ambientes íntimos, cenas en pareja y velas',
    icon: Heart,
    color: 'from-rose-500 to-pink-500',
    textColor: 'text-rose-800',
    borderColor: 'border-rose-300',
  },
  {
    id: 'plan_con_amigos',
    label: 'Parche con Amigos',
    subtitle: 'Tarde de risas, juegos, picnic o charlas',
    icon: Smile,
    color: 'from-sky-500 to-blue-600',
    textColor: 'text-sky-800',
    borderColor: 'border-sky-300',
  },
  {
    id: 'plan_noche_rumba',
    label: 'Noche, Cocteles o Rumba',
    subtitle: 'Bares, música en vivo y coctelería de autor',
    icon: Wine,
    color: 'from-purple-600 to-indigo-600',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-300',
  },
  {
    id: 'plan_dia_con_ninos',
    label: 'En Familia o con Niños',
    subtitle: 'Espacios verdes, juegos infantiles y planes familiares',
    icon: Sun,
    color: 'from-emerald-500 to-teal-600',
    textColor: 'text-emerald-800',
    borderColor: 'border-emerald-300',
  },
  {
    id: 'plan_consentir_mascotas',
    label: 'Plan con Mascotas',
    subtitle: 'Pet friendly, paseos campestres y mimos',
    icon: PawPrint,
    color: 'from-teal-500 to-cyan-600',
    textColor: 'text-teal-800',
    borderColor: 'border-teal-300',
  },
  {
    id: 'plan_cuidado_personal',
    label: 'Belleza y Autocuidado',
    subtitle: 'Spas, barberías, peluquerías y bienestar',
    icon: Sparkles,
    color: 'from-fuchsia-500 to-pink-600',
    textColor: 'text-fuchsia-800',
    borderColor: 'border-fuchsia-300',
  },
  {
    id: 'plan_comprar_algo',
    label: 'Compras y Vitrineo',
    subtitle: 'Moda, tecnología, artesanías y tiendas locales',
    icon: ShoppingBag,
    color: 'from-blue-600 to-cyan-500',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
  },
  {
    id: 'plan_cuidar_la_nave',
    label: 'Cuidado de mi Vehículo',
    subtitle: 'Lavaderos, talleres, detailing y accesorios',
    icon: Car,
    color: 'from-slate-600 to-slate-800',
    textColor: 'text-slate-800',
    borderColor: 'border-slate-300',
  },
];

// Curated budget options
const BUDGET_OPTIONS = [
  {
    value: null,
    label: 'Sin límite',
    shortLabel: 'Cualquiera',
    subtitle: 'Ver publicaciones con cualquier rango de precio',
    icon: '👑',
  },
  {
    value: 30000,
    label: 'Económico',
    shortLabel: 'Hasta $30.000',
    subtitle: 'Planes y promociones accesibles',
    icon: '🪙',
  },
  {
    value: 50000,
    label: 'Moderado',
    shortLabel: 'Hasta $50.000',
    subtitle: 'Ideal para salidas cotidianas y almuerzos',
    icon: '💵',
  },
  {
    value: 100000,
    label: 'Especial',
    shortLabel: 'Hasta $100.000',
    subtitle: 'Para ocasiones especiales y planes completos',
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

  // Track which dropdown is open ('plan' | 'city' | 'budget' | null)
  const [openDropdown, setOpenDropdown] = useState<'plan' | 'city' | 'budget' | null>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (modalBodyRef.current && !modalBodyRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [openDropdown]);

  // Sync with AppContext when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftPlanType(selectedPlanType || 'all');
      setDraftCity(currentCity || 'all');
      setDraftBudget(maxPlanBudget);
      setCustomBudgetInput(maxPlanBudget !== null ? maxPlanBudget.toLocaleString('es-CO') : '');
      setDraftSort(sortOrder);
      setOpenDropdown(null);
    }
  }, [isOpen, selectedPlanType, currentCity, maxPlanBudget, sortOrder]);

  // Unique list of municipalities
  const cities: string[] = useMemo(() => {
    const list =
      municipalities && municipalities.length > 0
        ? municipalities.map((m) => m.name)
        : Array.from(new Set(sectors.map((s) => s.cityName)));
    return [...list].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [municipalities, sectors]);

  // Selected plan info
  const selectedPlan = useMemo(() => {
    return PLAN_EXPERIENCES.find((p) => p.id === draftPlanType) || PLAN_EXPERIENCES[0];
  }, [draftPlanType]);
  const SelectedPlanIcon = selectedPlan.icon;

  // Selected budget info
  const selectedBudgetInfo = useMemo(() => {
    if (draftBudget === null) {
      return {
        label: 'Cualquiera',
        subtitle: 'Sin límite de presupuesto',
        icon: '👑',
      };
    }
    const predefined = BUDGET_OPTIONS.find((b) => b.value === draftBudget);
    if (predefined && predefined.value !== null) {
      return {
        label: predefined.shortLabel,
        subtitle: `${predefined.label} (Hasta $${predefined.value.toLocaleString('es-CO')} COP)`,
        icon: predefined.icon,
      };
    }
    return {
      label: `Hasta $${draftBudget.toLocaleString('es-CO')}`,
      subtitle: `Presupuesto personalizado ($${draftBudget.toLocaleString('es-CO')} COP)`,
      icon: '💵',
    };
  }, [draftBudget]);

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
    setOpenDropdown(null);
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
    setOpenDropdown(null);
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
                <p className="text-[11px] text-slate-500">
                  Filtra tu plan perfecto en 3 simples pasos
                </p>
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

        {/* Scrollable Content Body with 3 Elegant Custom Dropdowns */}
        <div
          ref={modalBodyRef}
          className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain"
        >
          {/* PASO 1: ¿Qué tipo de plan tienes en mente? */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#041f5e] uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#ff7700] text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-xs">
                  1
                </span>
                <span>¿Qué tipo de plan tienes en mente?</span>
              </label>
              {draftPlanType !== 'all' && (
                <button
                  type="button"
                  onClick={() => setDraftPlanType('all')}
                  className="text-[11px] text-[#ff7700] font-bold hover:underline cursor-pointer"
                >
                  Restablecer
                </button>
              )}
            </div>

            {/* Selector Desplegable Elegante Paso 1 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'plan' ? null : 'plan'))}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left transition-all duration-200 border cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.99] ${
                  openDropdown === 'plan'
                    ? 'bg-white border-[#ff7700] ring-2 ring-[#ff7700]/25 shadow-md'
                    : 'bg-slate-50/80 hover:bg-white hover:border-slate-300 border-slate-200/90 shadow-2xs'
                }`}
                aria-expanded={openDropdown === 'plan'}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                      draftPlanType !== 'all'
                        ? `bg-gradient-to-tr ${selectedPlan.color} text-white shadow-xs`
                        : 'bg-gradient-to-tr from-amber-400 to-[#ff7700] text-white shadow-xs'
                    }`}
                  >
                    <SelectedPlanIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-[#041f5e] truncate">
                      {selectedPlan.label}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium truncate">
                      {selectedPlan.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-[#ff7700] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200 hidden xs:inline-block">
                    {draftPlanType === 'all' ? '11 opciones' : 'Seleccionado'}
                  </span>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      openDropdown === 'plan' ? 'bg-orange-100 text-[#ff7700]' : 'text-slate-400'
                    }`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        openDropdown === 'plan' ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              </button>

              {/* Lista Desplegable Abierta Paso 1 */}
              {openDropdown === 'plan' && (
                <div className="mt-2 bg-white rounded-2xl border border-slate-200/90 shadow-xl p-2 max-h-60 overflow-y-auto overscroll-contain space-y-1 animate-in fade-in zoom-in-98 duration-150">
                  {PLAN_EXPERIENCES.map((plan) => {
                    const IconComponent = plan.icon;
                    const isSelected = draftPlanType === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setDraftPlanType(plan.id);
                          setOpenDropdown(null);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left transition-all duration-150 flex items-center justify-between gap-2.5 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-orange-50/80 border border-[#ff7700]/30 shadow-2xs'
                            : 'hover:bg-slate-50 border border-transparent text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? `bg-gradient-to-tr ${plan.color} text-white shadow-2xs`
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span
                              className={`text-xs font-bold block truncate ${
                                isSelected ? 'text-[#041f5e]' : 'text-slate-800'
                              }`}
                            >
                              {plan.label}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {plan.subtitle}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-[#ff7700] text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* PASO 2: ¿En dónde te gustaría vivirlo? */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#041f5e] uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#ff7700] text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-xs">
                  2
                </span>
                <span>¿En dónde te gustaría vivirlo?</span>
              </label>
              {draftCity !== 'all' && (
                <button
                  type="button"
                  onClick={() => setDraftCity('all')}
                  className="text-[11px] text-[#ff7700] font-bold hover:underline cursor-pointer"
                >
                  Ver toda la región
                </button>
              )}
            </div>

            {/* Selector Desplegable Elegante Paso 2 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'city' ? null : 'city'))}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left transition-all duration-200 border cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.99] ${
                  openDropdown === 'city'
                    ? 'bg-white border-[#ff7700] ring-2 ring-[#ff7700]/25 shadow-md'
                    : 'bg-slate-50/80 hover:bg-white hover:border-slate-300 border-slate-200/90 shadow-2xs'
                }`}
                aria-expanded={openDropdown === 'city'}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                      draftCity !== 'all'
                        ? 'bg-gradient-to-tr from-[#007af7] to-sky-500 text-white shadow-xs'
                        : 'bg-gradient-to-tr from-[#041f5e] to-blue-900 text-white shadow-xs'
                    }`}
                  >
                    {draftCity === 'all' ? (
                      <Globe className="w-4 h-4 text-white" />
                    ) : (
                      <MapPin className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-[#041f5e] truncate">
                      {draftCity === 'all' ? 'Todos los municipios' : draftCity}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium truncate">
                      {draftCity === 'all'
                        ? 'Explorando toda Sabana Centro'
                        : `Municipio seleccionado: ${draftCity}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-[#007af7] bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 hidden xs:inline-block">
                    {draftCity === 'all' ? `${cities.length} municipios` : 'Filtro activo'}
                  </span>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      openDropdown === 'city' ? 'bg-orange-100 text-[#ff7700]' : 'text-slate-400'
                    }`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        openDropdown === 'city' ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              </button>

              {/* Lista Desplegable Abierta Paso 2 */}
              {openDropdown === 'city' && (
                <div className="mt-2 bg-white rounded-2xl border border-slate-200/90 shadow-xl p-2 max-h-60 overflow-y-auto overscroll-contain space-y-1 animate-in fade-in zoom-in-98 duration-150">
                  {/* Opción 1: Todos los municipios */}
                  <button
                    type="button"
                    onClick={() => {
                      setDraftCity('all');
                      setOpenDropdown(null);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left transition-all duration-150 flex items-center justify-between gap-2.5 cursor-pointer select-none ${
                      draftCity === 'all'
                        ? 'bg-orange-50/80 border border-[#ff7700]/30 shadow-2xs'
                        : 'hover:bg-slate-50 border border-transparent text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          draftCity === 'all'
                            ? 'bg-[#041f5e] text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span
                          className={`text-xs font-bold block ${
                            draftCity === 'all' ? 'text-[#041f5e]' : 'text-slate-800'
                          }`}
                        >
                          Todos los municipios
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Toda la cobertura en Sabana Centro
                        </span>
                      </div>
                    </div>
                    {draftCity === 'all' && (
                      <span className="w-4 h-4 rounded-full bg-[#ff7700] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  {/* Municipios ordenados alfabéticamente */}
                  {cities.map((city) => {
                    const isSelected = draftCity.toLowerCase() === city.toLowerCase();
                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => {
                          setDraftCity(city);
                          setOpenDropdown(null);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left transition-all duration-150 flex items-center justify-between gap-2.5 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-orange-50/80 border border-[#ff7700]/30 shadow-2xs'
                            : 'hover:bg-slate-50 border border-transparent text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-gradient-to-tr from-[#007af7] to-sky-500 text-white shadow-2xs'
                                : 'bg-slate-100 text-[#007af7]'
                            }`}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <span
                            className={`text-xs font-bold truncate ${
                              isSelected ? 'text-[#041f5e]' : 'text-slate-800'
                            }`}
                          >
                            {city}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-[#ff7700] text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* PASO 3: ¿Cuál es tu presupuesto aproximado? */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#041f5e] uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#ff7700] text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-xs">
                  3
                </span>
                <span>¿Cuál es tu presupuesto aproximado?</span>
              </label>
              {draftBudget !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftBudget(null);
                    setCustomBudgetInput('');
                  }}
                  className="text-[11px] text-[#ff7700] font-bold hover:underline cursor-pointer"
                >
                  Sin límite
                </button>
              )}
            </div>

            {/* Selector Desplegable Elegante Paso 3 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'budget' ? null : 'budget'))}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left transition-all duration-200 border cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.99] ${
                  openDropdown === 'budget'
                    ? 'bg-white border-[#ff7700] ring-2 ring-[#ff7700]/25 shadow-md'
                    : 'bg-slate-50/80 hover:bg-white hover:border-slate-300 border-slate-200/90 shadow-2xs'
                }`}
                aria-expanded={openDropdown === 'budget'}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-[#ff7700] text-white flex items-center justify-center shrink-0 shadow-xs text-base">
                    {selectedBudgetInfo.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-[#041f5e] truncate">
                      {selectedBudgetInfo.label}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium truncate">
                      {selectedBudgetInfo.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {draftBudget !== null && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hidden xs:inline-block">
                      Hasta ${draftBudget.toLocaleString('es-CO')}
                    </span>
                  )}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      openDropdown === 'budget' ? 'bg-orange-100 text-[#ff7700]' : 'text-slate-400'
                    }`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        openDropdown === 'budget' ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              </button>

              {/* Lista Desplegable Abierta Paso 3 */}
              {openDropdown === 'budget' && (
                <div className="mt-2 bg-white rounded-2xl border border-slate-200/90 shadow-xl p-2.5 max-h-64 overflow-y-auto overscroll-contain space-y-2 animate-in fade-in zoom-in-98 duration-150">
                  {/* Opciones rápidas predeterminadas */}
                  <div className="space-y-1">
                    {BUDGET_OPTIONS.map((b) => {
                      const isSelected = draftBudget === b.value;
                      return (
                        <button
                          key={b.shortLabel}
                          type="button"
                          onClick={() => {
                            setDraftBudget(b.value);
                            setCustomBudgetInput(
                              b.value !== null ? b.value.toLocaleString('es-CO') : ''
                            );
                            setOpenDropdown(null);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left transition-all duration-150 flex items-center justify-between gap-2.5 cursor-pointer select-none ${
                            isSelected
                              ? 'bg-orange-50/80 border border-[#ff7700]/30 shadow-2xs'
                              : 'hover:bg-slate-50 border border-transparent text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-lg shrink-0">{b.icon}</span>
                            <div className="min-w-0">
                              <span
                                className={`text-xs font-bold block truncate ${
                                  isSelected ? 'text-[#041f5e]' : 'text-slate-800'
                                }`}
                              >
                                {b.shortLabel}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate">
                                {b.subtitle}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#ff7700] text-white flex items-center justify-center shrink-0 shadow-2xs">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Campo interactivo para digitar presupuesto exacto */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>O escribe tu presupuesto exacto:</span>
                      {draftBudget !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomBudgetInput('');
                            setDraftBudget(null);
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Quitar límite
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
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
                        placeholder="Ej: 40.000 COP"
                        className="w-full pl-7 pr-8 py-2 rounded-xl bg-slate-50 hover:bg-white focus:bg-white text-xs font-semibold text-slate-800 border border-slate-200 focus:border-[#ff7700] focus:ring-2 focus:ring-[#ff7700]/20 outline-none transition"
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
                  </div>
                </div>
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
                  ? `🎲 ${matchingReelsCount} ${
                      matchingReelsCount === 1 ? 'publicación lista' : 'publicaciones listas'
                    }`
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
              boxShadow:
                '0 4px 16px -2px rgba(255, 119, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
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
