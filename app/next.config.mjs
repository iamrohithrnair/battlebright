import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js ships untranspiled ESM examples; let Next compile them.
  transpilePackages: ['three'],
  turbopack: {
    // Pin the workspace root: a stray lockfile further up the tree makes Turbopack
    // guess the wrong directory.
    root: dirname(fileURLToPath(import.meta.url)),
  },
  images: {
    // Robot photography on the live-intel page comes straight off the wiki CDN.
    remotePatterns: [
      { protocol: 'https', hostname: 'static.wikia.nocookie.net' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
};

export default nextConfig;
