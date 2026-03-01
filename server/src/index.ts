import { config } from './config.js';
import { buildApp } from './app.js';

const app = await buildApp();

try {
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`party-babel server listening on ${config.HOST}:${config.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
