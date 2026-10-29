import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminMunicipalitiesTab } from './AdminMunicipalitiesTab';
import { AdminCategoriesTab } from './AdminCategoriesTab';
import { AdminPostTypesTab } from './AdminPostTypesTab';
import { AdminPlanCategoriesTab } from './AdminPlanCategoriesTab';
import { AdminPlanRolesTab } from './AdminPlanRolesTab';
import { AdminTargetAudiencesTab } from './AdminTargetAudiencesTab';
import { AdminPriceScopesTab } from './AdminPriceScopesTab';

export type MasterTableKey =
  | 'municipalities'
  | 'categories'
  | 'post_types'
  | 'plan_types'
  | 'plan_roles'
  | 'target_audiences'
  | 'price_scopes';

interface AdminMasterTablesTabProps {
  initialSubTab?: MasterTableKey;
}

export const AdminMasterTablesTab: React.FC<AdminMasterTablesTabProps> = ({
  initialSubTab = 'municipalities',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<MasterTableKey>(initialSubTab);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const subTabs = [
    { id: 'municipalities' as MasterTableKey, label: 'Municipios' },
    { id: 'categories' as MasterTableKey, label: 'Categorías' },
    { id: 'post_types' as MasterTableKey, label: 'Tipos de Publicación' },
    { id: 'plan_types' as MasterTableKey, label: 'Tipos de Planes' },
    { id: 'plan_roles' as MasterTableKey, label: 'Momento del Plan' },
    { id: 'target_audiences' as MasterTableKey, label: 'Público Objetivo' },
    { id: 'price_scopes' as MasterTableKey, label: 'Modalidad de Precio' },
  ];

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Sub-Tabs Selector with left & right floating navigation arrows (Matching AdminDashboard) */}
      <div className="relative group">
        {/* Left Arrow Scroll Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={handleScrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-700 hover:text-[#007af7] flex items-center justify-center transition active:scale-95 cursor-pointer -ml-1 sm:-ml-2"
            title="Desplazar a la izquierda"
            aria-label="Desplazar menú a la izquierda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Right Arrow Scroll Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={handleScrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-700 hover:text-[#007af7] flex items-center justify-center transition active:scale-95 cursor-pointer -mr-1 sm:-mr-2"
            title="Desplazar a la derecha"
            aria-label="Desplazar menú a la derecha"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable Sub-Tabs List */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-x-auto no-scrollbar scroll-smooth"
        >
          {subTabs.map((tab) => {
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={(e) => {
                  setActiveSubTab(tab.id);
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 select-none ${
                  isSelected
                    ? 'bg-[#007af7] text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Master Table Content */}
      <div className="transition-all duration-150">
        {activeSubTab === 'municipalities' && <AdminMunicipalitiesTab />}
        {activeSubTab === 'categories' && <AdminCategoriesTab />}
        {activeSubTab === 'post_types' && <AdminPostTypesTab />}
        {activeSubTab === 'plan_types' && <AdminPlanCategoriesTab />}
        {activeSubTab === 'plan_roles' && <AdminPlanRolesTab />}
        {activeSubTab === 'target_audiences' && <AdminTargetAudiencesTab />}
        {activeSubTab === 'price_scopes' && <AdminPriceScopesTab />}
      </div>
    </div>
  );
};
