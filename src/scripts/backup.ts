import { createApp } from '../app.js';
import { backupNow } from '../backup.js';

const { config } = createApp();
console.log(JSON.stringify(backupNow(config.dataRoot), null, 2));
