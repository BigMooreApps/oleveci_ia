import React, { useState, useMemo } from 'react';
import { Post, Business } from '../types';
import { SimulatedReadyPlan, resolvePlanPosts } from '../data/readyPlansData';
import { INITIAL_POSTS } from '../data/seedData';
import { PlanBackgroundImages, THEMES } from './InvitationCardPreview';
import { ItineraryPlanCard } from './ItineraryPlanCard';
import { WhatsAppIcon } from './WhatsAppIcon';
import {
  formatPostShareText,
  formatBusinessShareText,
  formatPlanShareText,
  getWhatsAppWebUrl,
  downloadPostCardImage,
  downloadDirectImage,
} from '../utils/shareUtils';
import {
  X,
  Link2,
  Check,
  Share2,
  Download,
  Play,
  Film,
  CheckCircle2,
  Sparkles,
  Clock,
  MapPin,
  Route,
  Store,
} from 'lucide-react';

export interface SharePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post?: Post | null;
  business?: Business | null;
  plan?: SimulatedReadyPlan | null;
  planStops?: Post[];
}

const formatCOP = (val?: number) => {
  if (val === undefined || val === null) return '';
  return `$${val.toLocaleString('es-CO')}`;
};

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 3
): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) {
          lines[lines.length - 1] += '...';
          return lines;
        }
      }
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines;
}

