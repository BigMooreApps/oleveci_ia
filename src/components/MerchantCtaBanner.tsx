import React from 'react';
import { Store, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface MerchantCtaBannerProps {
  className?: string;
  onOpenCreateBusiness?: () => void;
}

export const MerchantCtaBanner: React.FC<MerchantCtaBannerProps> = ({
  className = '',
  onOpenCreateBusiness,
}) => {
  const { setCurrentRole } = useApp();

  const handleAction = () => {
    if (onOpenCreateBusiness) {
      onOpenCreateBusiness();
      return;
    }

    if (typeof window !== 'undefined') {
      if ((window as any).__openCreateBusiness) {
        (window as any).__openCreateBusiness();
        return;
      }
      window.dispatchEvent(new CustomEvent('oleveci:open-register'));
    }

    setCurrentRole('business');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={`p-5 sm:p-7 rounded-3xl bg-[#031c54] text-white shadow-xl relative overflow-hidden text-center ${className}`}
    >
      {/* Subtle ambient light glows */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#007af7]/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-[#ff7700]/15 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center gap-3.5 text-center max-w-2xl mx-auto">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-orange-300 border border-orange-400/30 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs">
          <Store className="w-3.5 h-3.5 text-[#ffaa00]" />
          <span>¿QUIERES SER UN VECI?</span>
        </div>

        {/* Title and subtitle */}
        <div className="space-y-1">
          <h4 className="text-base sm:text-lg md:text-xl font-black text-white tracking-tight">
            Publica en OleVeci.com por $29.900 COP/Mes
          </h4>
          <p className="text-xs sm:text-sm text-blue-100/80 max-w-md mx-auto leading-relaxed font-medium">
            Llega a miles de vecinos de tu municipio y genera experiencias sin comisiones
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleAction}
          className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-[#ff7700] hover:bg-[#e06600] active:scale-95 text-white text-xs sm:text-sm font-black transition shadow-md shadow-[#ff7700]/30 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Publicar mi Espacio</span>
        </button>
      </div>
    </div>
  );
};
