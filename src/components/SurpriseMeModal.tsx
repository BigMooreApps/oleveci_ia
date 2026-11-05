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
  ArrowRight,
  ChevronDown,
  Globe,
  Compass,
  Scissors,
  Banknote,
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
    subtitle: 'Explorar todas las opciones disponibles',
    icon: Compass,
  },
  {
    id: 'plan_comer_algo',
    label: 'Comer y Antojarse',
    subtitle: 'Restaurantes y delicias locales',
    icon: Utensils,
  },
  {
    id: 'plan_tomar_algo',
    label: 'Café, Helado o Postre',
    subtitle: 'Cafeterías de especialidad y meriendas',
    icon: Coffee,
  },
  {
    id: 'plan_cita_romantica',
    label: 'Cita Romántica',
    subtitle: 'Ambientes íntimos y en pareja',
    icon: Heart,
  },
  {
    id: 'plan_con_amigos',
    label: 'Parche con Amigos',
    subtitle: 'Tarde de risas, picnic o juegos',
    icon: Smile,
  },
  {
    id: 'plan_noche_rumba',
    label: 'Noche, Cocteles o Rumba',
    subtitle: 'Bares y coctelería de autor',
    icon: Wine,
  },
  {
    id: 'plan_dia_con_ninos',
    label: 'En Familia o con Niños',
    subtitle: 'Espacios verdes y planes familiares',
    icon: Sun,
  },
  {
    id: 'plan_consentir_mascotas',
    label: 'Plan con Mascotas',
    subtitle: 'Pet friendly y salidas campestres',
    icon: PawPrint,
  },
  {
    id: 'plan_cuidado_personal',
    label: 'Belleza y Autocuidado',
    subtitle: 'Spas, barberías y estética',
    icon: Scissors,
  },
  {
    id: 'plan_comprar_algo',
    label: 'Compras y Vitrineo',
    subtitle: 'Moda, tecnología y tiendas locales',
    icon: ShoppingBag,
  },
  {
    id: 'plan_cuidar_la_nave',
    label: 'Cuidado de mi Vehículo',
    subtitle: 'Lavaderos, talleres y accesorios',
    icon: Car,
  },
];

