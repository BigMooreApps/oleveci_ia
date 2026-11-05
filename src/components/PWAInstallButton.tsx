import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X } from 'lucide-react';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false, className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Suppress if already running in standalone PWA mode
  if (isInstalled) {
    return null;
  }

  const handleClick = () => {
    if (isInstallable) {
      install();
    } else {
      setShowGuide(true);
    }
  };

  const buttonClasses =
    className ||
    (compact
      ? 'relative w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-r from-[#007af7] to-[#041f5e] hover:brightness-110 text-white shadow-2xs hover:shadow-xs transition-all duration-200 active:scale-95 cursor-pointer group shrink-0'
      : 'flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#007af7] to-[#041f5e] hover:brightness-110 text-white shadow-md shadow-blue-500/20 px-3.5 py-2 text-xs sm:text-sm transition font-bold active:scale-95 cursor-pointer');

  return (
    <>
      <button
        id="btn-install-pwa"
        onClick={handleClick}
        className={buttonClasses}
        title="Descargar app en tu celular"
        aria-label="Descargar app en tu celular"
      >
        <Download className="w-4 h-4 shrink-0 text-amber-300 transition-transform duration-200 group-hover:translate-y-0.5" />
        {!compact && <span>Descargar App</span>}
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <img
                  src="/Logo_OleVeci.png?v=transparent"
                  alt="OleVeci"
                  className="h-8 w-auto object-contain bg-transparent"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Descargar OleVeci</h3>
                  <p className="text-xs text-slate-500">
                    {isIOS ? 'En tu iPhone o iPad' : 'En tu celular o computador'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm text-slate-600">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      1
                    </div>
                    <p>
                      Toca el botón <strong>Compartir</strong>{' '}
                      <Share2 className="w-4 h-4 inline text-blue-600 mx-1" /> en la barra inferior de Safari.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      2
                    </div>
                    <p>
                      Baja en las opciones y selecciona <strong>Agregar a pantalla de inicio</strong>{' '}
                      <PlusSquare className="w-4 h-4 inline text-slate-800 mx-1" />.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      3
                    </div>
                    <p>
                      Toca <strong>Agregar</strong> en la esquina superior para disfrutarla como app nativa.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      1
                    </div>
                    <p>
                      Abre el menú de opciones de tu navegador (los tres puntos <strong>⋮</strong> o la barra de dirección).
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      2
                    </div>
                    <p>
                      Selecciona <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      3
                    </div>
                    <p>
                      ¡Listo! Tendrás acceso directo con icono oficial en tu pantalla de inicio.
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full rounded-2xl bg-[#007af7] hover:bg-[#0062f5] py-2.5 text-sm font-semibold text-white transition shadow-md shadow-blue-500/20 cursor-pointer"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
