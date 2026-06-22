const config = require('./config');
const { createBotRuntime } = require('./bootstrap');

createBotRuntime(config).start();