const loadCanvasImage = (url: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

async function generatePlanImageBlob(
  title: string,
  stops: Post[],
  personalNote?: string,
  currentCity: string = 'Cajicá',
  estimatedBudget?: number
): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Load all stop images and official OleVeci logo in parallel (with CORS safety)
    const [loadedImgs, logoImg] = await Promise.all([
      Promise.all(
        stops.map(async (s) => {
          if (!s.imageUrl) return null;
          try {
            return await loadCanvasImage(s.imageUrl);
          } catch {
            return null;
          }
        })
      ),
      loadCanvasImage('/Icono_Oleveci_sin_fondo.png?v=clean'),
    ]);

    const canvasW = 840;
    const cardMargin = 20;
    const cardW = canvasW - cardMargin * 2; // 800
    const logoBoxSize = 64;

    // Measure Header with logo space on the right
    ctx.font = '900 34px system-ui, -apple-system, sans-serif';
    const titleLines = wrapText(ctx, title, cardW - logoBoxSize - 80, 2);
    const titleH = titleLines.length * 42;
    const noteH = personalNote ? 30 : 0;
    const headerH = Math.max(160, 32 + titleH + noteH + 18 + 36 + 24);

    // Measure Stops
    const stopHeights = stops.map((post) => {
      ctx.font = '700 20px system-ui, -apple-system, sans-serif';
      const sTitleLines = wrapText(ctx, post.title, 520, 2);
      const topH = Math.max(120, sTitleLines.length * 26 + 56);

      ctx.font = '400 15px system-ui, -apple-system, sans-serif';
      const descLines = wrapText(ctx, post.description || '', 670, 3);
      const descBoxH = descLines.length > 0 ? (descLines.length * 22 + 22) : 0;

      return topH + (descBoxH > 0 ? descBoxH + 14 : 0) + 26;
    });

    const timelineStartH = 46;
    const footerH = 50;
    const stopsTotalH = stopHeights.reduce((a, b) => a + b, 0) + Math.max(0, stops.length - 1) * 18;

    const cardH = headerH + timelineStartH + stopsTotalH + footerH + 20;
    const canvasH = cardH + cardMargin * 2;

    canvas.width = canvasW;
    canvas.height = canvasH;

    // Background of canvas (clean soft slate)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw card rounded container
    ctx.save();
    drawRoundRect(ctx, cardMargin, cardMargin, cardW, cardH, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();

    // 1. Header Banner Gradient
    const headerGrad = ctx.createLinearGradient(cardMargin, cardMargin, cardMargin + cardW, cardMargin + headerH);
    headerGrad.addColorStop(0, '#0066FF');
    headerGrad.addColorStop(0.5, '#00B4D8');
    headerGrad.addColorStop(1, '#0096C7');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(cardMargin, cardMargin, cardW, headerH);

    // Header Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px system-ui, -apple-system, sans-serif';
    let textY = cardMargin + 44;
    titleLines.forEach((l) => {
      ctx.fillText(l, cardMargin + 32, textY);
      textY += 40;
    });

    // Optional Note
    if (personalNote) {
      ctx.fillStyle = '#e0f2fe';
      ctx.font = '400 19px system-ui, -apple-system, sans-serif';
      ctx.fillText(personalNote, cardMargin + 32, textY);
      textY += 28;
    }

    // Logo OleVeci en la parte superior derecha simétricamente
    const logoX = cardMargin + cardW - 32 - logoBoxSize;
    const logoY = cardMargin + 30;
    drawRoundRect(ctx, logoX, logoY, logoBoxSize, logoBoxSize, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (logoImg) {
      ctx.save();
      drawRoundRect(ctx, logoX + 6, logoY + 6, logoBoxSize - 12, logoBoxSize - 12, 12);
      ctx.clip();
      ctx.drawImage(logoImg, logoX + 6, logoY + 6, logoBoxSize - 12, logoBoxSize - 12);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OV', logoX + logoBoxSize / 2, logoY + logoBoxSize / 2 + 8);
      ctx.textAlign = 'left';
    }

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardMargin + 32, textY + 4);
    ctx.lineTo(cardMargin + cardW - 32, textY + 4);
    ctx.stroke();
    textY += 16;

    // Pills row
    const pill1Text = `📍 ${stops.length} paradas`;
    ctx.font = '700 17px system-ui, -apple-system, sans-serif';
    const p1W = ctx.measureText(pill1Text).width + 24;
    drawRoundRect(ctx, cardMargin + 32, textY, p1W, 32, 10);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pill1Text, cardMargin + 44, textY + 22);

    const calculatedTotal = estimatedBudget !== undefined
      ? estimatedBudget
      : stops.reduce((s, p) => s + (p.promotionalPrice || p.originalPrice || 0), 0);
    const pill2Text = `Total estimado: ${calculatedTotal > 0 ? Math.round(calculatedTotal).toLocaleString('es-CO') + ' pesos' : 'Sin costo'}`;
    ctx.font = '400 17px system-ui, -apple-system, sans-serif';
    const p2W = ctx.measureText(pill2Text).width + 24;
    drawRoundRect(ctx, cardMargin + 32 + p1W + 10, textY, p2W, 32, 10);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pill2Text, cardMargin + 44 + p1W + 10, textY + 22);

    // 2. Timeline Start Point
    let timelineY = cardMargin + headerH + 24;
    const timelineX = cardMargin + 46;

    // Start Dot Circle
    ctx.beginPath();
    ctx.arc(timelineX, timelineY + 8, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#007af7';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(timelineX, timelineY + 8, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#007af7';
    ctx.fill();

    ctx.font = '500 17px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Inicio: ', timelineX + 18, timelineY + 14);
    const inW = ctx.measureText('Inicio: ').width;

    ctx.font = '800 17px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#0056d6';
    const startStore = stops[0]?.businessName || `Centro de ${currentCity}`;
    ctx.fillText(startStore, timelineX + 18 + inW, timelineY + 14);

    timelineY += timelineStartH;

    // 3. Sequential Stops
    stops.forEach((post, idx) => {
      const boxH = stopHeights[idx];
      const stopBoxX = cardMargin + 76;
      const stopBoxW = cardW - 96;

      const badgeY = timelineY + 26;

      // Connecting vertical line to next stop
      if (idx < stops.length - 1) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(timelineX, badgeY + 14);
        ctx.lineTo(timelineX, badgeY + boxH + 8);
        ctx.stroke();
      }

      // Step Number Badge (Blue circle with white number)
      ctx.beginPath();
      ctx.arc(timelineX, badgeY, 14, 0, Math.PI * 2);
      const bGrad = ctx.createLinearGradient(timelineX - 14, badgeY - 14, timelineX + 14, badgeY + 14);
      bGrad.addColorStop(0, '#0056d6');
      bGrad.addColorStop(1, '#041f5e');
      ctx.fillStyle = bGrad;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 15px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1), timelineX, badgeY + 5);
      ctx.textAlign = 'left';

      // Stop Card Outer Box (slate-100)
      drawRoundRect(ctx, stopBoxX, timelineY, stopBoxW, boxH, 18);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Thumbnail with Price
      const thumbX = stopBoxX + 14;
      const thumbY = timelineY + 14;
      const thumbSize = 110;

      ctx.save();
      drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 12);
      ctx.clip();
      const img = loadedImgs[idx];
      if (img) {
        const imgRatio = img.width / img.height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (imgRatio > 1) {
          sw = img.height;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, thumbX, thumbY, thumbSize, thumbSize);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
        ctx.fillStyle = '#64748b';
        ctx.font = '800 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OV', thumbX + thumbSize / 2, thumbY + thumbSize / 2 + 8);
        ctx.textAlign = 'left';
      }

      // Overlaid Price Badge
      const stopPrice = post.promotionalPrice || post.originalPrice;
      if (stopPrice) {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        ctx.fillRect(thumbX, thumbY + thumbSize - 26, thumbSize, 26);
        ctx.fillStyle = '#34d399';
        ctx.font = '900 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`$${Math.round(stopPrice).toLocaleString('es-CO')}`, thumbX + thumbSize / 2, thumbY + thumbSize - 8);
        ctx.textAlign = 'left';
      }
      ctx.restore();

      // Info text on the right of thumbnail
      const infoX = thumbX + thumbSize + 14;
      const infoW = stopBoxW - (thumbSize + 42);
      let infoY = timelineY + 28;

      // Title
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 19px system-ui, -apple-system, sans-serif';
      const sTitleLines = wrapText(ctx, post.title, infoW, 2);
      sTitleLines.forEach((tl) => {
        ctx.fillText(tl, infoX, infoY);
        infoY += 24;
      });

      // Store
      ctx.fillStyle = '#334155';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText(`🏪 ${post.businessName}`, infoX, infoY + 4);
      infoY += 22;

      // Address
      const fullAddress = `${post.businessAddress || 'Dirección registrada'}${post.businessCity ? ', ' + post.businessCity : ''}`;
      ctx.fillStyle = '#64748b';
      ctx.font = '500 15px system-ui, sans-serif';
      const addrLines = wrapText(ctx, `📍 ${fullAddress}`, infoW, 1);
      ctx.fillText(addrLines[0] || '', infoX, infoY + 4);

      // Description Box
      if (post.description) {
        const descBoxY = timelineY + Math.max(120, sTitleLines.length * 26 + 56) + 10;
        const descBoxW = stopBoxW - 28;
        ctx.font = '400 14.5px system-ui, -apple-system, sans-serif';
        const descLines = wrapText(ctx, post.description, descBoxW - 24, 3);
        const descBoxH = descLines.length * 22 + 18;

        drawRoundRect(ctx, stopBoxX + 14, descBoxY, descBoxW, descBoxH, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#475569';
        let descTextY = descBoxY + 18;
        descLines.forEach((dl) => {
          ctx.fillText(dl, stopBoxX + 24, descTextY);
          descTextY += 22;
        });
      }

      timelineY += boxH + 18;
    });

    // 4. Card Footer
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cardMargin, timelineY, cardW, footerH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardMargin, timelineY);
    ctx.lineTo(cardMargin + cardW, timelineY);
    ctx.stroke();

    ctx.font = '800 17px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#0066FF';
    ctx.fillText('OleVeci', cardMargin + 28, timelineY + 32);

    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('• Tu Guía Local en la Sabana', cardMargin + 98, timelineY + 32);

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = '#007af7';
    ctx.textAlign = 'right';
    ctx.fillText('oleveci.com', cardMargin + cardW - 28, timelineY + 32);
    ctx.textAlign = 'left';

    ctx.restore(); // restore card clipping

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
  } catch (err) {
    console.error('Error generating plan image blob:', err);
    return null;
  }
}

