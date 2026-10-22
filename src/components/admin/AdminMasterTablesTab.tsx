import React, { useState, useRef } from 'react';
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

  const subTabs = [
    { id: 'municipalities' as MasterTableKey, label: 'Municipios' },
    { id: 'categories' as MasterTableKey, label: 'Categorías' },
    { id: 'post_types' as MasterTableKey, label: 'Tipos de Publicación' },
    { id: 'plan_types' as MasterTableKey, label: 'Tipos de Planes' },
    { id: 'plan_roles' as MasterTableKey, label: 'Momento del Plan' },
    { id: 'target_audiences' as MasterTableKey, label: 'Público Objetivo' },
    { id: 'price_scopes' as MasterTableKey, label: 'Modalidad de Precio' },
  ];

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -240, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 240, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Sub-Tabs Selector with left & right navigation arrows */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={handleScrollLeft}
          aria-label="Desplazar opciones a la izquierda"
          title="Ver opciones anteriores"
          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-[#007af7] border border-slate-200 hover:border-blue-200 flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Scrollable Sub-Tabs List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
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
                className={`py-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 select-none ${
                  isSelected
                    ? 'bg-[#007af7] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={handleScrollRight}
          aria-label="Desplazar opciones a la derecha"
          title="Ver más opciones"
          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-[#007af7] border border-slate-200 hover:border-blue-200 flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer shadow-2xs"
        >
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        </button>
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
