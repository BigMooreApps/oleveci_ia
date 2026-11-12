import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { RoleMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { OleVeciLogo } from './OleVeciLogo';
import {
  Bell,
  Store,
  UserCog,
  Compass,
  BookOpen,
  Home,
  Film,
  ChevronDown,
  Check,
  Bot,
  Route,
  Menu,
  X,
  MapPin,
  BadgePlus,
} from 'lucide-react';

interface HeaderProps {
  onOpenLocationPicker: () => void;
  onOpenNotifications: () => void;
  onCloseNotifications?: () => void;
  isNotificationModalOpen?: boolean;
  onOpenBusinessAuth?: (tab?: 'login' | 'register') => void;
  onOpenOliAssistant?: () => void;
  isRegisteringBusiness?: boolean;
  onReturnToDashboard?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenLocationPicker,
  onOpenNotifications,
  onCloseNotifications,
  isNotificationModalOpen,
  onOpenBusinessAuth,
  onOpenOliAssistant,
  isRegisteringBusiness = false,
  onReturnToDashboard,
}) => {
  const {
    currentRole,
    setCurrentRole,
    notificationPrefs,
    authenticatedBusinessId,
    isAdminAuthenticated,
    navMenuItems,
  } = useApp();

  const isNavVisible = (id: string) => {
    if (!navMenuItems || navMenuItems.length === 0) return true;
    const match = navMenuItems.find((item) => item.id === id);
    return match ? match.visible : true;
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const roleConfig = {
    home: {
      label: 'Home',
      icon: Home,
      iconColor: 'text-[#007af7]',
    },
    explorer: {
      label: 'Descubrir',
      icon: Compass,
      iconColor: 'text-[#007af7]',
    },
    plans: {
      label: 'Itinerarios',
      icon: Route,
      iconColor: 'text-[#007af7]',
    },
    directory: {
      label: 'Directorio',
      icon: BookOpen,
      iconColor: 'text-[#007af7]',
    },
    maps: {
      label: 'Vecis en Maps',
      icon: MapPin,
      iconColor: 'text-[#007af7]',
    },
    business: {
      label: authenticatedBusinessId ? 'Mi Espacio' : 'Registrarse como Veci',
      icon: Store,
      iconColor: 'text-[#ff7700]',
    },
    admin: {
      label: 'Admin',
      icon: UserCog,
      iconColor: 'text-indigo-600',
    },
    oli: {
      label: 'Asistente OLI',
      icon: Bot,
      iconColor: 'text-[#007af7]',
    },
  };

  const getFirstVisibleRole = (): RoleMode => {
    if (isNavVisible('home')) return 'home';
    if (isNavVisible('explorer')) return 'explorer';
    if (isNavVisible('plans')) return 'plans';
    if (isNavVisible('directory')) return 'directory';
    if (isNavVisible('maps')) return 'maps';
    if (isNavVisible('oli')) return 'oli';
    return 'explorer';
  };

  const handleSelectRole = (role: RoleMode) => {
    setCurrentRole(role);
    onCloseNotifications?.();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  // Detección de 3 clics rápidos en el logo para abrir login de negocio / admin
  const logoClicksRef = useRef<{ count: number; lastTime: number }>({ count: 0, lastTime: 0 });

  const handleLogoClick = () => {
    const now = Date.now();
    // Si pasaron más de 900ms desde el último clic, reiniciar el contador a 1
    if (now - logoClicksRef.current.lastTime > 900) {
      logoClicksRef.current = { count: 1, lastTime: now };
      handleSelectRole(getFirstVisibleRole());
      return;
    }

    logoClicksRef.current.count += 1;
    logoClicksRef.current.lastTime = now;

    if (logoClicksRef.current.count >= 3) {
      logoClicksRef.current = { count: 0, lastTime: 0 };
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40);
        }
      } catch {}
      // Abre pantalla de acceso para dueños de negocio o admin
      if (onOpenBusinessAuth) {
        onOpenBusinessAuth('login');
      }
      return;
    }

    handleSelectRole(getFirstVisibleRole());
  };

  const isCreatingBusinessActive = Boolean(isRegisteringBusiness);
  const isMySpaceActive = currentRole === 'business' && !isCreatingBusinessActive;

  const activeItem = isCreatingBusinessActive
    ? {
        label: 'Registrarse como Veci',
        icon: BadgePlus,
        iconColor: 'text-emerald-600',
      }
    : roleConfig[currentRole] || roleConfig.home;
  const ActiveIcon = activeItem.icon;

  return (
    <header className="sticky top-0 z-[1000] bg-white/95 backdrop-blur-md border-b border-slate-200/90 transition-shadow duration-200 shadow-2xs">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5">
        {/* Top brand row with Logo and Profile/Actions */}
        <div className="flex items-center justify-between gap-2">
          {/* Authentic OleVeci Brand Logo (always visible on top left) */}
          <div className="flex items-center shrink-0">
            <button
              onClick={handleLogoClick}
              className="flex items-center text-left focus:outline-hidden group cursor-pointer touch-manipulation"
              title="OleVeci - Ir a Home"
              aria-label="OleVeci Inicio"
            >
              <OleVeciLogo
                size="md"
                showSlogan={false}
                showCom={false}
                className="select-none transition-transform group-hover:scale-[1.02] active:scale-95"
              />
            </button>
          </div>

          {/* Right actions: Notifications, PWA Install & Role Switcher Dropdown */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* PWA Install Button */}
            <PWAInstallButton compact />

            {/* Oli Voice & AI Assistant trigger */}
            <button
              id="btn-header-oli-assistant"
              onClick={() => {
                onCloseNotifications?.();
                if (currentRole === 'oli') {
                  setCurrentRole('home');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (onOpenOliAssistant) {
                  onOpenOliAssistant();
                } else {
                  setCurrentRole('oli');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 shrink-0 group ${
                currentRole === 'oli'
                  ? 'bg-gradient-to-r from-blue-50 via-cyan-50 to-amber-50 border-2 border-[#0066FF] text-[#0056d6] shadow-xs ring-2 ring-blue-400/20'
                  : 'bg-white hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 text-[#0056d6] shadow-2xs'
              }`}
              title="Hablar con Oli - Asistente de Voz y Planes"
              aria-label="Hablar con Oli"
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0 group-hover:scale-115 transition-transform">
                <img
                  src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                  alt="Oli"
                  className="w-full h-full object-contain drop-shadow-2xs"
                />
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0066FF] ring-2 ring-white"></span>
              </span>
            </button>

            {/* Role Switcher in Dropdown Menu */}
            <div className="relative" ref={menuRef}>
              <button
                id="btn-nav-dropdown"
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className={`w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center sm:justify-start sm:gap-2 px-0 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer shadow-2xs select-none shrink-0 group ${
                  isMenuOpen
                    ? 'border-[#007af7] bg-blue-50/90 text-[#0056d6] shadow-xs ring-2 ring-blue-500/20'
                    : 'border-slate-200/90 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300'
                }`}
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
                aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
                title={isMenuOpen ? 'Cerrar menú' : 'Menú de navegación'}
              >
                {/* En móvil: Solo icono hamburguesa / cerrar (sin texto) */}
                <span className="sm:hidden flex items-center justify-center">
                  {isMenuOpen ? (
                    <X className="w-5 h-5 text-[#007af7] transition-transform duration-200 animate-in spin-in-90" />
                  ) : (
                    <Menu className="w-4.5 h-4.5 text-[#0056d6]" strokeWidth={2.4} />
                  )}
                </span>

                {/* En pantallas de escritorio / tablet: Icono del rol activo + etiqueta + chevron */}
                <ActiveIcon className={`hidden sm:inline-block w-4 h-4 shrink-0 ${activeItem.iconColor}`} />
                <span className="hidden sm:inline font-bold tracking-tight">{activeItem.label}</span>
                <ChevronDown
                  className={`hidden sm:inline w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isMenuOpen ? 'rotate-180 text-[#007af7]' : ''
                  }`}
                />
              </button>

              {/* Popover del Menú Desplegable */}
              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 sm:hidden"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div
                    id="nav-dropdown-menu"
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-60 sm:w-64 max-h-[calc(100vh-4.5rem)] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200/90 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                      Navegación
                    </div>

                    {/* Opción 1: Home */}
                    {isNavVisible('home') && (
                      <button
                        id="tab-role-home"
                        role="menuitem"
                        type="button"
                        onClick={() => handleSelectRole('home')}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                          currentRole === 'home'
                            ? 'bg-blue-50/80 text-[#0056d6] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              currentRole === 'home'
                                ? 'bg-[#007af7] text-white shadow-2xs'
                                : 'bg-blue-50 text-[#007af7] group-hover:bg-blue-100'
                            }`}
                          >
                            <Home className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900">
                              Home
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              Página principal
                            </div>
                          </div>
                        </div>
                        {currentRole === 'home' && (
                          <Check className="w-4 h-4 text-[#007af7] shrink-0 ml-2" />
                        )}
                      </button>
                    )}

                    {/* Opción 2: Descubrir */}
                    {isNavVisible('explorer') && (
                      <button
                        id="tab-role-explorer"
                        role="menuitem"
                        type="button"
                        onClick={() => handleSelectRole('explorer')}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                          currentRole === 'explorer'
                            ? 'bg-blue-50/80 text-[#0056d6] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              currentRole === 'explorer'
                                ? 'bg-[#007af7] text-white shadow-2xs'
                                : 'bg-blue-50 text-[#007af7] group-hover:bg-blue-100'
                            }`}
                          >
                            <Compass className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900">
                              Descubrir
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              Explorar publicaciones
                            </div>
                          </div>
                        </div>
                        {currentRole === 'explorer' && (
                          <Check className="w-4 h-4 text-[#007af7] shrink-0 ml-2" />
                        )}
                      </button>
                    )}

                    {/* Opción: Itinerarios Listos */}
                    {isNavVisible('plans') && (
                      <button
                        id="tab-role-plans"
                        role="menuitem"
                        type="button"
                        onClick={() => handleSelectRole('plans')}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                          currentRole === 'plans'
                            ? 'bg-blue-50/80 text-[#0056d6] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              currentRole === 'plans'
                                ? 'bg-[#007af7] text-white shadow-2xs'
                                : 'bg-blue-50 text-[#007af7] group-hover:bg-blue-100'
                            }`}
                          >
                            <Route className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900">
                              Itinerarios
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              Itinerarios armados
                            </div>
                          </div>
                        </div>
                        {currentRole === 'plans' && (
                          <Check className="w-4 h-4 text-[#007af7] shrink-0 ml-2" />
                        )}
                      </button>
                    )}

                    {/* Opción 3: Directorio */}
                    {isNavVisible('directory') && (
                      <button
                        id="tab-role-directory"
                        role="menuitem"
                        type="button"
                        onClick={() => handleSelectRole('directory')}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                          currentRole === 'directory'
                            ? 'bg-blue-50/80 text-[#0056d6] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              currentRole === 'directory'
                                ? 'bg-[#007af7] text-white shadow-2xs'
                                : 'bg-blue-50 text-[#007af7] group-hover:bg-blue-100'
                            }`}
                          >
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900">
                              Directorio
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              Comercios y servicios locales
                            </div>
                          </div>
                        </div>
                        {currentRole === 'directory' && (
                          <Check className="w-4 h-4 text-[#007af7] shrink-0 ml-2" />
                        )}
                      </button>
                    )}

                    {/* Opción: Vecis en Maps */}
                    {isNavVisible('maps') && (
                      <button
                        id="tab-role-maps"
                        role="menuitem"
                        type="button"
                        onClick={() => handleSelectRole('maps')}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                          currentRole === 'maps'
                            ? 'bg-blue-50/80 text-[#0056d6] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              currentRole === 'maps'
                                ? 'bg-[#007af7] text-white shadow-2xs'
                                : 'bg-blue-50 text-[#007af7] group-hover:bg-blue-100'
                            }`}
                          >
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900">
                              Vecis en Maps
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              Todos los negocios en el mapa
                            </div>
                          </div>
                        </div>
                        {currentRole === 'maps' && (
                          <Check className="w-4 h-4 text-[#007af7] shrink-0 ml-2" />
                        )}
                      </button>
                    )}

                    {/* Opción: Asistente OLI */}
                    {isNavVisible('oli') && (
                      <button
                        id="tab-role-oli"
                        role="menuitem"
                        type="button"
                        onClick={() => handleSelectRole('oli')}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                          currentRole === 'oli'
                            ? 'bg-blue-50/80 text-[#0056d6] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              currentRole === 'oli'
                                ? 'bg-[#007af7] text-white shadow-2xs'
                                : 'bg-blue-50 text-[#007af7] group-hover:bg-blue-100'
                            }`}
                          >
                            <Bot className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900">
                              Asistente OLI
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              Planes y recomendaciones con IA
                            </div>
                          </div>
                        </div>
                        {currentRole === 'oli' && (
                          <Check className="w-4 h-4 text-[#007af7] shrink-0 ml-2" />
                        )}
                      </button>
                    )}

                    {/* Opción: Notificaciones */}
                    {isNavVisible('notifications') && (
                      <button
                        id="tab-role-notifications"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          onOpenNotifications();
                          setIsMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group text-slate-700 hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors bg-blue-50 text-[#007af7] group-hover:bg-blue-100">
                            <Bell className="w-4 h-4" />
                            {notificationPrefs.enabled && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00d8a5] ring-2 ring-white shadow-2xs animate-pulse" />
                            )}
                          </div>
                          <div className="truncate">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>Notificaciones</span>
                              {notificationPrefs.enabled && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                                  Activas
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              Alertas y novedades
                            </div>
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Separador hacia el área de registro o gestión comercial */}
                    {(isNavVisible('merchant') || isAdminAuthenticated) && (
                      <div className="my-1 border-t border-slate-100" />
                    )}

                    {/* Sección Comercial & Administración:
                        1. Crear nuevo negocio (moderno BadgePlus)
                        2. Mi Espacio (gestión de negocio)
                        3. Panel Admin (si está autenticado como admin)
                    */}
                    {isNavVisible('merchant') && (
                      <>
                        {/* 1. CREAR NUEVO NEGOCIO */}
                        <button
                          id="tab-role-create-new-business"
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            onCloseNotifications?.();
                            if (onOpenBusinessAuth) {
                              onOpenBusinessAuth('register');
                            } else {
                              window.dispatchEvent(new CustomEvent('oleveci:open-register'));
                            }
                            setIsMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                            isCreatingBusinessActive
                              ? 'bg-emerald-50/90 text-emerald-900 font-bold'
                              : 'text-slate-700 hover:bg-emerald-50/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                isCreatingBusinessActive
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 border border-emerald-200/60 shadow-2xs'
                              }`}
                            >
                              <BadgePlus className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                Registrarse como Veci
                              </div>
                              <div className="text-[10px] text-slate-500 font-normal">
                                Crea el espacio para tu negocio
                              </div>
                            </div>
                          </div>
                          {isCreatingBusinessActive && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                          )}
                        </button>

                        {/* 2. MI ESPACIO (solo visible con sesión iniciada) */}
                        {authenticatedBusinessId && (
                          <button
                            id="tab-role-business"
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              onCloseNotifications?.();
                              if (onReturnToDashboard) {
                                onReturnToDashboard();
                              } else {
                                setCurrentRole('business');
                              }
                              setIsMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                              isMySpaceActive
                                ? 'bg-orange-50/80 text-orange-800 font-bold'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                  isMySpaceActive
                                    ? 'bg-[#ff7700] text-white shadow-2xs'
                                    : 'bg-orange-50 text-[#ff7700] group-hover:bg-orange-100'
                                }`}
                              >
                                <Store className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <div className="text-xs sm:text-sm font-semibold text-slate-900">
                                  Mi Espacio
                                </div>
                                <div className="text-[10px] text-slate-500 font-normal">
                                  Gestionar mi negocio
                                </div>
                              </div>
                            </div>
                            {isMySpaceActive && (
                              <Check className="w-4 h-4 text-[#ff7700] shrink-0 ml-2" />
                            )}
                          </button>
                        )}
                      </>
                    )}

                    {/* Opción 5: Admin (si está autenticado como admin) */}
                    {isAdminAuthenticated && (
                      <button
                        id="tab-role-admin"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          onCloseNotifications?.();
                          setCurrentRole('admin');
                          setIsMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                          currentRole === 'admin'
                            ? 'bg-indigo-50 text-indigo-900 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              currentRole === 'admin'
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'
                            }`}
                          >
                            <UserCog className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900">
                              Panel Admin
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              Configuración y control
                            </div>
                          </div>
                        </div>
                        {currentRole === 'admin' && (
                          <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
