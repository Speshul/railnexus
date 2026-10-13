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

## Creative features

- **Plan a trip in one sentence** (`/plan`): "Weekend in Goa from Pune for 2, under ₹4000, leave Friday evening" becomes
  ready-to-book itineraries there and back, labelled best price / fastest / most likely confirmed. Vague wishes work too
  ("somewhere in the hills from Delhi for 3 days"): the AI suggests destinations, and only those with real trains are shown.
  The AI (Gemini, hedged with Groq) only reads the request. Trains, fares and availability come from the timetable and booking engine,
  and the dates are calculated in code. A return trip books as one checkout ("Going" / "Coming back"). The voice assistant can launch it
  ("Pune se Goa weekend trip plan karo").
- **Where can I go?** (`/explore`): every place one direct train reaches from your station, on a map coloured by journey
  time, filterable by hours, fare per person, station size and overnight trains, with a "Surprise me" button and a full
  table for screen readers. Built entirely from the timetable (`src/lib/explore.ts`).
- **Which side gets the sun?** (train page and booking review): for the chosen journey and date, the route is walked in
  5-minute steps, comparing the train's heading with the sun's position (`src/lib/sun.ts`, standard solar formulas).
  It says which side to sit on for shade, when sunrise or sunset happens and on which side, and draws a left/right timeline.

## Accessibility

Targets WCAG 2.2 AA; every main page passes an automated axe-core audit with zero violations, including with all
display settings switched on.

- **Accessibility menu** in the header (remembered per browser, applied before first paint): text size up to 125%,
  high contrast, an easy-to-read font (Atkinson Hyperlegible) and reduced motion (also automatic when the device asks).
- **Keyboard**: skip-to-content link, clear focus outlines, arrow-key station suggestions, Escape closes menus and
  the voice panel; no auto-focus that skips past the header.
- **Screen readers**: landmarks, current page announced in the nav, live results count, labelled controls, table
  captions and text descriptions for maps.
- **Contrast**: brand orange darkened to #c2410c and secondary grey to #5a6a82 so text is at least 4.5:1 on every
  surface. Availability is always written out, never shown by colour alone.
- **Hindi (हिंदी)**: the whole interface is translated; first-time visitors are asked to pick English or Hindi
  (like IRCTC), and a header button switches at any time. Station and train names stay in English, as on real
  tickets. Hindi pages also pass axe, use a Devanagari font (Noto Sans Devanagari) and set `<html lang="hi">`.
  The voice assistant defaults to Hindi speech when the site is in Hindi.
- Statement page at `/accessibility`.

### How translation works

- `src/i18n/en.ts` holds every English string; `src/i18n/hi.ts` is typed against it, so a missing Hindi string fails
  the build. Strings use `{name}` placeholders, and plurals use `key.one` / `key.other`.
- The `lang` cookie stores the choice (`src/app/actions/locale.ts`). Server components call `getT()`, client
  components call `useT()`.
- Server logic (validation, cancellation rules, availability notes) returns message keys rather than sentences, and
  the page translates them. Dates and durations are formatted with `hi-IN` when the site is in Hindi.

## Payments, tickets and cancellations (Phase 3)

- **Razorpay test mode checkout** (real Razorpay popup, no real money): the server creates the order from the held seats,
  then verifies the payment signature *and* re-checks amount and status with Razorpay before issuing tickets.
  Test with UPI `success@razorpay` (or `failure@razorpay`) or card `4100 2800 0000 1007`.
- On payment each passenger gets a queue position, which becomes a **confirmed berth** (`CNF/B3/34/LB`), **RAC** or
  **waitlist** number. Berths keep groups together, honour preferences and give seniors a lower berth. Each train
  gets a **10-digit PNR**.
- **Connecting journeys in one checkout**: both trains, one payment, two PNRs.
- **E-ticket** page (print / save as PDF) with a **signed QR code**; scanning it opens `/verify/<PNR>`, which says
  whether the ticket is genuine and still valid. **PNR status** page (`/pnr`) for anyone with the PNR.
- **My Bookings** with Upcoming / Completed / Awaiting payment / Cancelled tabs.
- **Partial or full cancellation** with IRCTC-style charges (flat fee >48 h, 25% within 48 h, 50% within 12 h, nothing
  after chart preparation; ₹60 clerkage for RAC/WL), refunded through Razorpay's refund API. Seats go back on sale.
- If seats run out while someone is paying, the payment is **refunded automatically**.
- **Split tickets**: seat inventory is tracked per section of the route, as on real trains. When a full journey is
  waitlisted but both halves have seats, results offer a split ticket on the same train (change seats once), with
  the extra cost shown; both pieces are booked and paid together. Berths are only "taken" where journeys overlap.
- **Carbon badge**: CO₂ saved vs flying the same distance, on results and e-tickets.
- Optional `MAKE_WEBHOOK_URL`: every issued ticket is POSTed there as JSON, so a Make.com scenario can email it.

Keys (in `.env.local`): `RAZORPAY_KEY_ID` (must be `rzp_test_...`) and `RAZORPAY_KEY_SECRET`.

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
src/i18n/*               English/Hindi dictionaries and translation helpers
src/lib/planner.ts       AI trip planner: request parsing (lib/ai.ts) + itinerary search
src/lib/explore.ts       direct-train reachability from a station
src/lib/sun.ts           sun position and which-side-gets-the-sun analysis
```

Every page's state lives in the URL (`/search?from=NDLS&to=HWH&date=...`), and search is exposed as a JSON API. The Phase 2 voice assistant will drive the site through these.

## Data: real vs simulated

| Real (datameet/railways, CC0) | Derived / simulated |
|---|---|
| 5,184 trains, numbers, names, types | Running days (source has none; daily for most, from name hints like "Weekly") |
| 8,990 stations with GPS coordinates | Per-stop distance (great-circle, scaled to official train distance) |
| 415k stop records with timings | Untimed stops interpolated from distance |
| Train classes | Fares (modelled on IR's fare structure) and seat availability (deterministic per train/date/class) |

About 2% of trains (91, mostly Durontos) have no halts marked in the source data (every row has arrival = departure).
Their stops are inferred from how often other trains halt at each station; checked against trains that do mark
halts, this matches real halts about 75% of the time. These train pages say the stop list is estimated.

The source data dates from around 2016, so some newer trains (e.g. Vande Bharat) and renumberings are missing.

## Roadmap

1. ~~Search, routes, booking up to checkout~~ (done)
2. ~~Voice booking and navigation~~ (done)
3. ~~Razorpay test-mode payment, PNR generation, berth allocation, e-ticket, cancellation and refunds~~ (done)
4. Visual design pass
