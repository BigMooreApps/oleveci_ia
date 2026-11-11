import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { NavMenuItemId } from '../../types';
import {
  Home,
  Compass,
  Route,
  BookOpen,
  MapPin,
  Bot,
  Bell,
  Store,
  Menu,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  CheckCircle2,
  Info,
  Sparkles,
  UserCog,
} from 'lucide-react';

const MENU_ICONS: Record<NavMenuItemId, React.ElementType> = {
  home: Home,
  explorer: Compass,
  plans: Route,
  directory: BookOpen,
  maps: MapPin,
  oli: Bot,
  notifications: Bell,
  merchant: Store,
};

const MENU_COLOR_CLASSES: Record<NavMenuItemId, { bg: string; text: string; border: string }> = {
  home: { bg: 'bg-blue-50', text: 'text-[#007af7]', border: 'border-blue-200' },
  explorer: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
  plans: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  directory: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  maps: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
  oli: { bg: 'bg-amber-50', text: 'text-[#ff7700]', border: 'border-amber-200' },
  notifications: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  merchant: { bg: 'bg-orange-50', text: 'text-[#ff7700]', border: 'border-orange-200' },
};

export const AdminNavMenuTab: React.FC = () => {
  const { navMenuItems, updateNavMenuItemVisibility, resetNavMenuItems } = useApp();
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  const handleToggle = (id: NavMenuItemId, currentVisible: boolean) => {
    const nextState = !currentVisible;
    updateNavMenuItemVisibility(id, nextState);
    const item = navMenuItems.find((i) => i.id === id);
    showToast(
      nextState
        ? `"${item?.label || id}" ahora está visible en el menú.`
        : `"${item?.label || id}" fue ocultado del menú.`
    );
  };

  const handleEnableAll = () => {
    navMenuItems.forEach((item) => {
      if (!item.visible) {
        updateNavMenuItemVisibility(item.id, true);
      }
    });
    showToast('Todas las opciones del menú han sido habilitadas.');
  };

  const handleResetDefaults = () => {
    resetNavMenuItems();
    showToast('Menú restablecido a la configuración predeterminada.');
  };

  const visibleCount = navMenuItems.filter((i) => i.visible).length;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#0066FF] flex items-center justify-center shrink-0 shadow-2xs">
              <Menu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Control de Menú de Navegación
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-[#0066FF] border border-blue-200">
                  {visibleCount} de {navMenuItems.length} visibles
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Activa o desactiva qué secciones del menú desplegable superior estarán visibles para los vecinos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleEnableAll}
              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-[#0066FF] hover:text-[#0052cc] border border-slate-200 hover:border-blue-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Mostrar todas las opciones"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Mostrar todos</span>
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Restablecer opciones predeterminadas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed">
          <Info className="w-4 h-4 text-[#0066FF] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Sincronización instantánea:</span> Los cambios se guardan y aplican de inmediato en la barra superior. El botón de <strong>Panel Admin</strong> siempre permanecerá accesible para los administradores.
          </div>
        </div>
      </div>

      {/* Main Grid: Toggle Switches & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Toggle Options List (7 cols) */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="px-1 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Opciones de la barra superior</span>
            <span>Estado</span>
          </div>

          <div className="space-y-2">
            {navMenuItems.map((item) => {
              const Icon = MENU_ICONS[item.id] || Menu;
              const color = MENU_COLOR_CLASSES[item.id] || {
                bg: 'bg-slate-50',
                text: 'text-slate-700',
                border: 'border-slate-200',
              };

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                    item.visible
                      ? 'bg-white border-slate-200/90 shadow-2xs hover:border-blue-300'
                      : 'bg-slate-50/80 border-slate-200/60 opacity-60 hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform ${
                        item.visible ? `${color.bg} ${color.text} ${color.border}` : 'bg-slate-200 text-slate-500 border-slate-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.label}
                        </span>
                        {item.visible ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2 py-0.2 rounded-full inline-flex items-center gap-1">
                            <Eye className="w-2.5 h-2.5" />
                            Visible
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.2 rounded-full inline-flex items-center gap-1">
                            <EyeOff className="w-2.5 h-2.5" />
                            Oculto
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={item.visible}
                        onChange={() => handleToggle(item.id, item.visible)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007af7] shadow-inner"></div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Interactive Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="px-1 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Vista previa del Menú</span>
            <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#0066FF]" />
              En vivo
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200/60 border border-slate-200/80 shadow-inner flex flex-col items-center">
            {/* Mock Header Button */}
            <div className="w-full max-w-xs bg-white rounded-xl border border-blue-400 p-2 shadow-xs flex items-center justify-between text-xs font-bold text-[#0056d6] mb-2 select-none">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-[#007af7]" />
                <span>Home</span>
              </div>
              <span className="text-[10px] text-slate-400">▲</span>
            </div>

            {/* Mock Dropdown Container */}
            <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 space-y-1 select-none">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                Navegación
              </div>

              {navMenuItems.filter((i) => i.id !== 'merchant').map((item) => {
                if (!item.visible) return null;
                const Icon = MENU_ICONS[item.id] || Menu;
                const isHome = item.id === 'home';

                return (
                  <div
                    key={`preview-${item.id}`}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition ${
                      isHome ? 'bg-blue-50/80 text-[#0056d6] font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isHome ? 'bg-[#007af7] text-white' : 'bg-blue-50 text-[#007af7]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-900">{item.label}</div>
                        <div className="text-[9px] text-slate-500">{item.subtitle}</div>
                      </div>
                    </div>
                    {isHome && <Check className="w-3.5 h-3.5 text-[#007af7] shrink-0" />}
                  </div>
                );
              })}

              {visibleCount === 0 && (
                <div className="py-4 text-center text-xs text-slate-400">
                  Todas las opciones están ocultas
                </div>
              )}

              {/* Footer Section */}
              <div className="my-1 border-t border-slate-100" />

              {/* Mi Espacio if visible */}
              {navMenuItems.find((i) => i.id === 'merchant')?.visible && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-700 hover:bg-slate-50">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-orange-50 text-[#ff7700]">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-900">Mi Espacio</div>
                    <div className="text-[9px] text-slate-500">Acceso comercial</div>
                  </div>
                </div>
              )}

              {/* Panel Admin (always visible) */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-700 hover:bg-slate-50 bg-indigo-50/40">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600">
                  <UserCog className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-900">Panel Admin</div>
                  <div className="text-[9px] text-slate-500">Configuración y control</div>
                </div>
              </div>
            </div>

            <span className="text-[10px] text-slate-500 mt-2 text-center">
              Así verán tus usuarios el menú al hacer clic en la barra superior.
            </span>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-slate-800 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}
    </div>
  );
};
