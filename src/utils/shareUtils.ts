import { Post } from '../types';

export interface FormattedShareData {
  title: string;
  shareLead: string;
  shareMessage: string;
  cleanVideoMessage: string;
  url: string;
  isVideo: boolean;
  priceFormatted: string;
  discountBadge: string;
  locationFormatted: string;
}

/**
 * Builds attractive share messages for WhatsApp, Social Sharing, and Copy actions.
 */
export function formatPostShareText(post: Post, origin?: string): FormattedShareData {
  const baseOrigin = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://oleveci.com');
  const isVideo = Boolean(post.videoUrl);

  // Direct canonical deep-link
  const url = isVideo ? `${baseOrigin}/reel/${post.id}` : `${baseOrigin}/anuncio/${post.id}`;

  const hasDiscount = Boolean(
    post.originalPrice &&
    post.promotionalPrice &&
    post.originalPrice > post.promotionalPrice
  );

  const discountPercent = hasDiscount
    ? Math.round(((post.originalPrice! - post.promotionalPrice!) / post.originalPrice!) * 100)
    : 0;

  const discountBadge = hasDiscount ? `🔥 ${discountPercent}% OFF` : '';

  // Formatted price string
  let priceFormatted = '';
  let priceLine = '';
  if (post.promotionalPrice) {
    const promoStr = `$${post.promotionalPrice.toLocaleString('es-CO')} COP`;
    priceFormatted = promoStr;
    if (hasDiscount && post.originalPrice) {
      const origStr = `$${post.originalPrice.toLocaleString('es-CO')} COP`;
      priceLine = `💰 *Precio:* ${promoStr} ~(${origStr})~ ${discountBadge}`;
    } else {
      priceLine = `💰 *Precio:* ${promoStr}`;
    }
  } else if (post.originalPrice) {
    const origStr = `$${post.originalPrice.toLocaleString('es-CO')} COP`;
    priceFormatted = origStr;
    priceLine = `💰 *Precio:* ${origStr}`;
  }

  // Location string
  const locationParts = [post.businessSector, post.businessCity].filter(Boolean);
  const locationFormatted = locationParts.length > 0 ? locationParts.join(' · ') : post.businessCity || 'Sabana Centro';

  // Validity
  const validityLine = post.expiryLabel ? `⏱️ *Vigencia:* ${post.expiryLabel}` : '';

  // Full description - exact match to announcement
  let descSnippet = '';
  if (post.description) {
    descSnippet = post.description.trim();
  }

  // 1. High-impact engaging WhatsApp message
  const messageSections: string[] = [
    `✨ *${post.title}*`,
    `🏪 *${post.businessName}* (📍 ${locationFormatted})`,
  ];

  if (priceLine) {
    messageSections.push(priceLine);
  }

  if (validityLine) {
    messageSections.push(validityLine);
  }

  if (descSnippet) {
    messageSections.push(`📝 _${descSnippet}_`);
  }

  messageSections.push(`\n👉 *Ver en OleVeci:*`);
  messageSections.push(url);

  const shareMessage = messageSections.join('\n');
  const shareLead = messageSections.slice(0, -2).join('\n');
  const cleanVideoMessage = url;

  return {
    title: `${post.title} · ${post.businessName}`,
    shareLead,
    shareMessage,
    cleanVideoMessage,
    url,
    isVideo,
    priceFormatted,
    discountBadge,
    locationFormatted,
  };
}

export function getWhatsAppWebUrl(text: string): string {
  return `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function getWhatsAppAppUrl(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function openWhatsAppDirect(url: string) {
  const isMobile =
    typeof window !== 'undefined' &&
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768);
  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function getFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function getTelegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function getTwitterShareUrl(url: string, text: string): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/**
 * Downloads the promotional card image (PNG) directly to the device.
 */
export async function downloadPostCardImage(
  postId: string,
  title: string,
  format: 'card' | 'story' | 'feed' = 'story'
): Promise<boolean> {
  try {
    const cacheBuster = `v=${Date.now()}`;
    const endpoint = format === 'feed'
      ? `/api/og/feed/${postId}.png?${cacheBuster}`
      : format === 'story'
      ? `/api/og/story/${postId}.png?${cacheBuster}`
      : `/api/og/card/${postId}.png?${cacheBuster}`;

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Failed to fetch card image');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `OleVeci_${safeTitle}_${format}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch (err) {
    console.error('Error downloading card image:', err);
    return false;
  }
}

/**
 * Native share with attached image file on supporting mobile browsers (Android / iOS).
 * When WhatsApp receives a file, it opens with the image attached and the caption text!
 */
export async function shareNativeWithImage(
  post: Post,
  options?: {
    format?: 'card' | 'story' | 'feed';
    origin?: string;
  }
): Promise<boolean> {
  const origin = options?.origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const { title, shareMessage, url } = formatPostShareText(post, origin);
  const format = options?.format || 'story';

  if (typeof navigator !== 'undefined' && 'canShare' in navigator && navigator.share) {
    try {
      const cacheBuster = `v=${Date.now()}`;
      const endpoint = format === 'feed'
        ? `/api/og/feed/${post.id}.png?${cacheBuster}`
        : format === 'story'
        ? `/api/og/story/${post.id}.png?${cacheBuster}`
        : `/api/og/card/${post.id}.png?${cacheBuster}`;

      const res = await fetch(endpoint);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], `oleveci-${post.id}.png`, { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            text: `${title}\n\n👉 ${url}`,
            url,
            files: [file],
          });
          return true;
        }
      }
    } catch {
      // User cancelled or unsupported file sharing, fall through
    }
  }

  // Fallback to basic text navigator.share
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text: shareMessage,
        url,
      });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Triggers native share sheet or falls back to copying link & opening WhatsApp.
 */
