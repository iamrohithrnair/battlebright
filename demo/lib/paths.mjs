import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const DEMO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = path.resolve(DEMO_DIR, '..');
export const APP_DIR = path.join(REPO_DIR, 'app');
export const OUTPUT_DIR = path.join(DEMO_DIR, 'output');
export const VIDEO_RAW_DIR = path.join(OUTPUT_DIR, 'video-raw');
export const SHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
export const RUN_LOG = path.join(OUTPUT_DIR, 'run.log');

export const BASE_URL = (process.env.DEMO_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Ports we probe before starting a competing dev server of our own. */
export const CANDIDATE_PORTS = [3000, 3001, 3002, 3003];
