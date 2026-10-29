import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { PriceScopeMaster } from '../../types';
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { MasterTableIconPicker } from './MasterTableIconPicker';
import { PostTypeIconDisplay, isEmoji } from '../../utils/postTypeIcons';

export const AdminPriceScopesTab: React.FC = () => {
  const {
    priceScopes,
    addPriceScope,
    updatePriceScope,
    deletePriceScope,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scopeToEdit, setScopeToEdit] = useState<PriceScopeMaster | null>(null);
  const [label, setLabel] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [badge, setBadge] = useState('');
  const [iconName, setIconName] = useState('👤');
  const [scopeToDelete, setScopeToDelete] = useState<PriceScopeMaster | null>(null);

  const filteredScopes = useMemo(() => {
    if (!searchQuery.trim()) return priceScopes;
    const q = searchQuery.toLowerCase();
    return priceScopes.filter(
      (p) => p.label.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
    );
  }, [priceScopes, searchQuery]);

  const handleOpenCreate = () => {
    setScopeToEdit(null);
    setLabel('');
    setSubtitle('');
    setBadge('');
    setIconName('👤');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (scope: PriceScopeMaster) => {
    setScopeToEdit(scope);
    setLabel(scope.label);
    setSubtitle(scope.subtitle || '');
    setBadge(scope.badge || '');
    setIconName(scope.emoji || scope.iconName || '👤');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    const chosen = iconName.trim() || '👤';

    if (scopeToEdit) {
      updatePriceScope(scopeToEdit.id, {
        label: label.trim(),
        subtitle: subtitle.trim(),
        badge: badge.trim() || undefined,
        iconName: chosen,
        emoji: chosen,
      });
    } else {
      addPriceScope({
        label: label.trim(),
        subtitle: subtitle.trim(),
        badge: badge.trim() || undefined,
        iconName: chosen,
        emoji: chosen,
      });
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!scopeToDelete) return;
    if (priceScopes.length <= 1) {
      alert('Debe existir al menos una modalidad de precio en el sistema.');
      setScopeToDelete(null);
      return;
    }
    deletePriceScope(scopeToDelete.id);
    setScopeToDelete(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header & Actions */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              Cobertura y Modalidad de Precio
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#007af7] border border-blue-200/60">
                {priceScopes.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Modalidades de cobertura económica (individual, parejas, combos, reservas por mesa o tiempo).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-3.5 py-2 rounded-xl bg-[#007af7] hover:bg-blue-600 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nueva Modalidad</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar modalidades por nombre o descripción..."
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#007af7] focus:ring-2 focus:ring-[#007af7]/15 shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Price Scopes List View */}
      {filteredScopes.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
          {searchQuery ? `No se encontraron modalidades de precio que coincidan con "${searchQuery}".` : 'No hay modalidades de precio registradas en el sistema.'}
          {searchQuery && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#007af7] font-bold hover:underline cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5 sm:space-y-2">
          {filteredScopes.map((scope) => (
            <div
              key={scope.id}
              className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-[#007af7] border border-blue-100/80 flex items-center justify-center shrink-0 shadow-2xs select-none">
                  <PostTypeIconDisplay
                    iconName={scope.iconName || scope.emoji}
                    className="w-4 h-4 text-[#007af7]"
                    emojiClassName="text-base"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {scope.label}
                    </h4>
                  </div>
                  {scope.subtitle && (
                    <p className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">
                      {scope.subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(scope)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#007af7] hover:bg-blue-50 active:scale-95 transition cursor-pointer"
                  title="Editar modalidad"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setScopeToDelete(scope)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition cursor-pointer"
                  title="Eliminar modalidad"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#007af7] border border-blue-200/60 flex items-center justify-center shrink-0">
                  <PostTypeIconDisplay
                    iconName={iconName}
                    className="w-4 h-4 text-[#007af7]"
                    emojiClassName="text-lg"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {scopeToEdit ? 'Editar Modalidad de Precio' : 'Nueva Modalidad de Precio'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Define cómo se calcula o presenta el precio de la experiencia
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nombre de la Modalidad *
                </label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej: Por pareja (2 personas), Por mesa..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#007af7] focus:bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Descripción o Subtítulo
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ej: Combo o experiencia para 2 personas..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#007af7] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Etiqueta corta (Badge opcional)
                </label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="Ej: 2 personas, Por mesa, Gratis..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#007af7] focus:bg-white"
                />
              </div>

              {/* Unified Icon Selector */}
              <div className="pt-1">
                <MasterTableIconPicker
                  value={iconName}
                  onChange={setIconName}
                  label="Icono Representativo"
                  subtitle="Elige un icono vectorial en color azul o un emoji para esta modalidad"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!label.trim()}
                  className="px-4 py-2 rounded-xl bg-[#007af7] hover:bg-blue-600 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{scopeToEdit ? 'Guardar Cambios' : 'Crear Modalidad'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {scopeToDelete && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                ¿Eliminar "{scopeToDelete.label}"?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Esta modalidad ya no estará disponible para nuevas publicaciones en el modal de creación.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setScopeToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition flex-1 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex-1 cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

