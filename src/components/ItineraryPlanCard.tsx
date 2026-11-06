import React, { useState } from 'react';
import {
  MapPin,
  Store,
  X,
  Route,
  Share2,
  Bookmark,
  Check,
  Compass,
} from 'lucide-react';
import { Post } from '../types';
import { PlanRouteSection } from './PlanRouteSection';

const formatPriceCOP = (amount?: number | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Precio por confirmar';
  }
  return `${Math.round(amount).toLocaleString('es-CO')} pesos`;
};

export interface ItineraryPlanCardProps {
  cardRef?: React.RefObject<HTMLDivElement>;
  planTitle: string;
  narrativeHook?: string;
  stops: Post[];
  currentCity?: string;
  totalEstimatedCost?: number;
  isEditable?: boolean;
  onTitleChange?: (newTitle: string) => void;
  onNarrativeChange?: (newNarrative: string) => void;
  onRemoveStop?: (index: number) => void;
  onSelectPost?: (post: Post) => void;
  onSharePlan?: () => void;
  onSavePlan?: () => void;
  onOpenDesigner?: () => void;
  isSaved?: boolean;
  className?: string;
  initialRouteExpanded?: boolean;
}

export const ItineraryPlanCard: React.FC<ItineraryPlanCardProps> = ({
  cardRef,
  planTitle,
  narrativeHook,
  stops,
  currentCity = 'Cajicá',
  totalEstimatedCost,
  isEditable = false,
  onTitleChange,
  onNarrativeChange,
  onRemoveStop,
  onSelectPost,
  onSharePlan,
  onSavePlan,
  onOpenDesigner,
  isSaved = false,
  className = '',
  initialRouteExpanded = false,
}) => {
  const [isRouteExpanded, setIsRouteExpanded] = useState<boolean>(initialRouteExpanded);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [editedTitle, setEditedTitle] = useState<string>(planTitle);
  const [isEditingNarrative, setIsEditingNarrative] = useState<boolean>(false);
  const [editedNarrative, setEditedNarrative] = useState<string>(narrativeHook || '');

  React.useEffect(() => {
    setEditedTitle(planTitle);
  }, [planTitle]);

  React.useEffect(() => {
    setEditedNarrative(narrativeHook || '');
  }, [narrativeHook]);

  // Compute total cost if not explicitly passed
  const calculatedTotal = totalEstimatedCost !== undefined
    ? totalEstimatedCost
    : stops.reduce((sum, p) => sum + (p.promotionalPrice || p.originalPrice || 0), 0);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (onTitleChange && editedTitle.trim()) {
      onTitleChange(editedTitle.trim());
    }
  };

  const handleNarrativeSubmit = () => {
    setIsEditingNarrative(false);
    if (onNarrativeChange) {
      onNarrativeChange(editedNarrative.trim());
    }
  };

  return (
    <div
      ref={cardRef}
      className={`w-full rounded-2xl bg-white border border-slate-200 shadow-md overflow-hidden ${className}`}
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0066FF] via-[#00B4D8] to-[#0096C7] p-3.5 sm:p-5 text-white">
        {isEditingTitle && isEditable ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              autoFocus
              className="bg-white/20 text-white font-black text-base sm:text-xl rounded-lg px-2 py-1 w-full border border-white/40 focus:outline-hidden focus:ring-2 focus:ring-white"
            />
          </div>
        ) : (
          <h2
            onClick={() => {
              if (isEditable && onTitleChange) setIsEditingTitle(true);
            }}
            className={`text-base sm:text-xl font-black tracking-tight leading-snug ${
              isEditable && onTitleChange ? 'cursor-pointer hover:underline' : ''
            }`}
            title={isEditable && onTitleChange ? 'Toca para editar el título' : undefined}
          >
            {planTitle}
          </h2>
        )}

        {isEditingNarrative && isEditable ? (
          <div className="mt-1">
            <input
              type="text"
              value={editedNarrative}
              onChange={(e) => setEditedNarrative(e.target.value)}
              onBlur={handleNarrativeSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNarrativeSubmit()}
              autoFocus
              placeholder="Añade una breve nota o dedicatoria..."
              className="bg-white/20 text-blue-50 text-xs rounded-md px-2 py-0.5 w-full border border-white/40 focus:outline-hidden focus:ring-1 focus:ring-white placeholder:text-blue-200/70"
            />
          </div>
        ) : (
          (narrativeHook || (isEditable && onNarrativeChange)) && (
            <p
              onClick={() => {
                if (isEditable && onNarrativeChange) setIsEditingNarrative(true);
              }}
              className={`text-xs text-blue-100 mt-1 font-normal ${
                isEditable && onNarrativeChange ? 'cursor-pointer hover:underline' : ''
              } ${narrativeHook ? 'line-clamp-2' : 'italic text-blue-200/70'}`}
              title={isEditable && onNarrativeChange ? 'Toca para editar la nota' : undefined}
            >
              {narrativeHook || (isEditable ? '+ Añadir nota o descripción...' : '')}
            </p>
          )
        )}

        {/* Quick Stats Pill */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/20 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1 sm:gap-1.5 bg-black/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg">
            <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-300 shrink-0" />
            <span>{stops.length} paradas</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 bg-black/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg font-normal">
            <span>Total estimado: {formatPriceCOP(calculatedTotal)}</span>
          </div>
        </div>
      </div>

      {/* Stops List with Timeline Style */}
      <div className="p-2.5 sm:p-5 space-y-2.5 sm:space-y-3.5">
        {stops.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs sm:text-sm">
            No hay actividades en este itinerario aún.
          </div>
        ) : (
          <>
            {/* Punto de Inicio en el Timeline */}
            <div className="relative pl-6 sm:pl-7 pb-1.5 sm:pb-2">
              {/* Línea vertical conectora hacia abajo */}
              <div className="absolute left-2.5 sm:left-3 top-2.5 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-blue-200 border-dashed" />

              <div className="absolute left-1 sm:left-1.5 top-1 w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-white border-2 border-[#007af7] shadow-xs flex items-center justify-center">
                <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-[#007af7]" />
              </div>

              <div className="text-[10px] sm:text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Inicio:</span>
                <span className="text-[#0056d6] font-extrabold truncate">
                  {stops[0]?.businessName || `Centro de ${currentCity || 'Cajicá'}`}
                </span>
              </div>
            </div>

            {/* Lista secuencial de paradas */}
            <div className="space-y-2.5 sm:space-y-3">
              {stops.map((post, sIdx) => {
                const isLast = sIdx === stops.length - 1;
                const fullAddress = `${post.businessAddress || 'Dirección registrada'}${
                  post.businessCity ? `, ${post.businessCity}` : ''
                }`;
                const displayCost = post.promotionalPrice || post.originalPrice;

                return (
                  <div key={post.id || sIdx} className="relative pl-6 sm:pl-8">
                    {/* Línea vertical conectora entre paradas */}
                    {!isLast && (
                      <div className="absolute left-2.5 sm:left-3 top-7 sm:top-8 bottom-[-12px] sm:bottom-[-14px] w-0.5 bg-gradient-to-b from-blue-300 via-indigo-200 to-slate-200" />
                    )}

                    {/* Badge numérico circular del paso en el timeline */}
                    <div className="absolute left-0 top-2.5 sm:top-3 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-[#0056d6] to-[#041f5e] text-white flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs ring-2 ring-white">
                      {sIdx + 1}
                    </div>

                    {/* Tarjeta de la parada */}
                    <div
                      onClick={() => onSelectPost?.(post)}
                      className="w-full rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all duration-200 p-2 sm:p-3.5 space-y-1.5 sm:space-y-2 cursor-pointer group active:scale-[0.99] select-none"
                      title="Toca para ver el anuncio completo"
                    >
                      {/* 1. Encabezado: Imagen con precio + Título y Comercio */}
                      <div className="flex items-start gap-2 sm:gap-3">
                        {/* Imagen con precio sobrepuesto (estilo OleVeci, compacta en móvil) */}
                        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 shadow-2xs relative group-hover:scale-105 transition-transform">
                          <img
                            src={post.imageUrl || '/Logo_OleVeci.png'}
                            alt={post.title}
                            className="w-full h-full object-cover"
                          />
                          {displayCost ? (
                            <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-xs text-[9px] sm:text-[11px] font-black text-emerald-400 text-center py-0.5 px-0.5 truncate leading-tight">
                              ${Math.round(displayCost).toLocaleString('es-CO')}
                            </div>
                          ) : null}
                        </div>

                        {/* Título, Comercio y Dirección con tipografía compacta y ordenada */}
                        <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <h5 className="text-[11px] sm:text-sm font-bold text-slate-900 group-hover:text-[#0056d6] transition-colors leading-snug break-words line-clamp-2 sm:line-clamp-none">
                              {post.title}
                            </h5>

                            {/* Botón Quitar parada (si es editable y hay callback) */}
                            {onRemoveStop && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveStop(sIdx);
                                }}
                                className="w-5 h-5 sm:w-6 sm:h-6 -mr-0.5 -mt-0.5 rounded-md sm:rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition shrink-0 cursor-pointer"
                                title="Quitar esta parada del plan"
                                aria-label="Quitar parada"
                              >
                                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Nombre del comercio con icono (ordenado, sin redundancia de municipio) */}
                          <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-slate-700 min-w-0">
                            <Store className="w-3 h-3 text-[#0066FF] shrink-0" />
                            <span className="truncate">{post.businessName}</span>
                          </div>

                          {/* Dirección compacta */}
                          <div className="flex items-center gap-1 text-[9.5px] sm:text-[11px] text-slate-500 min-w-0">
                            <MapPin className="w-2.5 h-2.5 text-[#ff7700] shrink-0" />
                            <span className="truncate">{fullAddress}</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Cuerpo: Descripción completa a todo lo ancho de la tarjeta */}
                      {post.description && (
                        <div className="bg-white/70 sm:bg-white/80 rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 border border-slate-200/60 shadow-2xs">
                          <p className="text-[10px] sm:text-xs text-slate-600 leading-snug sm:leading-relaxed break-words line-clamp-2 sm:line-clamp-none">
                            {post.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Sección Expandible: Ver la Ruta Directamente Dentro de la Tarjeta */}
      {isRouteExpanded && (
        <div className="p-3 sm:p-5 pt-1 border-t border-slate-200/80 bg-slate-50/70 animate-in fade-in duration-300 space-y-3">
          <div className="flex items-center justify-between pb-1 px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0066FF] animate-pulse" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                Ruta del Plan ({stops.length} paradas)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsRouteExpanded(false)}
              className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 flex items-center justify-center transition cursor-pointer"
              title="Ocultar ruta"
              aria-label="Ocultar ruta"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <PlanRouteSection
            posts={stops}
            planTitle={planTitle}
            currentCity={stops[0]?.businessCity || currentCity || 'Cajicá'}
            scheduledTime="Fin de semana"
            hideStopsTimeline={true}
            onSelectPost={(p) => onSelectPost?.(p)}
          />
        </div>
      )}

      {/* Footer Actions: Solo Iconos */}
      <div className="p-2 sm:p-2.5 bg-white flex items-center justify-between gap-1.5 border-t border-slate-100">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Botón Ver/Ocultar Ruta (Solo Icono) */}
          <button
            type="button"
            onClick={() => setIsRouteExpanded(!isRouteExpanded)}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs ${
              isRouteExpanded
                ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-900/20 ring-2 ring-blue-500/50'
                : 'text-white bg-gradient-to-r from-[#0066FF] to-[#0052cc] hover:from-blue-700 hover:to-blue-900 shadow-blue-600/20'
            }`}
            title={isRouteExpanded ? 'Ocultar ruta' : 'Ver la ruta en el mapa'}
            aria-label={isRouteExpanded ? 'Ocultar ruta' : 'Ver la ruta'}
          >
            <Route className="w-4 h-4" />
          </button>

          {/* Botón Compartir Plan (Solo Icono) */}
          {onSharePlan && (
            <button
              type="button"
              onClick={onSharePlan}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 border border-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
              title="Compartir Plan"
              aria-label="Compartir Plan"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Botón Guardar Plan (Solo Icono) */}
          {onSavePlan && (
            <button
              type="button"
              onClick={onSavePlan}
              disabled={isSaved}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs ${
                isSaved
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-[#0066FF] border border-slate-200'
              }`}
              title={isSaved ? '¡Plan Guardado!' : 'Guardar Plan'}
              aria-label={isSaved ? '¡Plan Guardado!' : 'Guardar Plan'}
            >
              {isSaved ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Botón Diseñador (Solo Icono) */}
          {onOpenDesigner && (
            <button
              type="button"
              onClick={onOpenDesigner}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-[#0066FF] border border-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
              title="Abrir en Diseñador de Rutas"
              aria-label="Abrir en Diseñador de Rutas"
            >
              <Compass className="w-4 h-4 text-blue-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
