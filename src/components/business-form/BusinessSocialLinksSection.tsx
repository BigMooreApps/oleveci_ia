import React, { useState } from 'react';
import { ChevronUp, ChevronDown, AtSign, Globe } from 'lucide-react';
import {
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
  YouTubeIcon,
} from '../icons/SocialIcons';

export interface BusinessSocialLinksSectionProps {
  instagram: string;
  onChangeInstagram: (val: string) => void;
  facebook: string;
  onChangeFacebook: (val: string) => void;
  tiktok: string;
  onChangeTikTok: (val: string) => void;
  youtube: string;
  onChangeYouTube: (val: string) => void;
  website: string;
  onChangeWebsite: (val: string) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  className?: string;
  idPrefix?: string;
}

export const BusinessSocialLinksSection: React.FC<BusinessSocialLinksSectionProps> = ({
  instagram,
  onChangeInstagram,
  facebook,
  onChangeFacebook,
  tiktok,
  onChangeTikTok,
  youtube,
  onChangeYouTube,
  website,
  onChangeWebsite,
  isOpen = false,
  onToggleOpen,
  className = '',
  idPrefix = 'biz-social-links',
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isSectionOpen = onToggleOpen !== undefined ? isOpen : internalIsOpen;
  const toggleSection = onToggleOpen || (() => setInternalIsOpen((prev) => !prev));

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs transition-all ${
        isSectionOpen ? 'p-4 sm:p-5 space-y-3.5' : 'p-3.5 sm:p-4'
      } ${className}`}
    >
      {/* Clickable Header Accordion Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggleSection}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSection();
          }
        }}
        className="w-full flex items-center justify-between text-left group cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 text-xs sm:text-sm font-black text-slate-900">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#007af7] to-[#041f5e] text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0">
            <AtSign className="w-3.5 h-3.5" />
          </div>
          <span className="text-[#041f5e] font-extrabold">Redes sociales</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-transform shrink-0">
            {isSectionOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#007af7]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </div>
      </div>

      {isSectionOpen && (
        <div className="space-y-3.5 pt-1 border-t border-slate-100 animate-in fade-in duration-150">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Agrega los perfiles y enlaces oficiales de tu negocio. Los usuarios podrán visitarlos directamente al interactuar con tus publicaciones y reels.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Instagram */}
            <div>
              <label
                htmlFor={`${idPrefix}-instagram`}
                className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1.5"
              >
                <InstagramIcon className="w-3.5 h-3.5 text-rose-500" />
                <span>Instagram</span>
              </label>
              <input
                id={`${idPrefix}-instagram`}
                type="text"
                value={instagram}
                onChange={(e) => onChangeInstagram(e.target.value)}
                placeholder="@tucuenta o enlace https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 shadow-2xs transition"
              />
            </div>

            {/* Facebook */}
            <div>
              <label
                htmlFor={`${idPrefix}-facebook`}
                className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1.5"
              >
                <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
                <span>Facebook</span>
              </label>
              <input
                id={`${idPrefix}-facebook`}
                type="text"
                value={facebook}
                onChange={(e) => onChangeFacebook(e.target.value)}
                placeholder="tupagina o enlace https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-2xs transition"
              />
            </div>

            {/* TikTok */}
            <div>
              <label
                htmlFor={`${idPrefix}-tiktok`}
                className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1.5"
              >
                <TikTokIcon className="w-3.5 h-3.5 text-slate-900" />
                <span>TikTok</span>
              </label>
              <input
                id={`${idPrefix}-tiktok`}
                type="text"
                value={tiktok}
                onChange={(e) => onChangeTikTok(e.target.value)}
                placeholder="@tucuenta o enlace https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 shadow-2xs transition"
              />
            </div>

            {/* YouTube */}
            <div>
              <label
                htmlFor={`${idPrefix}-youtube`}
                className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1.5"
              >
                <YouTubeIcon className="w-3.5 h-3.5 text-[#FF0000]" />
                <span>YouTube</span>
              </label>
              <input
                id={`${idPrefix}-youtube`}
                type="text"
                value={youtube}
                onChange={(e) => onChangeYouTube(e.target.value)}
                placeholder="@tucanal o enlace https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 shadow-2xs transition"
              />
            </div>
          </div>

          {/* Sitio Web Oficial */}
          <div>
            <label
              htmlFor={`${idPrefix}-website`}
              className="block font-bold text-slate-700 text-xs mb-1 flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-[#007af7]" />
              <span>Sitio Web Oficial / Menú Digital / Tienda</span>
            </label>
            <input
              id={`${idPrefix}-website`}
              type="text"
              value={website}
              onChange={(e) => onChangeWebsite(e.target.value)}
              placeholder="https://www.tunegocio.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#007af7] shadow-2xs transition"
            />
          </div>
        </div>
      )}
    </div>
  );
};
