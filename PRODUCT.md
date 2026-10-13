# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Indian rail travellers** (students, families, commuters, elderly travellers) booking long-distance trains: finding a train, getting a confirmed seat, paying, and keeping the ticket.
- **The examiner** of a graded college final project, who sees it in a live 10–15 minute demo on a large classroom board screen driven by a laptop. Confirmed priority: win over both equally; it must be a believable real product that also performs on that screen.

## Product Purpose

Safarnama (सफ़रनामा, "travelogue", the story of a journey) is an improved alternative to IRCTC, India's official train-booking site. It exists to show that booking a train in India can feel modern, warm and clever instead of bureaucratic. Success: the examiner sees every IRCTC pain point answered, and the site never looks like a government website.

## Positioning

Booking is driven by real Indian Railways timetable data (datameet/railways) with simulated availability and fares, plus things IRCTC does not do: an assistant that books and pays by voice in English, Hindi or Hinglish (with a confirmation step); a one-sentence AI trip planner that builds real itineraries; a map of everywhere one direct train can reach; split tickets and one-change journeys when there is no direct seat; and which side of the train gets the sun.

## Operating Context

- Presented on a laptop connected to a large external board screen (no projector). **Desktop only, designed for 1920×1080**; no mobile optimisation is required. Everything must read from across a classroom.
- Demo focus, in order: Home and search results; voice booking with wallet payment and the confirmation card; trip planner and Explore map. E-ticket, PNR status and cancellations are shown more briefly.
- The presenter's slides pair "IRCTC problem → our fix" with screenshots of this site.
- Live at https://railnexus-umber.vercel.app (Vercel, Mumbai) with Turso; redesign work happens on the `redesign` branch and is reviewed on localhost before production.

## Capabilities and Constraints

- Next.js 16 App Router, React 19, Tailwind CSS v4, TypeScript. Leaflet maps. Razorpay test mode only.
- Features that must all survive the redesign: station search with nearby stations; results with filters, sorting, availability, confirmation chance, other dates, split tickets, one-change journeys, nearby-station suggestions; train page (timetable, route map, sun-side card); station pages; passenger form with saved passengers and live fare summary; review page with hold timer, wallet payment, UPI/card payment; payment confirmation card (opened by voice or tap; pays only on tap or the spoken phrase "confirm payment"); wallet (balance, top-ups, history); e-ticket with QR verification; PNR status; my bookings with cancellations and refunds; trip planner; Explore map; accessibility menu; language chooser; voice assistant panel.
- Terminology follows Indian Railways: PNR, CNF, RAC, WL/waitlist, Tatkal, quota, class codes (1A, 2A, 3A, SL, CC, EC, 2S), berth types.
- Station and train names stay in English in both languages, as on Indian Railways tickets.

## Brand Commitments

- Name: **Safarnama** / **सफ़रनामा** (replaces the working name RailNexus everywhere).
- Personality confirmed by the user: warm, confident, a little playful, unmistakably Indian without clichés; draw on Indian railway culture (station boards, cardboard tickets, livery, travel diaries).
- Must not resemble a government website. The previous RailNexus look is to be fully replaced.

## Evidence on Hand

- Real timetable data: about 5,200 trains and 8,900 stations with stops and coordinates (`data/rail.db`, built from datameet/railways).
- Seat availability, fares and confirmation chances are simulated; the footer says so. Do not present them as live Indian Railways data.
- No logo, photography, testimonials, user numbers or press exist. Do not invent them.

## Product Principles

1. Every IRCTC frustration gets a visible answer on the screen where it happens.
2. Money never moves without an explicit human confirmation.
3. Clarity before cleverness: availability, fares and refunds are always spelled out in words.
4. English and Hindi are equal citizens; nothing is designed for one script only.
5. Show real data honestly; label what is simulated.

## Accessibility & Inclusion

- WCAG 2.2 AA throughout, verified with axe in both languages.
- Accessibility menu: text size up to 125%, high contrast, easy-to-read font (Atkinson Hyperlegible), reduced motion. Keyboard operable, skip link, screen-reader labels, maps with text alternatives.
- Voice input must keep the Enhanced (Whisper) recognition, edit-what-was-heard and typed fallbacks: the user's own speech is sometimes misrecognised.
- Full Hindi UI with Devanagari typography; availability never conveyed by colour alone.
