const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Optimisations AGRESSIVES pour réduire l'utilisation de mémoire
config.transformer = {
  ...config.transformer,
  minifierPath: 'metro-minify-terser',
  minifierConfig: {
    ecma: 8,
    keep_classnames: false,
    keep_fnames: false,
    module: true,
    mangle: {
      module: true,
    },
    compress: {
      drop_console: false,
      reduce_funcs: false,
      keep_fargs: false,
    },
  },
  // Désactiver le cache du transformer pour économiser la RAM
  enableBabelRCLookup: false,
  enableBabelRuntime: false,
};

// CRITIQUE: Limiter à 1 seul worker pour réduire drastiquement la mémoire
config.maxWorkers = 1;

// Augmenter le timeout pour éviter les timeouts lors du build lent
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return middleware;
  },
};

// Réduire la taille du cache
config.cacheStores = [];

module.exports = config;
