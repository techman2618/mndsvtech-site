# Mound Hopper global leaderboard (Cloudflare Workers + D1, free tier)
One-time setup (Chad signs in once):
1. `cd leaderboard-worker && npx wrangler login`  (browser sign-in / free Cloudflare signup)
2. `npx wrangler d1 create mound-hopper`  -> paste database_id into wrangler.toml
3. `npx wrangler d1 execute mound-hopper --remote --file schema.sql`
4. `npx wrangler deploy`  -> prints https://mound-hopper-scores.<subdomain>.workers.dev
5. Put that URL in games/mound-hopper.html `<meta name="mh-api" content="...">` and games.html `const API="..."`, merge branch to main, push.
Endpoints: POST /start -> {run}; POST /score {name,score,run}; GET /top.
