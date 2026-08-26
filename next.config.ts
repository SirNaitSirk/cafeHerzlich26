import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone build for running as a single Node process on the Raspberry Pi.
  output: "standalone",
  // better-sqlite3 is a native module and must not be bundled by the server build.
  serverExternalPackages: ["better-sqlite3"],
  // Product images are served locally from /api/uploads on the Pi; skip the
  // optimizer so image handling stays offline-safe and cheap on Pi hardware.
  images: { unoptimized: true },
};

// next.config.js
module.exports = {
  allowedDevOrigins: ['192.168.2.226'],
}

export default nextConfig;
