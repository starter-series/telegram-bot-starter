require('dotenv').config();
const { buildConfig, ConfigError } = require('./lib/config');

try {
  module.exports = buildConfig(process.env);
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
    module.exports = {};
  } else {
    throw err;
  }
}
