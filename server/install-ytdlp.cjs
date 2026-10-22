const fs = require('fs');
const path = require('path');

async function installYtDlp() {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const binDir = path.join(process.cwd(), 'server', 'bin');
  const binPath = path.join(binDir, binName);

  if (fs.existsSync(binPath) && fs.statSync(binPath).size > 1000000) {
    console.log(`[yt-dlp installer] Binary already present at ${binPath} (${fs.statSync(binPath).size} bytes)`);
    if (!isWin) {
      try { fs.chmodSync(binPath, 0o755); } catch {}
    }
    return;
  }

  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const url = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

  console.log(`[yt-dlp installer] Downloading ${binName} for ${process.platform}...`);

  try {
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(binPath, buf);
      if (!isWin) {
        try { fs.chmodSync(binPath, 0o755); } catch {}
      }
      console.log(`[yt-dlp installer] Successfully installed ${binName} (${buf.length} bytes)`);
    } else {
      console.warn(`[yt-dlp installer] HTTP ${res.status}: could not download during build.`);
    }
  } catch (err) {
    console.warn(`[yt-dlp installer] Note: could not download during build (${err.message}). Runtime fallback will attempt download if needed.`);
  }
}

installYtDlp().catch(() => process.exit(0));
