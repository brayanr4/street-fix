# Street Fix (Adelaide)

Snap a problem on your street. Street Fix works out who is responsible, writes the report for you, and keeps following up until it's fixed.

## What it does

1. **Photo:** take a photo. The app reads your location, and AI describes the problem.
2. **Check:** confirm the problem type, address and council. Street Fix picks the agency:
   - Streetlights go to **SA Power Networks**.
   - Potholes, signs and drains on main roads go to the **Department for Infrastructure and Transport** (hazard line 1800 018 313).
   - Everything else goes to **your council** (all 19 metro Adelaide councils are listed).
3. **Send:** copy the ready-made message, open the agency's page and paste it in.
4. **Track:** when a deadline passes, the report is flagged. If it isn't fixed, Street Fix writes the next letter up the ladder: a friendly reminder, then a formal complaint, then a letter to your councillor or MP, then a complaint to the ombudsman (Ombudsman SA, or the Energy and Water Ombudsman SA for SA Power Networks).

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add your Anthropic API key
npm run dev
```

Then open http://localhost:3000. To try it on your phone, open `http://<your-computer's-IP>:3000` on the same Wi-Fi.

Without an API key the app still works. You just type the description yourself, and letters come from built-in templates.

## How it's built

- Next.js 16 (App Router) and Tailwind. Everything is in one page, designed for phones first.
- `src/lib/agencies.ts` holds the Adelaide routing rules and the escalation ladder.
- `src/lib/ai.ts` handles the photo description and letter writing (Claude, with template fallbacks).
- `src/lib/geo.ts` turns GPS into an address and council using OpenStreetMap's Nominatim.
- Reports are saved in the browser (localStorage) of the phone that made them. Nobody else can see your photos or locations, and the server needs no database. The catch: clearing browser data or switching phones loses them. Accounts and a database come later.
- `src/lib/rateLimit.ts` caps AI requests per visitor (30 per 10 minutes by default, set `STREET_FIX_RATE_LIMIT` to change) so a public site can't run up your API bill.

## Tests

```bash
npm run lint        # code style
npm run typecheck   # TypeScript
npm test            # unit tests: routing, follow-up logic, letters, rate limit
npm run test:e2e    # phone-sized browser tests, including an accessibility scan
```

The browser tests need Chromium (`npx playwright install chromium` once). GitHub Actions runs all four on every push.

## Deploy to Netlify

1. In Netlify choose **Add new site → Import an existing project**, pick GitHub and select this repository. Netlify detects Next.js and uses the settings in `netlify.toml`.
2. Under **Site configuration → Environment variables**, add `ANTHROPIC_API_KEY` (optional, but needed for AI photo descriptions and letters).
3. Deploy. Every push to `main` redeploys automatically.

## Known gaps before launch

- Sending is semi-automatic: the person copies the message into the agency's form. Most councils don't offer a public API, so direct filing would need one integration per council.
- Check-in reminders only show inside the app. Push or email reminders are the next step.
- Council links were checked on 2 November 2026. Fourteen go straight to a "report an issue" or contact page, and five (Campbelltown, Charles Sturt, Prospect, Salisbury, Walkerville) go to the council's home page. Councils move pages often, so re-check every few months.
- The main-road question is answered by the person. A future version could look up the state road network automatically.
