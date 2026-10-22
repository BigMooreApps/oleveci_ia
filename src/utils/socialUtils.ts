import { Business, SocialLinks } from '../types';

export type SocialNetworkKey = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'website' | 'twitter';

/**
 * Generates the full valid external URL for a given social network handle or link.
 */
export function getSocialUrl(network: SocialNetworkKey, input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Handle bare domain or handle
  switch (network) {
    case 'instagram': {
      const clean = trimmed.replace(/^@+/, '');
      return `https://instagram.com/${clean}`;
    }
    case 'facebook': {
      const clean = trimmed.replace(/^@+/, '');
      return `https://facebook.com/${clean}`;
    }
    case 'tiktok': {
      const clean = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
      return `https://www.tiktok.com/${clean}`;
    }
    case 'youtube': {
      const clean = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
      return `https://www.youtube.com/${clean}`;
    }
    case 'twitter': {
      const clean = trimmed.replace(/^@+/, '');
      return `https://x.com/${clean}`;
    }
    case 'website': {
      return `https://${trimmed}`;
    }
    default:
      return `https://${trimmed}`;
  }
}

/**
 * Returns a human-friendly display handle or short label.
 */
export function getDisplaySocialHandle(network: SocialNetworkKey, input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (network === 'website') {
        return url.hostname.replace(/^www\./, '');
      }
      if (pathParts.length > 0) {
        const last = pathParts[pathParts.length - 1];
        return last.startsWith('@') ? last : `@${last}`;
      }
      return url.hostname.replace(/^www\./, '');
    }
  } catch {
    // ignore parse error and fall back
  }

  if (network === 'website') {
    return trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '');
  }

  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

export interface ResolvedSocialItem {
  key: SocialNetworkKey;
  label: string;
  handle: string;
  url: string;
  placeholder: string;
}

/**
 * Extracts and resolves the active social networks configured for a business.
 */
export function getResolvedBusinessSocials(
  business?: Partial<Business> | null
): ResolvedSocialItem[] {
  if (!business) return [];

  const rawInstagram = business.instagram || business.socialLinks?.instagram || '';
  const rawFacebook = business.facebook || business.socialLinks?.facebook || '';
  const rawTikTok = business.tiktok || business.socialLinks?.tiktok || '';
  const rawYouTube = business.youtube || business.socialLinks?.youtube || '';
  const rawWebsite = business.website || business.socialLinks?.website || '';
  const rawTwitter = business.twitter || business.socialLinks?.twitter || '';

  const list: ResolvedSocialItem[] = [];

  if (rawInstagram.trim()) {
    list.push({
      key: 'instagram',
      label: 'Instagram',
      handle: getDisplaySocialHandle('instagram', rawInstagram),
      url: getSocialUrl('instagram', rawInstagram),
      placeholder: '@tucuenta o enlace',
    });
  }

  if (rawFacebook.trim()) {
    list.push({
      key: 'facebook',
      label: 'Facebook',
      handle: getDisplaySocialHandle('facebook', rawFacebook),
      url: getSocialUrl('facebook', rawFacebook),
      placeholder: 'tupagina o enlace',
    });
  }

  if (rawTikTok.trim()) {
    list.push({
      key: 'tiktok',
      label: 'TikTok',
      handle: getDisplaySocialHandle('tiktok', rawTikTok),
      url: getSocialUrl('tiktok', rawTikTok),
      placeholder: '@tucuenta o enlace',
    });
  }

  if (rawYouTube.trim()) {
    list.push({
      key: 'youtube',
      label: 'YouTube',
      handle: getDisplaySocialHandle('youtube', rawYouTube),
      url: getSocialUrl('youtube', rawYouTube),
      placeholder: '@tucanal o enlace',
    });
  }

  if (rawWebsite.trim()) {
    list.push({
      key: 'website',
      label: 'Sitio Web',
      handle: getDisplaySocialHandle('website', rawWebsite),
      url: getSocialUrl('website', rawWebsite),
      placeholder: 'www.tunegocio.com',
    });
  }

  if (rawTwitter.trim()) {
    list.push({
      key: 'twitter',
      label: 'X (Twitter)',
      handle: getDisplaySocialHandle('twitter', rawTwitter),
      url: getSocialUrl('twitter', rawTwitter),
      placeholder: '@tucuenta',
    });
  }

  return list;
}
