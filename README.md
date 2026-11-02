# Street Fix (Adelaide)

Snap a problem on your street. Street Fix works out who is responsible, writes the report for you, and keeps following up until it's fixed.

## What it does

1. **Photo:** take a photo. The app reads your location, and AI describes the problem.
2. **Check:** confirm the problem type, address and council. Street Fix picks the agency:
   - Streetlights go to **SA Power Networks**.
   - Potholes, signs and drains on main roads go to the **Department for Infrastructure and Transport** (hazard line 1800 018 313).
   - Everything else goes to **your council** (all 19 metro Adelaide councils are listed).
3. **Send:** add your name and email and tap **Send my report**. Street Fix emails it with your photo to the agency's published address and copies you in, so their reply comes straight to you. The first time, you confirm your email with one tap. (People can still copy the message into the agency's website themselves, and main-road reports to DIT always work that way because DIT only takes reports by phone or web form.)
4. **Follow up:** two days before each follow-up is due, Street Fix emails you "Is it fixed?" with one-tap answers. If you don't say it's fixed, it sends the next letter up the ladder by itself: a friendly reminder, then a formal complaint, then a letter to the Mayor and councillors, then a complaint to Ombudsman SA. Steps whose recipient only takes web forms (your MP for SA Power Networks or DIT, and the Energy and Water Ombudsman SA) are emailed to you ready to paste.

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
- `src/lib/geo.ts` finds the council the moment the phone shares its location, by checking the point against the official ABS 2021 local government area boundaries (`/api/place`). The street address comes from OpenStreetMap's Nominatim. If the boundary service is down, it falls back to matching council names in the address, and the person can always change the council by hand.
- Reports are saved in the browser (localStorage) of the phone that made them. Reports Street Fix sends by email are also stored on the server (Netlify Blobs, or `.data/` locally) so follow-ups can run while the phone is closed. Each has a secret key that only the person's browser and emails know.
- `src/lib/autopilot.ts` sends the report, the "Is it fixed?" check-ins and each follow-up. `netlify/functions/autopilot.mts` runs every hour and calls `/api/cron`. `src/lib/mail.ts` sends through Resend.
- Agency email addresses are each council's published general enquiries address (checked 2 November 2026), plus SA Power Networks' customer service address and Ombudsman SA.
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
3. To turn on automatic sending, also add `RESEND_API_KEY`, `MAIL_FROM` and `CRON_SECRET` (see `.env.example`). Resend needs a domain you own, verified in Resend, before it will send to councils. Without these, the app falls back to copy-and-paste sending.
4. Deploy. Every push to `main` redeploys automatically.

## Known gaps before launch

- Automatic sending uses each council's general enquiries inbox, which staff forward to the right team. That is slower than the council's own "report an issue" form, but it works for all 19 councils without a separate integration for each.
- Some councils may reply asking you to use their online form. The reply comes straight to you, and the follow-ups keep going unless you stop them.
- Council links were checked on 2 November 2026. Fourteen go straight to a "report an issue" or contact page, and five (Campbelltown, Charles Sturt, Prospect, Salisbury, Walkerville) go to the council's home page. Councils move pages often, so re-check every few months.
- The main-road question is answered by the person. A future version could look up the state road network automatically.
