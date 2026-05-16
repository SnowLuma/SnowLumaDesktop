import { createServer } from 'node:net';

/**
 * Find a TCP port that is free to bind on 127.0.0.1. Scans up from `start`,
 * with a cap on attempts. Returns the lowest free port found, or throws.
 */
export async function findFreePort(start = 5099, maxTries = 100): Promise<number> {
  let port = Math.max(1024, Math.min(65535, Math.trunc(start)));
  for (let i = 0; i < maxTries; i++) {
    if (port > 65535) break;
    if (await isAvailable(port)) return port;
    port += 1;
  }
  throw new Error(`no free TCP port found near ${start}`);
}

function isAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}
