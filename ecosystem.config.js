// PM2 Ecosystem Configuration
// This file configures PM2 for production deployment

module.exports = {
  apps: [{
    name: 'zakaa-api',
    script: './server.js',
    instances: 1,  // or 'max' for cluster mode
    exec_mode: 'fork',  // or 'cluster' for multi-instance
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Auto restart
    watch: false,  // Set to true to auto-restart on file changes (not recommended for production)
    ignore_watch: ['node_modules', 'logs', 'frontend'],
    
    // Resource limits
    max_memory_restart: '1G',  // Restart if memory exceeds 1GB
    
    // Graceful restart/reload
    kill_timeout: 5000,
    listen_timeout: 10000,
    shutdown_with_message: true,
    
    // Crash handling
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Cron restart (optional - restart daily at 3 AM)
    // cron_restart: '0 3 * * *',
    
    // Advanced
    node_args: '--max-old-space-size=1024'  // Limit Node.js memory to 1GB
  }],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'YOUR_ELASTIC_IP',  // Replace with your EC2 IP
      key: '~/.ssh/zakaa-key.pem',  // Replace with your key path
      ref: 'origin/main',
      repo: 'YOUR_GIT_REPO_URL',  // Replace with your repo URL
      path: '/home/ubuntu/apps/zakaa',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p /home/ubuntu/apps/zakaa'
    }
  }
};
