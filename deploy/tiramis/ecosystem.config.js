module.exports = {
  apps: [
    {
      name: 'tiramis',
      script: 'dist/apps/tiramis/apps/tiramis/src/main.js',
      cwd: '/opt/apps/tiramis/current',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      kill_timeout: 15000,
      listen_timeout: 15000,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
      },
      out_file: '/var/log/pm2/tiramis-out.log',
      error_file: '/var/log/pm2/tiramis-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