async function downloadCompositePlanImage(
  title: string,
  stops: Post[],
  personalNote?: string,
  currentCity: string = 'Cajicá',
  estimatedBudget?: number
): Promise<boolean> {
  try {
    const blob = await generatePlanImageBlob(title, stops, personalNote, currentCity, estimatedBudget);
    if (!blob) return false;

    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `OleVeci_${safeName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Error downloading plan image:', err);
    return false;
  }
}

async function generatePlanImageFile(
  title: string,
  stops: Post[],
  personalNote?: string,
  currentCity: string = 'Cajicá',
  estimatedBudget?: number
): Promise<File | null> {
  const blob = await generatePlanImageBlob(title, stops, personalNote, currentCity, estimatedBudget);
  if (!blob) return null;
  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  return new File([blob], `OleVeci_${safeName}.png`, { type: 'image/png' });
}

export const SharePostModal: React.FC<SharePostModalProps> = ({
  isOpen,
  onClose,
  post,
  business,
  plan,
  planStops = [],
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;
  if (!post && !business && !plan) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://oleveci.com';

  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  const showToast = (message: string) => {
    setFeedbackToast(message);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // Determine item type and normalize share payload
  const resolvedPlan = plan || (post?.isPlan && post.planData ? (post.planData as SimulatedReadyPlan) : null);
  const resolvedStops = planStops.length > 0 ? planStops : (post?.planStops || []);

  const effectivePlanStops = useMemo(() => {
    if (resolvedStops.length > 0) return resolvedStops;
    if (resolvedPlan) {
      return resolvePlanPosts(resolvedPlan, INITIAL_POSTS);
    }
    return [];
  }, [resolvedStops, resolvedPlan]);

  const isPlan = Boolean(resolvedPlan);
  const isPost = Boolean(post) && !isPlan;
  const isBusiness = !post && !isPlan && Boolean(business);

  const shareData = isPlan
    ? formatPlanShareText(resolvedPlan!, effectivePlanStops, origin)
    : isBusiness
    ? formatBusinessShareText(business!, origin)
    : formatPostShareText(post!, origin);

  const modalHeaderTitle = isPlan
    ? 'Compartir itinerario'
    : isBusiness
    ? 'Compartir comercio'
    : 'Compartir publicación';

  const isVideo = Boolean(post?.videoUrl);

  const hasDiscount = Boolean(
    post?.originalPrice &&
    post?.promotionalPrice &&
    post.originalPrice > post.promotionalPrice
  );

  const discountPercent = hasDiscount
    ? Math.round(((post!.originalPrice! - post!.promotionalPrice!) / post!.originalPrice!) * 100)
    : 0;

  const cardImage = isPlan
    ? resolvedPlan?.coverImage || (resolvedStops.length > 0 ? resolvedStops[0].imageUrl : post?.imageUrl) || '/Icono_Oleveci_sin_fondo.png?v=clean'
    : isBusiness
    ? business?.coverImage || business?.logo
    : post?.imageUrl;

  const cardTitle = isPlan
    ? resolvedPlan?.planTitle || post?.title
    : isBusiness
    ? business?.name
    : post?.title;

  const cardBusinessName = isPlan
    ? `OleVeci · ${resolvedPlan?.municipality || post?.businessCity || 'Sabana Centro'}`
    : isBusiness
    ? business?.name
    : post?.businessName;

  const cardLogo = isPlan
    ? (resolvedStops.length > 0 ? resolvedStops[0].businessLogo : '/Icono_Oleveci_sin_fondo.png?v=clean')
    : isBusiness
    ? business?.logo
    : business?.logo || post?.businessLogo || '/Icono_Oleveci_sin_fondo.png?v=clean';

  // 1. WhatsApp Action (Apertura directa nativa en celular sin pedir ventanas emergentes, estilo TikTok/Instagram)
  const handleShareWhatsApp = () => {
    const text = shareData.shareMessage;
    const isMobileDevice =
      isMobile ||
      (typeof window !== 'undefined' &&
        (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768));

    if (isMobileDevice) {
      // En móvil, la navegación directa a api.whatsapp.com abre la app instalada sin bloquear ventanas emergentes
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.location.href = waUrl;
    } else {
      const waUrl = getWhatsAppWebUrl(text);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 1B. Compartir Nativo del Sistema (Bandeja nativa de Android/iOS con WhatsApp, Instagram, Telegram)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const handleShareNative = async () => {
    if (!navigator.share) {
      handleShareWhatsApp();
      return;
    }
    try {
      if (isPlan && effectivePlanStops.length > 0 && typeof navigator.canShare === 'function') {
        const file = await generatePlanImageFile(
          cardTitle || 'Itinerario',
          effectivePlanStops,
          resolvedPlan?.personalNote,
          resolvedPlan?.municipality || 'Cajicá',
          resolvedPlan?.estimatedBudget
        );
        if (file && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: shareData.title,
            text: shareData.shareMessage,
          });
          return;
        }
      }
      await navigator.share({
        title: shareData.title,
        text: shareData.shareMessage,
        url: shareData.url,
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        handleShareWhatsApp();
      }
    }
  };

  // 2. Copiar Enlace
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareData.url);
      } else {
        const input = document.createElement('input');
        input.value = shareData.url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      showToast('¡Enlace copiado al portapapeles!');
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      showToast('No se pudo copiar el enlace');
    }
  };

  // 6. Descargar Imagen
  const handleDownloadCard = async () => {
    setIsDownloading(true);
    let success = false;
    if (isPlan && effectivePlanStops.length > 0) {
      success = await downloadCompositePlanImage(
        cardTitle || 'Itinerario',
        effectivePlanStops,
        resolvedPlan?.personalNote,
        resolvedPlan?.municipality || 'Cajicá',
        resolvedPlan?.estimatedBudget
      );
    } else if (isPost && post) {
      success = await downloadPostCardImage(post.id, post.title, 'story');
    } else if (cardImage) {
      const safeName = (cardTitle || 'oleveci').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      success = await downloadDirectImage(cardImage, `OleVeci_${safeName}.png`);
    }
    setIsDownloading(false);
    if (success) {
      showToast('¡Imagen descargada con éxito!');
    } else {
      showToast('No se pudo descargar la imagen');
    }
  };

  const renderBusinessAvatar = () => {
    if (cardLogo) {
      return (
        <img
          src={cardLogo}
          alt={cardBusinessName || ''}
          referrerPolicy="no-referrer"
          className="w-full h-full rounded-full object-cover"
        />
      );
    }
    return (
      <div className="flex items-center justify-center w-full h-full text-white font-black text-xs uppercase bg-slate-900">
        {(cardBusinessName || 'OV').slice(0, 2)}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-[3500] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#040e28] text-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-white/10 flex flex-col max-h-[96vh] overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drawer handle bar */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-5 pt-2.5 sm:pt-4 pb-2.5 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#007af7] to-[#38bdf8] flex items-center justify-center shadow-md text-white">
              <Share2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 id="share-modal-title" className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {modalHeaderTitle}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto overscroll-contain">
          {/* ======================================================== */}
          {/* PREVIEW CARD: ITINERARY PLAN CARD OR 9:16 STORY POST/BIZ */}
          {/* ======================================================== */}
          {isPlan && effectivePlanStops.length > 0 ? (
            <div className="w-full max-h-[380px] sm:max-h-[420px] overflow-y-auto rounded-2xl border border-white/20 shadow-2xl bg-white select-none">
              <ItineraryPlanCard
                planTitle={cardTitle || 'Itinerario'}
                narrativeHook={resolvedPlan?.personalNote}
                stops={effectivePlanStops}
                currentCity={resolvedPlan?.municipality || 'Cajicá'}
                totalEstimatedCost={resolvedPlan?.estimatedBudget}
                showActions={false}
                showLogoHeader={true}
              />
            </div>
          ) : (
            <div className="relative w-full aspect-[9/16] max-h-[420px] sm:max-h-[460px] rounded-[24px] sm:rounded-[28px] overflow-hidden bg-black shadow-2xl border border-white/20 select-none mx-auto flex flex-col justify-between">
              {/* 1. Full-Bleed Media (Image, Multi-Photo Itinerary Layout, or Video) */}
              <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center bg-black">
                {cardImage ? (
                  <img
                    src={cardImage}
                    alt={cardTitle || ''}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: post?.imagePosition
                        ? `${post.imagePosition.x}% ${post.imagePosition.y}%`
                        : '50% 50%',
                      transform:
                        post?.imageScale && post.imageScale !== 1
                          ? `scale(${post.imageScale})`
                          : undefined,
                      filter:
                        post?.imageFilter && post.imageFilter !== 'none'
                          ? post.imageFilter
                          : undefined,
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 font-bold text-xs">
                    <Film className="w-10 h-10 text-cyan-400/40" />
                  </div>
                )}

                {/* Cinematic Vignettes */}
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none z-10" />
                <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/95 via-black/75 to-transparent pointer-events-none z-10" />
              </div>

              {/* 2. Top Bar: Badge depending on item type */}
              <div className="relative z-20 pt-3 px-3 flex items-center justify-between">
                {isPost && discountPercent > 0 ? (
                  <div
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-white font-black text-xs tracking-tight shadow-xl border border-white/30 backdrop-blur-md"
                    style={{
                      background: 'linear-gradient(135deg, #ff3366 0%, #ff5e36 100%)',
                      boxShadow:
                        '0 4px 15px rgba(255, 51, 102, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)',
                    }}
                  >
                    <span className="drop-shadow-xs">-{discountPercent}% OFF</span>
                  </div>
                ) : isBusiness ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white font-black text-xs tracking-tight shadow-xl border border-white/30 backdrop-blur-md bg-blue-600/80">
                    <Store className="w-3.5 h-3.5 text-cyan-300" />
                    <span>{business?.verified ? '✓ Verificado' : 'Comercio local'}</span>
                  </div>
                ) : (
                  <div />
                )}
              </div>

              {/* Video center play icon indicator if post is video */}
              {isVideo && (
                <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-black/60 border border-white/80 text-white flex items-center justify-center shadow-xl">
                    <Play className="w-5 h-5 ml-0.5 fill-white" />
                  </div>
                </div>
              )}

              {/* 3. Bottom Content Overlay */}
              <div className="relative z-20 pb-4 px-3.5 flex flex-col pointer-events-auto">
                {/* Business Name / Creator with Avatar */}
                <div className="inline-flex items-center gap-2 text-white font-extrabold text-sm tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-md overflow-hidden shrink-0 flex items-center justify-center">
                    {renderBusinessAvatar()}
                  </div>
                  <span>{cardBusinessName}</span>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 fill-cyan-400/20 shrink-0" />
                </div>

                {/* Title */}
                <h2
                  className={`text-white font-black leading-tight mt-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
                    (cardTitle || '').length > 50 ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
                  }`}
                >
                  {cardTitle}
                </h2>

                {/* Info Pill / Pricing */}
                {isPost && (
                  <div className="mt-2 inline-flex items-center gap-2 p-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 shadow-xl w-fit">
                    {post?.promotionalPrice ? (
                      <>
                        <span className="bg-emerald-500 text-white font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs tracking-tight">
                          {formatCOP(post.promotionalPrice)}
                        </span>
                        {post.originalPrice && post.originalPrice > post.promotionalPrice && (
                          <span className="text-white/60 line-through text-xs font-semibold pr-2">
                            {formatCOP(post.originalPrice)}
                          </span>
                        )}
                      </>
                    ) : post?.originalPrice ? (
                      <span className="text-white font-black text-xs px-3 py-0.5">
                        {formatCOP(post.originalPrice)}
                      </span>
                    ) : (
                      <span className="text-emerald-300 font-bold text-xs px-2.5 py-0.5">
                        Consultar precio
                      </span>
                    )}
                  </div>
                )}

                {isBusiness && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-xs font-bold text-sky-200 w-fit">
                    <MapPin className="w-3.5 h-3.5 text-orange-400" />
                    <span>
                      {[business?.sector, business?.city].filter(Boolean).join(', ') || 'Cajicá'}
                    </span>
                  </div>
                )}

                {/* Validity / Schedule Tag */}
                {isPost && post?.expiryLabel ? (
                  <div className="mt-1.5 flex items-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e293b]/85 backdrop-blur-md border border-white/25 text-sky-200 text-xs font-bold shadow-lg">
                      <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      <span className="truncate max-w-[260px] leading-tight">
                        {post.expiryLabel}
                      </span>
                    </div>
                  </div>
                ) : isBusiness && business?.hours ? (
                  <div className="mt-1.5 flex items-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e293b]/85 backdrop-blur-md border border-white/25 text-sky-200 text-xs font-bold shadow-lg">
                      <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      <span className="truncate max-w-[260px] leading-tight">
                        {business.hours}
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Description */}
                {(isPost && post?.description) ||
                (isBusiness && business?.description) ? (
                  <div className="mt-1.5 max-h-24 sm:max-h-32 overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
                    <p className="text-white/95 text-xs sm:text-[13px] leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-pre-line select-text">
                      {isPost
                        ? post?.description
                        : business?.description}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACTION BUTTONS (Unified Native Share + Copy & Download) */}
          {/* ======================================================== */}
          <div className="pt-2 space-y-2.5">
            {/* Main Share Button: Native Web Share API (mobile/desktop) or Direct WhatsApp */}
            <button
              type="button"
              id="btn-share-main"
              onClick={canNativeShare ? handleShareNative : handleShareWhatsApp}
              className="w-full group relative overflow-hidden py-3 px-4 rounded-2xl bg-gradient-to-r from-[#0056D6] via-[#006ee6] to-[#00C2FF] hover:from-[#004bb8] hover:via-[#005ec8] hover:to-[#00aee6] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl shadow-blue-600/30 border border-cyan-300/40 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              {/* Luminous sheen effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform shrink-0">
                {canNativeShare ? (
                  <Share2 className="w-4 h-4 text-white stroke-[2.5]" />
                ) : (
                  <WhatsAppIcon className="w-4 h-4 fill-white" />
                )}
              </div>

              <div className="text-left leading-tight">
                <div className="font-black text-xs sm:text-sm tracking-wide text-white drop-shadow-sm">
                  {canNativeShare
                    ? isPlan
                      ? 'Compartir Itinerario'
                      : isBusiness
                      ? 'Compartir Comercio'
                      : 'Compartir Publicación'
                    : 'Compartir en WhatsApp'}
                </div>
                <div className="text-[10px] font-semibold text-cyan-100/90 tracking-normal normal-case">
                  {canNativeShare
                    ? 'WhatsApp, Instagram, historias y contactos'
                    : 'Abrir chat directo con el enlace'}
                </div>
              </div>
            </button>

            {/* Secondary actions: Copiar enlace & Descargar imagen */}
            <div className="grid grid-cols-2 gap-2">
              {/* Copiar Enlace */}
              <button
                type="button"
                id="btn-copy-link"
                onClick={handleCopyLink}
                className="py-2.5 px-3 rounded-xl bg-[#111f36] hover:bg-[#182c4c] border border-white/10 hover:border-cyan-400/30 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-sm"
                title="Copiar enlace directo"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                    <span className="text-emerald-300 font-extrabold">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 text-sky-400" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </button>

              {/* Descargar Imagen */}
              <button
                type="button"
                id="btn-download-card"
                onClick={handleDownloadCard}
                disabled={isDownloading}
                className="py-2.5 px-3 rounded-xl bg-[#111f36] hover:bg-[#182c4c] border border-white/10 hover:border-purple-400/30 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                title="Descargar imagen"
              >
                <Download className={`w-4 h-4 text-cyan-300 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span>{isDownloading ? 'Guardando...' : 'Descargar imagen'}</span>
              </button>
            </div>
          </div>

          {/* Feedback Toast */}
          {feedbackToast && (
            <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackToast}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
