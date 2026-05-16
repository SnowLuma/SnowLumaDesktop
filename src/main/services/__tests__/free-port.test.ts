import { describe, expect, it } from 'vitest';
import { createServer } from 'node:net';
import { findFreePort } from '../free-port';

describe('findFreePort', () => {
  it('returns the requested port when it is free', async () => {
    // Pick an unlikely-used high port to reduce flakiness.
    const port = await findFreePort(58_770);
    expect(port).toBeGreaterThanOrEqual(58_770);
  });

  it('falls through to the next free port when the seed is taken', async () => {
    const server = createServer();
    await new Promise<void>((res, rej) => {
      server.once('error', rej);
      server.once('listening', () => res());
      server.listen(58_780, '127.0.0.1');
    });
    try {
      const port = await findFreePort(58_780);
      expect(port).toBeGreaterThan(58_780);
    } finally {
      await new Promise<void>((res) => server.close(() => res()));
    }
  });
});
