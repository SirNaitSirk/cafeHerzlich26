/**
 * pm2 process config for running the app on the Raspberry Pi.
 *
 * Deploy flow on the Pi:
 *   npm ci && npm run build && npm run db:migrate
 *   pm2 start ecosystem.config.cjs && pm2 save
 *
 * HOST 0.0.0.0 makes the app reachable from other devices on the LAN.
 */
module.exports = {
  apps: [
    {
      name: "cafe-herzlich",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
        DB_FILE: "data/cafe.db",
      },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
