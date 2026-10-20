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
- Reports are saved to `data/reports.json`. That's fine for one person, but a real launch needs a database and user accounts.

## Known gaps before launch

- Sending is semi-automatic: the person copies the message into the agency's form. Most councils don't offer a public API, so direct filing would need one integration per council.
- Check-in reminders only show inside the app. Push or email reminders are the next step.
- Council websites in `agencies.ts` should be checked, and each one linked straight to its "report an issue" page.
- The main-road question is answered by the person. A future version could look up the state road network automatically.
