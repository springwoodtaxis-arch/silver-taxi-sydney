// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.js --env production
// Docs:  https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: 'silver-service',
      script: 'server.js',
      instances: 1,           // Use 'max' for cluster mode on multi-core servers
      exec_mode: 'fork',      // Use 'cluster' for multi-core
      autorestart: true,
      watch: false,           // Never watch in production
      max_memory_restart: '512M',

      // Environment variables for production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/pm2/silver-service-error.log',
      out_file: '/var/log/pm2/silver-service-out.log',
      merge_logs: true,

      // Graceful restart settings
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,

      // Zero-downtime reload
      wait_ready: true,
      min_uptime: '5s',
      max_restarts: 10,
    },
  ],
};
