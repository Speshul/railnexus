# RailNexus: an improved IRCTC-style train booking site

Final-year college project. Search Indian Railways trains, explore every route and stop on a map, and book tickets up to checkout.

## Run it

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`, no native modules or cloud database).

```bash
npm install
npm run dev
```

Open http://localhost:3000. On first run `predev` downloads the open dataset and builds `data/rail.db` (about 2 seconds).

**Demo login:** `demo` / `demo1234` (seeded automatically, with two saved passengers).

Rebuild the train database (stop the dev server first on Windows, since it locks the file):

```bash
npm run data
```

## Voice assistant (Phase 2)

Tap the orange mic button (bottom right, every page) and speak in English, Hindi or Hinglish:

- "Kal Pune se Delhi sleeper" / "trains from Mumbai to Lucknow on Friday in 3AC"
- "Sabse sasti wali 3A mein book karo" / "book the Rajdhani in 2A" / "fastest train dikhao" / "agle din"
- On the passenger page: "Asha aur Demo Traveller ko add karo", "insurance nahi chahiye", "aage badho"
- "Meri bookings dikhao", "12951 ka route dikhao", "help"

It can search, choose trains and fill passenger details. It can never pay; that is always the user's click.

**How it works:** browser speech recognition (Chrome/Edge, `en-IN` or `hi-IN`) turns speech into text. A language model
turns the text into a structured intent (`src/lib/voice/llm.ts`). The site resolves that against its own data, such as
station names to codes or "cheapest" to a train (`src/lib/voice/resolve.ts`). The page then performs one of a fixed set
of actions (`src/components/voice/`). Providers: Google Gemini first, Groq as backup, and an offline rule parser
(`src/lib/voice/rules.ts`) if neither is available, so voice keeps working with no keys or no quota.

**Setup:** put your keys in `.env.local` in the project folder (template included, never committed), then restart:

```
GEMINI_API_KEY=...   # free at https://aistudio.google.com
GROQ_API_KEY=...     # optional backup + speech-to-text for Firefox/Safari, free at https://console.groq.com
```

## What works (Phase 1)

- **Search** between any two of ~8,000 stations by name, code, old or new names (e.g. "CSMT", "Prayagraj", "Bengaluru"), with an optional *include nearby stations (30 km)* toggle.
- **Results** with filters (class, train type, departure/arrival windows, boarding station, confirmed-only), sorting, a ±3-day date strip, per-class fare and live availability.
- **6-day availability calendar** per class, with **confirmation chance** for waitlisted tickets.
- **Connecting journeys** (one change, 45 min to 10 h layover) when direct trains are scarce.
- **Train pages**: full timetable (halts plus stations it passes without stopping), route map, running days, fare table, return train.
- **Station pages**: departure board filtered by date, map, nearby stations.
- **Accounts**: register, login, saved passengers ("master list"), booking history.
- **Booking**: passenger details with IRCTC rules (quota limits, Ladies and Senior quota eligibility, child no-berth half fare, infants free, at least one passenger 12+), berth and meal preferences, insurance, auto-upgrade, "book only if confirmed".
- **Review/checkout**: fare breakdown, 15-minute seat hold with countdown. Held seats reduce availability for everyone.

## Architecture

```
scripts/build-data.mjs   raw JSON -> data/rail.db (stations, trains, stops)
src/lib/db.ts            SQLite connections: rail.db (read-only reference) + app.db (users, sessions, bookings)
src/lib/rail.ts          station/train search, route segments, nearby stations, connecting journeys
src/lib/fare.ts          fare engine (client-safe, also used for live totals in the form)
src/lib/availability.ts  simulated seat inventory + confirmation probability
src/lib/booking.ts       validation rules, seat holds, booking records
src/lib/search.ts        search service shared by pages and the JSON API
src/app/api/*            JSON endpoints: stations, trains, search, availability
```

Every page's state lives in the URL (`/search?from=NDLS&to=HWH&date=...`), and search is exposed as a JSON API. The Phase 2 voice assistant will drive the site through these.

## Data: real vs simulated

| Real (datameet/railways, CC0) | Derived / simulated |
|---|---|
| 5,184 trains, numbers, names, types | Running days (source has none; daily for most, from name hints like "Weekly") |
| 8,990 stations with GPS coordinates | Per-stop distance (great-circle, scaled to official train distance) |
| 415k stop records with timings | Untimed stops interpolated from distance |
| Train classes | Fares (modelled on IR's fare structure) and seat availability (deterministic per train/date/class) |

The source data dates from around 2016, so some newer trains (e.g. Vande Bharat) and renumberings are missing.

## Roadmap

1. ~~Search, routes, booking up to checkout~~ (done)
2. ~~Voice booking and navigation~~ (done)
3. Razorpay test-mode payment, PNR generation, berth allocation, e-ticket, cancellation and refunds
4. Visual design pass
