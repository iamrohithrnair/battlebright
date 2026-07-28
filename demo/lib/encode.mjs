import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function resolveBinary(name) {
  try {
    const { stdout } = await run('which', [name]);
    const found = stdout.trim();
    return found || null;
  } catch {
    return null;
  }
}

/**
 * Prefers a system ffmpeg, but Playwright ships its own for video muxing, so we
 * fall back to that rather than telling the user to install anything.
 */
export async function findFfmpeg() {
  const system = await resolveBinary('ffmpeg');
  if (system) return { path: system, source: 'system' };

  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(process.env.HOME ?? '', 'Library/Caches/ms-playwright'),
  ].filter(Boolean);

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      if (!entry.startsWith('ffmpeg')) continue;
      for (const candidate of ['ffmpeg-mac', 'ffmpeg-mac-arm64', 'ffmpeg-linux', 'ffmpeg.exe']) {
        const full = path.join(root, entry, candidate);
        if (fs.existsSync(full)) return { path: full, source: 'playwright' };
      }
    }
  }
  return null;
}

export async function findFfprobe() {
  return resolveBinary('ffprobe');
}

/** Seconds of video, or null when no ffprobe is available to ask. */
export async function videoDuration(file) {
  const ffprobe = await findFfprobe();
  if (!ffprobe) return null;
  try {
    const { stdout } = await run(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      file,
    ]);
    const seconds = Number.parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? seconds : null;
  } catch {
    return null;
  }
}

export async function toMp4(webm, mp4, log) {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) {
    log.warn('ffmpeg was not found on PATH and none is bundled with Playwright — keeping the .webm only.');
    log.warn('Install it with `brew install ffmpeg` and re-run `npm run record` to get an .mp4.');
    return null;
  }

  log.info(`Transcoding to MP4 with ffmpeg (${ffmpeg.source}: ${ffmpeg.path}).`);
  try {
    await run(
      ffmpeg.path,
      ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4],
      { maxBuffer: 32 * 1024 * 1024 },
    );
    return fs.existsSync(mp4) ? mp4 : null;
  } catch (error) {
    log.warn(`MP4 transcode failed, keeping the .webm: ${error.message.split('\n')[0]}`);
    return null;
  }
}

/** A short looping GIF of one beat, for the README hero. */
export async function toGif(source, gif, { start = 0, duration = 6, width = 960 } = {}, log) {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) {
    log.warn('Skipping the README GIF because no ffmpeg is available.');
    return null;
  }

  const palette = `${gif}.palette.png`;
  try {
    const filters = `fps=12,scale=${width}:-1:flags=lanczos`;
    await run(ffmpeg.path, [
      '-y', '-ss', String(start), '-t', String(duration), '-i', source,
      '-vf', `${filters},palettegen=stats_mode=diff`, palette,
    ], { maxBuffer: 32 * 1024 * 1024 });

    await run(ffmpeg.path, [
      '-y', '-ss', String(start), '-t', String(duration), '-i', source, '-i', palette,
      '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
      '-loop', '0', gif,
    ], { maxBuffer: 32 * 1024 * 1024 });

    return fs.existsSync(gif) ? gif : null;
  } catch (error) {
    log.warn(`GIF export failed: ${error.message.split('\n')[0]}`);
    return null;
  } finally {
    fs.rmSync(palette, { force: true });
  }
}

export const humanBytes = (n) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`;
