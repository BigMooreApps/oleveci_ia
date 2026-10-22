import sharp, { OverlayOptions } from 'sharp';
import fs from 'fs';
import path from 'path';
import { Post, Business } from '../src/types';

function escapeXml(unsafe?: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatCop(amount?: number): string {
  if (amount === undefined || amount === null) return '';
  return `$${amount.toLocaleString('es-CO')}`;
}

// In-memory cache for raw fetched images to ensure sub-100ms render speeds
const imageRawCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const RAW_CACHE_TTL = 1000 * 60 * 60; // 1 hour

// In-memory cache for rendered card image buffers
const cardCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Split text into wrapped lines preserving 100% of the words.
 * NEVER cuts off with ellipses or drops words.
 */
function splitTextIntoLines(text: string, maxCharsPerLine: number): string[] {
  const clean = text.replace(/[\r\n\t]+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Fetch raw image buffer with caching, local file support, and timeouts
 */
async function fetchRawImageBuffer(imageUrl?: string): Promise<Buffer | null> {
  if (!imageUrl) return null;

  const cached = imageRawCache.get(imageUrl);
  if (cached && Date.now() - cached.timestamp < RAW_CACHE_TTL) {
    return cached.buffer;
  }

  try {
    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches[2]) {
        const buf = Buffer.from(matches[2], 'base64');
        imageRawCache.set(imageUrl, { buffer: buf, timestamp: Date.now() });
        return buf;
      }
    } else if (imageUrl.startsWith('/')) {
      const localPath = path.join(process.cwd(), 'public', imageUrl.replace(/^\//, ''));
      if (fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath);
        imageRawCache.set(imageUrl, { buffer: buf, timestamp: Date.now() });
        return buf;
      }
    } else {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const buf = Buffer.from(await response.arrayBuffer());
        imageRawCache.set(imageUrl, { buffer: buf, timestamp: Date.now() });
        return buf;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Render Publication Card exactly matching the in-app announcement design,
 * adapted purely in size/dimensions without altering design, and NEVER truncating description or title.
 * - 9:16 vertical (1080 x 1920) for WhatsApp Status, Stories, TikTok
 * - 4:5 vertical (1080 x 1350) for Facebook Wall, Instagram Feed
 * - 1.91:1 landscape (1200 x 630) for WhatsApp & Facebook OpenGraph link previews
 */
async function renderPublicationCard(
  post: Post,
  business?: Business | null,
  targetWidth: number = 1080,
  targetHeight: number = 1920
): Promise<Buffer> {
  const WIDTH = targetWidth;
  const HEIGHT = targetHeight;
  const isLandscape = WIDTH > HEIGHT;
  const isStory = HEIGHT >= 1800;

  // 1. Base Image - Full bleed cover matching the in-app announcement
  const imageUrl = post.imageUrl || post.videoUrl || business?.coverImage;
  const rawBuffer = await fetchRawImageBuffer(imageUrl);

  let bgBuffer: Buffer;
  if (rawBuffer) {
    try {
      bgBuffer = await sharp(rawBuffer)
        .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'center' })
        .toBuffer();
    } catch {
      bgBuffer = await sharp({
        create: {
          width: WIDTH,
          height: HEIGHT,
          channels: 4,
          background: { r: 4, g: 14, b: 40, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
    }
  } else {
    bgBuffer = await sharp({
      create: {
        width: WIDTH,
        height: HEIGHT,
        channels: 4,
        background: { r: 4, g: 14, b: 40, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  }

  // 2. Padding and scale calculations
  const padX = isLandscape ? 48 : isStory ? 52 : 44;
  const bottomPadding = isLandscape ? 32 : isStory ? 76 : 56;
  const availableContentWidth = WIDTH - padX * 2;

  // Top discount badge configuration
  const hasDiscount = Boolean(
    post.originalPrice &&
    post.promotionalPrice &&
    post.originalPrice > post.promotionalPrice
  );
  const discountPercent = hasDiscount
    ? Math.round(((post.originalPrice! - post.promotionalPrice!) / post.originalPrice!) * 100)
    : 0;

  const badgeHeight = isLandscape ? 42 : isStory ? 56 : 48;
  const badgeWidth = isLandscape ? 176 : isStory ? 218 : 196;
  const badgeFontSize = isLandscape ? 20 : isStory ? 25 : 22;
  const topBadgeY = isLandscape ? 26 : isStory ? 50 : 38;

  // Business identity row
  const avatarSize = isLandscape ? 50 : isStory ? 76 : 64;
  const businessFontSize = isLandscape ? 21 : isStory ? 29 : 25;
  const checkRadius = isLandscape ? 8.5 : isStory ? 10.5 : 9.5;

  // Pre-render business logo circle
  let logoBuffer: Buffer | null = null;
  const logoUrl = business?.logo || post.businessLogo;
  const rawLogo = await fetchRawImageBuffer(logoUrl);
  if (rawLogo) {
    try {
      const circleMask = Buffer.from(
        `<svg width="${avatarSize}" height="${avatarSize}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="#ffffff"/>
        </svg>`
      );
      logoBuffer = await sharp(rawLogo)
        .resize(avatarSize, avatarSize, { fit: 'cover' })
        .composite([{ input: circleMask, blend: 'dest-in' }])
        .png()
        .toBuffer();
    } catch {
      logoBuffer = null;
    }
  }

  // 3. TITLE - Dynamically adapted so ALL words fit without truncation
  let titleFontSize: number;
  let titleLineHeight: number;
  let titleMaxChars: number;

  const titleLen = post.title.length;
  if (isLandscape) {
    if (titleLen <= 50) {
      titleFontSize = 26;
      titleLineHeight = 34;
      titleMaxChars = 58;
    } else {
      titleFontSize = 21;
      titleLineHeight = 28;
      titleMaxChars = 72;
    }
  } else if (isStory) {
    if (titleLen <= 42) {
      titleFontSize = 38;
      titleLineHeight = 48;
      titleMaxChars = 34;
    } else if (titleLen <= 70) {
      titleFontSize = 32;
      titleLineHeight = 42;
      titleMaxChars = 40;
    } else {
      titleFontSize = 27;
      titleLineHeight = 36;
      titleMaxChars = 48;
    }
  } else {
    // Feed 4:5
    if (titleLen <= 45) {
      titleFontSize = 32;
      titleLineHeight = 42;
      titleMaxChars = 36;
    } else {
      titleFontSize = 27;
      titleLineHeight = 36;
      titleMaxChars = 44;
    }
  }

  const titleLines = splitTextIntoLines(post.title, titleMaxChars);
  const titleHeight = titleLines.length * titleLineHeight;

  // 4. PRICING ROW PILL
  const priceDisplay = post.promotionalPrice
    ? formatCop(post.promotionalPrice)
    : post.originalPrice
    ? formatCop(post.originalPrice)
    : 'Consultar precio';
  const originalPriceDisplay = hasDiscount && post.originalPrice ? formatCop(post.originalPrice) : '';

  const pricePillHeight = isLandscape ? 40 : isStory ? 54 : 48;
  const promoFontSize = isLandscape ? 19 : isStory ? 24 : 22;
  const origFontSize = isLandscape ? 15 : isStory ? 20 : 18;

  const promoBadgeWidth = Math.round(priceDisplay.length * (isLandscape ? 11.2 : isStory ? 14.2 : 13.0) + 26);
  const origTextWidth = originalPriceDisplay
    ? Math.round(originalPriceDisplay.length * (isLandscape ? 9.0 : isStory ? 11.8 : 10.8) + 18)
    : 0;
  const pricePillWidth = promoBadgeWidth + origTextWidth + 12;

  // 5. VALIDITY / EXPIRY TAG
  const hasExpiry = Boolean(post.expiryLabel && post.expiryLabel.trim());
  const expiryPillHeight = isLandscape ? 34 : isStory ? 44 : 38;
  const expiryFontSize = isLandscape ? 14 : isStory ? 18 : 16;
  const expiryText = post.expiryLabel ? post.expiryLabel.trim() : '';
  const expiryPillWidth = Math.min(
    Math.round(expiryText.length * (isLandscape ? 8.8 : isStory ? 11.2 : 10.0) + expiryPillHeight + 24),
    availableContentWidth
  );

  // 6. DESCRIPTION - Proporcionalmente idéntica al diseño del anuncio en la app
  let descFontSize: number;
  let descLineHeight: number;
  let descMaxChars: number;

  const descLen = (post.description || '').trim().length;
  if (isLandscape) {
    if (descLen <= 180) {
      descFontSize = 18;
      descLineHeight = 26;
      descMaxChars = 88;
    } else if (descLen <= 300) {
      descFontSize = 16;
      descLineHeight = 23;
      descMaxChars = 96;
    } else {
      descFontSize = 14;
      descLineHeight = 20;
      descMaxChars = 106;
    }
  } else if (isStory) {
    if (descLen <= 220) {
      descFontSize = 26;
      descLineHeight = 38;
      descMaxChars = 68;
    } else if (descLen <= 350) {
      descFontSize = 24;
      descLineHeight = 35;
      descMaxChars = 72;
    } else {
      descFontSize = 22;
      descLineHeight = 32;
      descMaxChars = 76;
    }
  } else {
    // Feed 4:5
    if (descLen <= 200) {
      descFontSize = 23;
      descLineHeight = 34;
      descMaxChars = 68;
    } else if (descLen <= 320) {
      descFontSize = 21;
      descLineHeight = 31;
      descMaxChars = 72;
    } else {
      descFontSize = 19;
      descLineHeight = 28;
      descMaxChars = 78;
    }
  }

  const descLines = post.description ? splitTextIntoLines(post.description, descMaxChars) : [];
  const descHeight = descLines.length * descLineHeight;

  // 7. Dynamic vertical spacing
  const gapBizToTitle = isLandscape ? 8 : isStory ? 14 : 12;
  const gapTitleToPrice = isLandscape ? 8 : isStory ? 14 : 12;
  const gapPriceToExpiry = isLandscape ? 6 : isStory ? 10 : 8;
  const gapToDesc = isLandscape ? 8 : isStory ? 14 : 10;

  let totalContentHeight = avatarSize + gapBizToTitle + titleHeight + gapTitleToPrice + pricePillHeight;
  if (hasExpiry) {
    totalContentHeight += gapPriceToExpiry + expiryPillHeight;
  }
  if (descLines.length > 0) {
    totalContentHeight += gapToDesc + descHeight;
  }

  // Anchor bottom content cleanly
  let bottomStartY = HEIGHT - bottomPadding - totalContentHeight;
  const minTopLimit = topBadgeY + badgeHeight + 24;
  if (bottomStartY < minTopLimit) {
    bottomStartY = minTopLimit;
  }

  // Deep cinematic vignette to ensure 100% readability of all text
  const topVignetteHeight = Math.round(HEIGHT * 0.22);
  const bottomVignetteHeight = Math.min(
    HEIGHT,
    Math.round(totalContentHeight + bottomPadding + (HEIGHT * 0.16))
  );

  // Layout positions relative to bottomStartY
  let currentY = 0;
  const bizRowY = currentY;

  currentY += avatarSize + gapBizToTitle;
  const titleY = currentY;

  currentY += titleHeight + gapTitleToPrice;
  const priceY = currentY;

  let expiryY = 0;
  if (hasExpiry) {
    currentY += pricePillHeight + gapPriceToExpiry;
    expiryY = currentY;
  }

  let descY = 0;
  if (descLines.length > 0) {
    currentY += (hasExpiry ? expiryPillHeight : pricePillHeight) + gapToDesc;
    descY = currentY;
  }

  const isVideo = Boolean(post.videoUrl);
  const verifiedCheckX = Math.min(
    post.businessName.length * (businessFontSize * 0.58) + avatarSize + 18,
    WIDTH - padX - 60
  );

  const overlaySvg = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Top cinematic vignette -->
        <linearGradient id="topVignette" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.88"/>
          <stop offset="55%" stop-color="#000000" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>

        <!-- Bottom cinematic vignette -->
        <linearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="25%" stop-color="#000000" stop-opacity="0.75"/>
          <stop offset="60%" stop-color="#000000" stop-opacity="0.94"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.99"/>
        </linearGradient>

        <!-- Discount badge gradient (exact match: #ff3366 to #ff5e36) -->
        <linearGradient id="discountPillGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff3366"/>
          <stop offset="100%" stop-color="#ff5e36"/>
        </linearGradient>

        <!-- Avatar ring gradient (exact match: #06b6d4 to #2563eb) -->
        <linearGradient id="avatarRingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#06b6d4"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>

        <!-- Rich text drop shadow -->
        <filter id="textDropShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.95"/>
        </filter>
      </defs>

      <!-- 1. Top Cinematic Vignette -->
      <rect x="0" y="0" width="${WIDTH}" height="${topVignetteHeight}" fill="url(#topVignette)"/>

      <!-- 2. Bottom Cinematic Vignette -->
      <rect x="0" y="${HEIGHT - bottomVignetteHeight}" width="${WIDTH}" height="${bottomVignetteHeight}" fill="url(#bottomVignette)"/>

      <!-- 3. TOP BAR: Discount Badge on Left -->
      ${
        hasDiscount
          ? `
          <g transform="translate(${padX}, ${topBadgeY})">
            <rect width="${badgeWidth}" height="${badgeHeight}" rx="${badgeHeight / 2}" fill="url(#discountPillGrad)" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.45"/>
            <!-- Sparkles Icon -->
            <path d="M${badgeHeight * 0.45} ${badgeHeight * 0.28} L${badgeHeight * 0.52} ${badgeHeight * 0.45} L${badgeHeight * 0.70} ${badgeHeight * 0.50} L${badgeHeight * 0.52} ${badgeHeight * 0.55} L${badgeHeight * 0.45} ${badgeHeight * 0.72} L${badgeHeight * 0.38} ${badgeHeight * 0.55} L${badgeHeight * 0.20} ${badgeHeight * 0.50} L${badgeHeight * 0.38} ${badgeHeight * 0.45} Z" fill="#ffffff"/>
            <text x="${badgeWidth * 0.60}" y="${badgeHeight * 0.68}" font-family="Liberation Sans, DejaVu Sans, Arial, -apple-system, sans-serif" font-size="${badgeFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle">
              -${discountPercent}% OFF
            </text>
          </g>
          `
          : ''
      }

      <!-- 4. CENTER PLAY BUTTON (if video post) -->
      ${
        isVideo
          ? `
          <g transform="translate(${WIDTH / 2}, ${HEIGHT / 2 - (isLandscape ? 10 : 35)})">
            <circle cx="0" cy="0" r="${isLandscape ? 40 : 54}" fill="#000000" fill-opacity="0.65" stroke="#ffffff" stroke-width="3"/>
            <polygon points="-8,-16 -8,16 16,0" fill="#ffffff"/>
          </g>
          `
          : ''
      }

      <!-- 5. BOTTOM CONTENT STACK (100% IDENTICAL TO IN-APP ANNOUNCEMENT) -->
      <g transform="translate(${padX}, ${bottomStartY})" filter="url(#textDropShadow)">
        
        <!-- A. Business Identity Row (Avatar + Name + Cyan Checkmark) -->
        <g transform="translate(0, ${bizRowY})">
          ${
            !logoBuffer
              ? `
              <circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="#007af7"/>
              <text x="${avatarSize / 2}" y="${avatarSize / 2 + businessFontSize * 0.35}" font-family="Liberation Sans, DejaVu Sans, Arial, -apple-system, sans-serif" font-size="${Math.round(avatarSize * 0.38)}" font-weight="900" fill="#ffffff" text-anchor="middle">
                ${escapeXml(post.businessName.slice(0, 2).toUpperCase())}
              </text>
              `
              : ''
          }
          <!-- Cyan-to-blue gradient ring around avatar -->
          <circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="none" stroke="url(#avatarRingGrad)" stroke-width="2.5"/>

          <!-- Business Name -->
          <text x="${avatarSize + 14}" y="${avatarSize / 2 + businessFontSize * 0.34}" font-family="Liberation Sans, DejaVu Sans, Arial, -apple-system, sans-serif" font-size="${businessFontSize}" font-weight="900" fill="#ffffff">
            ${escapeXml(post.businessName.length > 34 ? post.businessName.slice(0, 32) + '...' : post.businessName)}
          </text>

          <!-- Cyan Verified Checkmark -->
          <g transform="translate(${verifiedCheckX}, ${avatarSize / 2})">
            <circle cx="0" cy="0" r="${checkRadius}" fill="#06b6d4"/>
            <path d="M-${checkRadius * 0.45} 0l${checkRadius * 0.35} ${checkRadius * 0.35} ${checkRadius * 0.65}-${checkRadius * 0.65}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </g>

        <!-- B. Post Title (ALL words preserved, no truncation) -->
        <g transform="translate(0, ${titleY})">
          ${titleLines
            .map(
              (line, idx) => `
            <text x="0" y="${idx * titleLineHeight + titleFontSize * 0.9}" font-family="Liberation Sans, DejaVu Sans, Arial, -apple-system, sans-serif" font-size="${titleFontSize}" font-weight="900" fill="#ffffff">
              ${escapeXml(line)}
            </text>
          `
            )
            .join('')}
        </g>

        <!-- C. Pricing Row Pill (Exact match to in-app announcement) -->
        <g transform="translate(0, ${priceY})">
          <!-- Background container pill -->
          <rect width="${pricePillWidth}" height="${pricePillHeight}" rx="${pricePillHeight / 2}" fill="#000000" fill-opacity="0.68" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.25"/>
          
          ${
            hasDiscount
              ? `
              <!-- Promotional Price Green Badge -->
              <rect x="4" y="3" width="${promoBadgeWidth}" height="${pricePillHeight - 6}" rx="${(pricePillHeight - 6) / 2}" fill="#10b981"/>
              <text x="${promoBadgeWidth / 2 + 4}" y="${pricePillHeight * 0.64}" font-family="Liberation Sans, DejaVu Sans, Arial, -apple-system, sans-serif" font-size="${promoFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle">
                ${escapeXml(priceDisplay)}
              </text>
              <!-- Strikethrough Original Price -->
              <text x="${promoBadgeWidth + 14}" y="${pricePillHeight * 0.64}" font-family="Liberation Sans, DejaVu Sans, Arial, -apple-system, sans-serif" font-size="${origFontSize}" font-weight="bold" fill="#ffffff" fill-opacity="0.6" text-decoration="line-through">
                ${escapeXml(originalPriceDisplay)}
              </text>
              `
              : `
              <!-- Single Price Display -->
              <text x="${pricePillWidth / 2}" y="${pricePillHeight * 0.64}" font-family="Liberation Sans, DejaVu Sans, Arial, -apple-system, sans-serif" font-size="${promoFontSize}" font-weight="900" fill="${post.originalPrice ? '#ffffff' : '#6ee7b7'}" text-anchor="middle">
                ${escapeXml(priceDisplay)}
              </text>
              `
          }
        </g>

        <!-- D. Validity / Expiry Tag -->
        ${
          hasExpiry
            ? `
            <g transform="translate(0, ${expiryY})">
              <rect width="${expiryPillWidth}" height="${expiryPillHeight}" rx="${expiryPillHeight / 2}" fill="#1e293b" fill-opacity="0.85" stroke="#ffffff" stroke-width="1" stroke-opacity="0.25"/>
              <circle cx="${expiryPillHeight / 2 + 2}" cy="${expiryPillHeight / 2}" r="${expiryPillHeight * 0.28}" fill="none" stroke="#38bdf8" stroke-width="1.8"/>
              <path d="M${expiryPillHeight / 2 + 2} ${expiryPillHeight * 0.26}v${expiryPillHeight * 0.24}h${expiryPillHeight * 0.18}" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
              <text x="${expiryPillHeight * 0.95}" y="${expiryPillHeight * 0.65}" font-family="Liberation Sans, DejaVu Sans, Arial, -apple-system, sans-serif" font-size="${expiryFontSize}" font-weight="bold" fill="#bae6fd">
                ${escapeXml(expiryText)}
              </text>
            </g>
            `
            : ''
        }

        <!-- E. Description Paragraph - 100% COMPLETE AND FULLY VISIBLE -->
        ${
          descLines.length > 0
            ? `
            <g transform="translate(0, ${descY})">
              ${descLines
                .map(
                  (line, idx) => `
                <text x="0" y="${idx * descLineHeight + descFontSize * 0.9}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="${descFontSize}" font-weight="400" fill="#ffffff" fill-opacity="0.95">
                  ${escapeXml(line)}
                </text>
              `
                )
                .join('')}
            </g>
            `
            : ''
        }

      </g>
    </svg>
  `;

  const composites: OverlayOptions[] = [];
  if (logoBuffer) {
    composites.push({
      input: logoBuffer,
      top: Math.round(bottomStartY),
      left: padX,
    });
  }
  composites.push({
    input: Buffer.from(overlaySvg),
    top: 0,
    left: 0,
  });

  // WhatsApp & OpenGraph strictly require images < 300 KB.
  // Progressive JPEG at 80% quality renders in <50ms and produces ~120-180 KB files.
  if (isLandscape) {
    return sharp(bgBuffer)
      .composite(composites)
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();
  }

  return sharp(bgBuffer)
    .composite(composites)
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
}

/**
 * Main export: renders the exact in-app publication layout across all formats.
 * - 'story': 1080 x 1920 (9:16) for WhatsApp Status, Instagram Stories, TikTok
 * - 'feed': 1080 x 1350 (4:5) for Facebook Wall, Instagram Feed
 * - 'card': 1200 x 630 (1.91:1) for WhatsApp & Facebook OpenGraph link previews
 */
export async function renderPostCardImage(
  post: Post,
  business?: Business | null,
  format: 'card' | 'story' | 'feed' = 'card'
): Promise<Buffer> {
  const cacheKey = `${post.id}_${post.promotionalPrice || ''}_${post.title}_${format}_pub_v18_jpeg`;
  const cached = cardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.buffer;
  }

  let finalBuffer: Buffer;

  if (format === 'story') {
    // 9:16 vertical (WhatsApp Status, Instagram Stories, TikTok)
    finalBuffer = await renderPublicationCard(post, business, 1080, 1920);
  } else if (format === 'feed') {
    // 4:5 vertical (Facebook Wall, Instagram Feed)
    finalBuffer = await renderPublicationCard(post, business, 1080, 1350);
  } else {
    // 1200x630 (WhatsApp & Facebook link card preview)
    finalBuffer = await renderPublicationCard(post, business, 1200, 630);
  }

  cardCache.set(cacheKey, { buffer: finalBuffer, timestamp: Date.now() });
  return finalBuffer;
}
