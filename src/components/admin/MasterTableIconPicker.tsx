import React, { useState, useMemo } from 'react';
import {
  POST_TYPE_LUCIDE_ICONS,
  POST_TYPE_EMOJI_PRESETS,
  PostTypeIconDisplay,
  isEmoji,
} from '../../utils/postTypeIcons';
import { Sparkles, Smile, Search, X } from 'lucide-react';

interface MasterTableIconPickerProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  subtitle?: string;
}

export const MasterTableIconPicker: React.FC<MasterTableIconPickerProps> = ({
  value,
  onChange,
  label = 'Icono Representativo',
  subtitle = 'Selecciona un icono vectorial en color azul o un emoji personalizado',
}) => {
  const [activeTab, setActiveTab] = useState<'lucide' | 'emoji'>('emoji');
  const [iconSearchQuery, setIconSearchQuery] = useState('');

  const allIconKeys = useMemo(() => Object.keys(POST_TYPE_LUCIDE_ICONS), []);

  const filteredIcons = useMemo(() => {
    if (!iconSearchQuery.trim()) return allIconKeys;
    const q = iconSearchQuery.toLowerCase().trim();
    return allIconKeys.filter((key) => key.toLowerCase().includes(q));
  }, [allIconKeys, iconSearchQuery]);

  return (
    <div className="space-y-3">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <label className="block text-xs font-bold text-slate-900">{label}</label>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Tab switch */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'emoji'
                ? 'bg-[#007af7] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Emojis</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lucide')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'lucide'
                ? 'bg-[#007af7] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Vectoriales</span>
          </button>
        </div>
      </div>

      {/* Live Preview Box */}
      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007af7] border border-blue-200/70 flex items-center justify-center text-lg shadow-2xs shrink-0 select-none">
            <PostTypeIconDisplay
              iconName={value}
              className="w-5 h-5 text-[#007af7]"
              emojiClassName="text-xl"
            />
          </div>
          <div className="truncate min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
              Vista previa unificada
            </span>
            <span className="text-xs font-bold text-slate-800 truncate block">
              {value || 'Sin icono asignado'}
            </span>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-[#007af7] bg-blue-100/60 px-2 py-0.5 rounded-md border border-blue-200/50 shrink-0">
          {activeTab === 'lucide' ? 'Vectorial Azul' : 'Emoji'}
        </span>
      </div>

      {/* Tab 1: Lucide vector icons grid */}
      {activeTab === 'lucide' && (
        <div className="space-y-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={iconSearchQuery}
              onChange={(e) => setIconSearchQuery(e.target.value)}
              placeholder="Filtrar iconos vectoriales..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#007af7] focus:ring-1 focus:ring-[#007af7]/20"
            />
            {iconSearchQuery && (
              <button
                type="button"
                onClick={() => setIconSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Grid */}
          <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/80 max-h-48 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5">
              {filteredIcons.map((key) => {
                const isSelected = value === key;
                const IconComponent = POST_TYPE_LUCIDE_ICONS[key];
                if (!IconComponent) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    title={key}
                    className={`h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#007af7] text-white shadow-xs scale-105 ring-2 ring-[#007af7]/30'
                        : 'bg-white text-slate-700 hover:text-[#007af7] hover:bg-blue-50 border border-slate-200/70 hover:border-blue-200'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
            {filteredIcons.length === 0 && (
              <p className="text-center py-4 text-xs text-slate-400">
                No se encontraron iconos para "{iconSearchQuery}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Curated & custom emojis */}
      {activeTab === 'emoji' && (
        <div className="space-y-2.5">
          {/* Custom text input */}
          <div>
            <input
              type="text"
              value={isEmoji(value) ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Escribe o pega un emoji aquí (ej. 🌟, 🍕, 🎯)..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#007af7] focus:ring-2 focus:ring-[#007af7]/15"
            />
          </div>

          {/* Preset Emojis Grid */}
          <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/80 max-h-48 overflow-y-auto no-scrollbar">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Sugerencias rápidas:
            </p>
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
              {POST_TYPE_EMOJI_PRESETS.map((em, idx) => {
                const isSelected = value === em;
                return (
                  <button
                    key={`${em}-${idx}`}
                    type="button"
                    onClick={() => onChange(em)}
                    className={`h-9 text-lg rounded-lg flex items-center justify-center transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#007af7]/20 border-2 border-[#007af7] scale-105 shadow-2xs'
                        : 'bg-white hover:bg-blue-50 border border-slate-200/70 hover:border-blue-200'
                    }`}
                  >
                    {em}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
