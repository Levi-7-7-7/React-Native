const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  transformer: {
    // Enable Hermes bytecode minification
    minifierConfig: {
      keep_fnames: true,
      mangle: {keep_fnames: true},
    },
  },
  resolver: {
    // Reduce resolver overhead by explicitly listing extensions
    sourceExts: ['tsx', 'ts', 'jsx', 'js', 'json'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
