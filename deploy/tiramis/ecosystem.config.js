// Copy this once to /opt/apps/tiramis/shared/ecosystem.config.js on the server.
// deploy.sh reads it from there; it is not part of any release artifact.
module.exports = {
  apps: [
    {
      name: 'tiramis',
      script: 'dist/apps/tiramis/apps/tiramis/src/main.js',
      cwd: '/opt/apps/tiramis/current',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
      out_file: '/var/log/pm2/tiramis-out.log',
      error_file: '/var/log/pm2/tiramis-error.log',
      time: true,
    },
  ],
};