export async function sharePostNative(
  post: Post,
  options?: {
    onCopied?: () => void;
    origin?: string;
    preferWeb?: boolean;
    useCleanLink?: boolean;
  }
): Promise<{ method: 'native' | 'whatsapp' | 'copied'; success: boolean }> {
  const origin = options?.origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const shareData = formatPostShareText(post, origin);
  const textToSend = options?.useCleanLink || shareData.isVideo
    ? shareData.cleanVideoMessage
    : shareData.shareMessage;

  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(shareData.url);
      if (options?.onCopied) options.onCopied();
    } catch {
      // Ignored
    }
  }

  const isMobile =
    typeof window !== 'undefined' &&
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768);

  const waUrl = isMobile || !options?.preferWeb
    ? getWhatsAppAppUrl(textToSend)
    : getWhatsAppWebUrl(textToSend);

  openWhatsAppDirect(waUrl);
  return { method: 'whatsapp', success: true };
}

/**
 * Builds attractive share messages for a Business profile.
 */
export function formatBusinessShareText(business: any, origin?: string): FormattedShareData {
  const baseOrigin = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://oleveci.com');
  const url = `${baseOrigin}/comercio/${business.id}`;
  const locationParts = [business.sector, business.city].filter(Boolean);
  const locationFormatted = locationParts.length > 0 ? locationParts.join(' · ') : business.city || 'Sabana Centro';

  const messageSections: string[] = [
    `🏪 *${business.name}*`,
    `📍 ${locationFormatted}`,
  ];

  if (business.subCategory) {
    messageSections.push(`🏷️ *Categoría:* ${business.subCategory}`);
  }
  if (business.hours) {
    messageSections.push(`🕒 *Horario:* ${business.hours}`);
  }
  if (business.description) {
    messageSections.push(`📝 _${business.description.trim()}_`);
  }

  messageSections.push(`\n👉 *Ver perfil en OleVeci:*`);
  messageSections.push(url);

  const shareMessage = messageSections.join('\n');
  const shareLead = messageSections.slice(0, -2).join('\n');

  return {
    title: `${business.name} · Comercio en OleVeci`,
    shareLead,
    shareMessage,
    cleanVideoMessage: url,
    url,
    isVideo: false,
    priceFormatted: '',
    discountBadge: business.verified ? '✓ Verificado' : '',
    locationFormatted,
  };
}

/**
 * Builds attractive share messages for a Ready Plan / Itinerary.
 */
export function formatPlanShareText(
  plan: any,
  stops: any[] = [],
  origin?: string
): FormattedShareData {
  const baseOrigin = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://oleveci.com');
  const url = `${baseOrigin}/plan/${plan.id}`;
  const locationFormatted = plan.municipality || 'Sabana Centro';
  const priceFormatted =
    plan.estimatedBudget > 0 ? `$${plan.estimatedBudget.toLocaleString('es-CO')} COP` : 'Presupuesto libre';

  const stopsNames = (stops || []).map((s: any) => s.businessName).filter(Boolean);

  const messageSections: string[] = [
    `🎒 *${plan.planTitle}*`,
    `📍 *Municipio:* ${locationFormatted}`,
  ];

  if (plan.estimatedBudget > 0) {
    messageSections.push(`💰 *Presupuesto estimado:* ${priceFormatted}`);
  }
  if (plan.estimatedDuration || plan.scheduledTime) {
    messageSections.push(`⏱️ *Horario:* ${plan.estimatedDuration || plan.scheduledTime}`);
  }
  if (stopsNames.length > 0) {
    messageSections.push(`🗺️ *${stopsNames.length} Paradas:* ${stopsNames.join(' ➔ ')}`);
  }
  if (plan.personalNote) {
    messageSections.push(`💬 _${plan.personalNote.trim()}_`);
  }

  messageSections.push(`\n👉 *Mira la ruta y el itinerario en OleVeci:*`);
  messageSections.push(url);

  const shareMessage = messageSections.join('\n');
  const shareLead = messageSections.slice(0, -2).join('\n');

  return {
    title: `${plan.planTitle} · Itinerario en OleVeci`,
    url,
    shareLead,
    shareMessage,
    cleanVideoMessage: url,
    isVideo: false,
    priceFormatted,
    discountBadge: plan.badgeText || 'Ruta Destacada',
    locationFormatted,
  };
}

/**
 * Direct file download from URL blob with safe filename.
 */
export async function downloadDirectImage(imageUrl: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename.endsWith('.png') || filename.endsWith('.jpg') ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch (err) {
    console.warn('Fallback opening image in new tab:', err);
    window.open(imageUrl, '_blank');
    return true;
  }
}

