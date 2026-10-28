import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.mjs';
import { createApi } from './http.mjs';
if (process.env.BUILDER_LOCAL_SAMPLE !== '1') throw new Error('This increment only supports the explicit local sample mode. Set BUILDER_LOCAL_SAMPLE=1.');
const dataDir = fileURLToPath(new URL('../../.work/data/', import.meta.url));
mkdirSync(dataDir, {
  recursive: true
});
const db = openDatabase(`${dataDir}builder.sqlite`, { examples: true });
const server = createApi(db).listen(4174, '127.0.0.1', () => console.log('Builder ERP local sample API listening on 127.0.0.1:4174'));
const stop = () => server.close(() => {
  db.close();
  process.exit(0);
});
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