// Curated budget options - all using the Banknote icon
const BUDGET_OPTIONS = [
  {
    value: null,
    label: 'Cualquiera',
    shortLabel: 'Cualquiera',
    subtitle: 'Sin límite de presupuesto',
    icon: Banknote,
  },
  {
    value: 30000,
    label: 'Económico',
    shortLabel: 'Hasta $30.000',
    subtitle: 'Planes y promociones accesibles',
    icon: Banknote,
  },
  {
    value: 50000,
    label: 'Moderado',
    shortLabel: 'Hasta $50.000',
    subtitle: 'Salidas cotidianas y almuerzos',
    icon: Banknote,
  },
  {
    value: 100000,
    label: 'Especial',
    shortLabel: 'Hasta $100.000',
    subtitle: 'Ocasiones especiales y planes completos',
    icon: Banknote,
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
        icon: Banknote,
      };
    }
    const predefined = BUDGET_OPTIONS.find((b) => b.value === draftBudget);
    if (predefined && predefined.value !== null) {
      return {
        label: predefined.shortLabel,
        subtitle: `${predefined.label} (Hasta $${predefined.value.toLocaleString('es-CO')} COP)`,
        icon: Banknote,
      };
    }
    return {
      label: `Hasta $${draftBudget.toLocaleString('es-CO')}`,
      subtitle: `Presupuesto personalizado ($${draftBudget.toLocaleString('es-CO')} COP)`,
      icon: Banknote,
    };
  }, [draftBudget]);

  const SelectedBudgetIcon = selectedBudgetInfo.icon;

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
      const planOptions = PLAN_EXPERIENCES.filter((p) => p.id !== 'all');
      const randomPlan = planOptions[Math.floor(Math.random() * planOptions.length)];

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
                <h3 className="font-bold text-base sm:text-lg text-slate-800 leading-snug">
                  ¿Qué quieres hacer hoy?
                </h3>
                <p className="text-xs text-slate-500 font-normal">
                  Filtra tu plan en 3 sencillos pasos
                </p>
              </div>
            </div>

            {/* Quick Randomizer Button with Dice & Close */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRandomizePlan}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200/80 text-xs font-medium transition active:scale-95 cursor-pointer shadow-2xs ${
                  randomAnimation ? 'animate-spin' : ''
                }`}
                title="Elegir una combinación al azar"
              >
                <Dices className="w-3.5 h-3.5 text-[#ff7700]" />
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

        {/* Scrollable Content Body with 3 Clean Dropdowns */}
        <div
          ref={modalBodyRef}
          className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain"
        >
          {/* PASO 1: ¿Qué tipo de plan tienes en mente? */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#ff7700] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <span>¿Qué tipo de plan tienes en mente?</span>
            </label>

            {/* Selector Desplegable Paso 1 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'plan' ? null : 'plan'))}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left transition-all duration-200 border cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.99] ${
                  openDropdown === 'plan'
                    ? 'bg-white border-[#ff7700] ring-2 ring-[#ff7700]/20 shadow-sm'
                    : 'bg-slate-50/70 hover:bg-white hover:border-slate-300 border-slate-200/80 shadow-2xs'
                }`}
                aria-expanded={openDropdown === 'plan'}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-tr from-amber-500 to-[#ff7700] text-white shadow-xs">
                    <SelectedPlanIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">
                      {selectedPlan.label}
                    </div>
                    <div className="text-xs text-slate-500 font-normal truncate">
                      {selectedPlan.subtitle}
                    </div>
                  </div>
                </div>

                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    openDropdown === 'plan' ? 'rotate-180 text-[#ff7700]' : ''
                  }`}
                />
              </button>

              {/* Lista Desplegable Abierta Paso 1 */}
              {openDropdown === 'plan' && (
                <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 max-h-60 overflow-y-auto overscroll-contain space-y-0.5 animate-in fade-in zoom-in-98 duration-150">
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
                                ? 'bg-gradient-to-tr from-amber-500 to-[#ff7700] text-white shadow-2xs'
                                : 'bg-orange-50 text-[#ff7700]'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span
                              className={`text-xs block truncate ${
                                isSelected ? 'font-semibold text-[#ff7700]' : 'font-medium text-slate-700'
                              }`}
                            >
                              {plan.label}
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal block truncate">
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
          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#ff7700] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <span>¿En dónde te gustaría vivirlo?</span>
            </label>

            {/* Selector Desplegable Paso 2 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'city' ? null : 'city'))}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left transition-all duration-200 border cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.99] ${
                  openDropdown === 'city'
                    ? 'bg-white border-[#ff7700] ring-2 ring-[#ff7700]/20 shadow-sm'
                    : 'bg-slate-50/70 hover:bg-white hover:border-slate-300 border-slate-200/80 shadow-2xs'
                }`}
                aria-expanded={openDropdown === 'city'}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-tr from-amber-500 to-[#ff7700] text-white shadow-xs">
                    {draftCity === 'all' ? (
                      <Globe className="w-4 h-4 text-white" />
                    ) : (
                      <MapPin className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">
                      {draftCity === 'all' ? 'Todos los municipios' : draftCity}
                    </div>
                    <div className="text-xs text-slate-500 font-normal truncate">
                      {draftCity === 'all' ? 'Sabana Centro y alrededores' : 'Sabana Centro'}
                    </div>
                  </div>
                </div>

                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    openDropdown === 'city' ? 'rotate-180 text-[#ff7700]' : ''
                  }`}
                />
              </button>

              {/* Lista Desplegable Abierta Paso 2 */}
              {openDropdown === 'city' && (
                <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 max-h-60 overflow-y-auto overscroll-contain space-y-0.5 animate-in fade-in zoom-in-98 duration-150">
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
                            ? 'bg-gradient-to-tr from-amber-500 to-[#ff7700] text-white shadow-2xs'
                            : 'bg-orange-50 text-[#ff7700]'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span
                          className={`text-xs block truncate ${
                            draftCity === 'all' ? 'font-semibold text-[#ff7700]' : 'font-medium text-slate-700'
                          }`}
                        >
                          Todos los municipios
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal block truncate">
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
                                ? 'bg-gradient-to-tr from-amber-500 to-[#ff7700] text-white shadow-2xs'
                                : 'bg-orange-50 text-[#ff7700]'
                            }`}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <span
                            className={`text-xs truncate ${
                              isSelected ? 'font-semibold text-[#ff7700]' : 'font-medium text-slate-700'
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
          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#ff7700] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <span>¿Cuál es tu presupuesto aproximado?</span>
            </label>

            {/* Selector Desplegable Paso 3 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'budget' ? null : 'budget'))}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left transition-all duration-200 border cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.99] ${
                  openDropdown === 'budget'
                    ? 'bg-white border-[#ff7700] ring-2 ring-[#ff7700]/20 shadow-sm'
                    : 'bg-slate-50/70 hover:bg-white hover:border-slate-300 border-slate-200/80 shadow-2xs'
                }`}
                aria-expanded={openDropdown === 'budget'}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-tr from-amber-500 to-[#ff7700] text-white shadow-xs">
                    <SelectedBudgetIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">
                      {selectedBudgetInfo.label}
                    </div>
                    <div className="text-xs text-slate-500 font-normal truncate">
                      {selectedBudgetInfo.subtitle}
                    </div>
                  </div>
                </div>

                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    openDropdown === 'budget' ? 'rotate-180 text-[#ff7700]' : ''
                  }`}
                />
              </button>

              {/* Lista Desplegable Abierta Paso 3 */}
              {openDropdown === 'budget' && (
                <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 max-h-64 overflow-y-auto overscroll-contain space-y-2 animate-in fade-in zoom-in-98 duration-150">
                  {/* Opciones rápidas */}
                  <div className="space-y-0.5">
                    {BUDGET_OPTIONS.map((b) => {
                      const IconComponent = b.icon;
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
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-gradient-to-tr from-amber-500 to-[#ff7700] text-white shadow-2xs'
                                  : 'bg-orange-50 text-[#ff7700]'
                              }`}
                            >
                              <IconComponent className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span
                                className={`text-xs block truncate ${
                                  isSelected ? 'font-semibold text-[#ff7700]' : 'font-medium text-slate-700'
                                }`}
                              >
                                {b.shortLabel}
                              </span>
                              <span className="text-[11px] text-slate-400 font-normal block truncate">
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
                    <div className="text-xs font-medium text-slate-600 mb-1.5 flex items-center justify-between">
                      <span>O escribe un presupuesto exacto:</span>
                      {draftBudget !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomBudgetInput('');
                            setDraftBudget(null);
                          }}
                          className="text-[11px] text-slate-400 hover:text-rose-600 font-normal cursor-pointer transition"
                        >
                          Quitar límite
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium text-xs">
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
                        className="w-full pl-7 pr-8 py-2 rounded-xl bg-slate-50 hover:bg-white focus:bg-white text-xs font-normal text-slate-800 border border-slate-200 focus:border-[#ff7700] focus:ring-2 focus:ring-[#ff7700]/20 outline-none transition"
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

        {/* Footer with Modern Balanced Layout */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 space-y-3 shrink-0">
          {/* Top Status Bar: Live count on the left, subtle Restablecer on the right */}
          <div className="flex items-center justify-between text-xs px-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  matchingReelsCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="font-semibold text-slate-700 truncate">
                {matchingReelsCount > 0
                  ? `${matchingReelsCount} ${
                      matchingReelsCount === 1 ? 'publicación lista' : 'publicaciones listas'
                    }`
                  : 'Sin coincidencias directas'}
              </span>
              <span className="text-slate-400 text-[11px] font-normal truncate">
                · {draftCity !== 'all' ? draftCity : 'Toda la región'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-[#ff7700] font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0 py-0.5 px-2 rounded-lg hover:bg-orange-50/60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          </div>

          {/* Primary Action CTA: Full-width modern button */}
          <button
            type="button"
            onClick={handleApplySurprise}
            className="w-full py-3 px-5 rounded-2xl text-white font-semibold text-sm transition-all duration-200 cursor-pointer active:scale-[0.99] hover:brightness-105 flex items-center justify-center gap-2 shadow-md shadow-orange-500/20"
            style={{
              background: 'linear-gradient(135deg, #ff7700 0%, #ff5500 50%, #d9480f 100%)',
            }}
          >
            <Dices className="w-4 h-4 text-white" />
            <span>¡Sorpréndeme con este plan!</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
