# NovaFPS Multiplayer Relay MVP

This is the first networking milestone for NovaFPS: shared online rooms, presence, and client position/aim updates. The static website remains on GitHub Pages. The Worker provides WebSocket transport and a Durable Object keeps each room's connected sockets together.

## Important limitations

- This is **not yet a complete multiplayer FPS**: remote movement is relayed and shown in the room roster, but remote players are not yet rendered as 3D/raycast opponents and shots are not processed as authoritative damage.
- The client still owns its local movement and can lie about position, aim, health, or alive state. The relay has only basic input checks and a message rate limit. Do not use it for ranked/competitive play yet.
- The current sign-in screen is browser-local demo authentication. It does not establish trusted online identities. Do not use real passwords or sensitive data.
- Never put secret keys in the public GitHub repository.

## Deploy on Cloudflare

1. Create/sign in to a Cloudflare account and open Workers & Pages.
2. Install Node.js only if you choose the Wrangler CLI deployment method. If you don't want Node.js, create a Worker in the dashboard and paste `worker.js`, then configure the Durable Object binding and migration using the dashboard's current Durable Objects setup flow. Dashboard labels can change; the binding must be named `NOVA_ROOM` and point to class `NovaRoom`.
3. CLI option from this folder: `npx wrangler deploy` (requires Node.js/npm and Cloudflare login). This repository itself does not require Node to run the static game; the Worker is a separate hosted service.
4. Confirm the Worker root URL returns JSON with `"status":"ok"`.
5. Copy the deployed Worker hostname. The WebSocket URL is `wss://YOUR-WORKER-HOSTNAME/ws`.
6. Open the live NovaFPS GitHub Pages site, sign in, find **Online Multiplayer** on the Play page, paste the WSS URL, choose a room code, and click **CONNECT**.
7. Open the site in another browser/device, use the same room code, and connect. The online roster should show both names. Start a local match to publish movement/aim state; the room roster currently represents the network MVP, not final in-match player rendering.

## Next engineering milestone

Move the game simulation to the server: server-controlled movement/collision, authoritative firing/raycast hit tests, damage/health, respawn, and room match state. Then render remote players in the raycaster and replace the local CPU-only match loop with online match state. Only after that should ranked queues or anti-cheat claims be added.
