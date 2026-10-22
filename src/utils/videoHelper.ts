export type VideoPlatform = 'direct' | 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'vimeo' | 'drive';

export type VideoAspectRatio = '9:16' | '1:1' | '4:5' | '2:3' | '16:9' | '16:10';

export interface ParsedVideoInfo {
  platform: VideoPlatform;
  embedUrl: string;
  directUrl: string;
  isIframe: boolean;
  videoId?: string;
  defaultThumbnail?: string;
  platformName: string;
  isVertical?: boolean;
  aspectRatio: VideoAspectRatio;
  streamUrl?: string;
}

/**
 * Parses any video URL (TikTok, YouTube, Instagram Reels, Facebook, Vimeo, Google Drive, or direct MP4/WebM)
 * and returns embeddable iframe URL, direct stream URL, and recommended aspect ratio.
 */
export function parseVideoUrl(rawUrl?: string | null): ParsedVideoInfo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      platform: 'direct',
      embedUrl: '',
      directUrl: '',
      isIframe: false,
      platformName: 'Directo',
      isVertical: true,
      aspectRatio: '9:16',
    };
  }

  const url = rawUrl.trim();

  // 1. TikTok:
  // - Standard: https://www.tiktok.com/@user/video/7123456789012345678
  // - Short mobile links: https://vt.tiktok.com/ZSxxxx/, https://vm.tiktok.com/xxx/, https://www.tiktok.com/t/xxx/
  const tiktokIdMatch =
    url.match(/tiktok\.com\/(?:@[\w.-]+\/video|v|embed|embed\/v2)\/(\d+)/i) ||
    url.match(/tiktok\.com\/.*?(\d{15,22})/i);
  const tiktokShortMatch = url.match(/(?:vt|vm)\.tiktok\.com\/([a-zA-Z0-9_-]+)/i) || url.match(/tiktok\.com\/t\/([a-zA-Z0-9_-]+)/i);

  if (tiktokIdMatch && tiktokIdMatch[1]) {
    const videoId = tiktokIdMatch[1];
    const streamUrl = `/api/video/stream?url=${encodeURIComponent(url)}`;
    return {
      platform: 'tiktok',
      embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
      directUrl: streamUrl,
      streamUrl,
      isIframe: true,
      videoId,
      defaultThumbnail: `/api/video/poster?url=${encodeURIComponent(url)}`,
      platformName: 'TikTok',
      isVertical: true,
      aspectRatio: '9:16',
    };
  } else if (tiktokShortMatch) {
    const streamUrl = `/api/video/stream?url=${encodeURIComponent(url)}`;
    return {
      platform: 'tiktok',
      embedUrl: url,
      directUrl: streamUrl,
      streamUrl,
      isIframe: true,
      defaultThumbnail: `/api/video/poster?url=${encodeURIComponent(url)}`,
      platformName: 'TikTok',
      isVertical: true,
      aspectRatio: '9:16',
    };
  }

  // 2. YouTube & YouTube Shorts
  // https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // https://youtu.be/dQw4w9WgXcQ
  // https://www.youtube.com/shorts/dQw4w9WgXcQ
  // https://www.youtube.com/embed/dQw4w9WgXcQ
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    const isShorts = url.toLowerCase().includes('/shorts/');
    return {
      platform: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&playsinline=1&controls=0&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1&disablekb=1&fs=0`,
      directUrl: url,
      isIframe: true,
      videoId,
      defaultThumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      platformName: isShorts ? 'YouTube Shorts' : 'YouTube',
      isVertical: isShorts,
      aspectRatio: isShorts ? '9:16' : '16:9',
    };
  }

  // 3. Instagram Reels & Posts
  // https://www.instagram.com/reel/Cxxxx/
  // https://www.instagram.com/reels/Cxxxx/
  // https://www.instagram.com/share/reel/Cxxxx/
  // https://www.instagram.com/p/Cxxxx/
  const igMatch = url.match(/instagram\.com\/(?:share\/)?(?:reel|reels|p|tv|r)\/([a-zA-Z0-9_-]+)/i);
  if (igMatch && igMatch[1]) {
    const reelId = igMatch[1];
    const streamUrl = `/api/video/stream?url=${encodeURIComponent(url)}`;
    return {
      platform: 'instagram',
      embedUrl: `https://www.instagram.com/reel/${reelId}/embed/`,
      directUrl: streamUrl,
      streamUrl,
      isIframe: true,
      videoId: reelId,
      defaultThumbnail: `/api/video/poster?url=${encodeURIComponent(url)}`,
      platformName: 'Instagram Reel',
      isVertical: true,
      aspectRatio: '9:16',
    };
  }

  // 4. Facebook Videos & Reels
  // https://www.facebook.com/reel/12345
  // https://www.facebook.com/share/r/12345
  // https://fb.watch/12345
  const fbMatch = url.match(/(?:facebook\.com\/(?:share\/r\/|reel\/|reels\/|watch\/?\?v=|.*?\/videos\/)|fb\.watch\/)/i);
  if (fbMatch) {
    const isReel = url.toLowerCase().includes('/reel') || url.toLowerCase().includes('/share/r/');
    const streamUrl = `/api/video/stream?url=${encodeURIComponent(url)}`;
    return {
      platform: 'facebook',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`,
      directUrl: streamUrl,
      streamUrl,
      isIframe: true,
      defaultThumbnail: `/api/video/poster?url=${encodeURIComponent(url)}`,
      platformName: isReel ? 'Facebook Reel' : 'Facebook',
      isVertical: isReel,
      aspectRatio: isReel ? '9:16' : '16:9',
    };
  }

  // 5. Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/\d+\/video\/|video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    const videoId = vimeoMatch[1];
    return {
      platform: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=0&loop=1&playsinline=1`,
      directUrl: url,
      isIframe: true,
      videoId,
      platformName: 'Vimeo',
      isVertical: false,
      aspectRatio: '16:9',
    };
  }

  // 6. Google Drive
  const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (gdriveMatch && gdriveMatch[1]) {
    const fileId = gdriveMatch[1];
    return {
      platform: 'drive',
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      directUrl: url,
      isIframe: true,
      videoId: fileId,
      platformName: 'Google Drive',
      isVertical: false,
      aspectRatio: '16:9',
    };
  }

  // 7. Direct Video (.mp4, .webm, data:video, blob:, etc.)
  return {
    platform: 'direct',
    embedUrl: url,
    directUrl: url,
    isIframe: false,
    platformName: 'Video directo',
    isVertical: true,
    aspectRatio: '9:16',
  };
}

/**
 * Checks if a string is a webpage URL for a video host rather than an image asset.
 * Used to prevent passing video web URLs into <img src="..."> tags.
 */
export function isVideoWebpageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return Boolean(
    url.match(/(?:tiktok\.com|instagram\.com|facebook\.com|fb\.watch|youtube\.com|youtu\.be|vimeo\.com)/i) &&
    !url.match(/\.(?:jpg|jpeg|png|webp|gif|svg)(?:\?.*)?$/i) &&
    !url.startsWith('/api/video/poster')
  );
}

