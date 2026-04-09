const path = require('node:path');
const { app } = require('electron');

const userDataDir = process.env.COWORK_E2E_USER_DATA_DIR;
if (userDataDir) {
  app.setPath('userData', userDataDir);
}

require(path.resolve(__dirname, '../dist-electron/main/index.js'));
