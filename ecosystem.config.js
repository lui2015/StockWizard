module.exports = {
  apps: [
    {
      name: 'stockwizard',
      script: 'server/index.mjs',
      cwd: '/root/StockWizard',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3280,
        HOST: '127.0.0.1',
        BASE_PATH: '/StockWizard',
        DATA_DIR: './data',
        TZ: 'Asia/Shanghai',
      },
    },
  ],
}
