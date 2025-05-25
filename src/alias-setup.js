const path = require('path');
const moduleAlias = require('module-alias');

// Get the absolute paths for the aliases to match Vite configuration
const srcDir = __dirname;

// Register aliases that match your Vite configuration
moduleAlias.addAliases({
  '@utils': path.resolve(srcDir, 'lib/utils'),
  '@dayjs': path.resolve(srcDir, 'lib/utils/dayjs'),
  '@consts': path.resolve(srcDir, 'lib/constants'),
});

// Enable debugging (remove in production)
console.log('Module aliases registered:', {
  '@utils': path.resolve(srcDir, 'lib/utils'),
  '@dayjs': path.resolve(srcDir, 'lib/utils/dayjs'),
  '@consts': path.resolve(srcDir, 'lib/constants'),
});

module.exports = moduleAlias;
