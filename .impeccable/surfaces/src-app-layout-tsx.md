---
version: 1
slug: "src-app-layout-tsx"
primary_target: "src/app/layout.tsx"
related_targets: ["src/app/page.tsx","src/components"]
---

Scope: the whole Safarnama web app (shared shell, home, search results, booking, review/payment, wallet, trip planner, explorer, train/station pages, tickets, account). Mode: Operate (home leans Persuade for the first impression). Desktop only, 1920×1080 on a classroom board screen.

Audience and job: Indian rail travellers booking trains, and an examiner watching a 10–15 minute demo. Demo path: home and results, voice booking with wallet confirmation, planner and Explore.

User revisions (2026-10-14, binding): brand blue #04056F and yellow #FCB831; a deeper, taller header bar with rounded lower corners that blends into the page; a muted non-grey ground; no green behind wallet money; rounder, smoother, more premium overall; non-squarish fonts with a contrasting sans for headings (user suggested Montserrat; Poppins chosen because it also covers Devanagari).

## Direction contract

THESIS: Indian Railways' enamel signs, refined into a premium interface: royal-blue and marigold plates with bilingual lettering, the coach destination board as the recurring signature. It refuses the generic blue-header travel-app grid and truck-art ornament.

OWN-WORLD: Royal blue #04056F and marigold #FCB831 at full strength; night blue #020240 for the header (gradient into royal blue) and footer; white plates with soft 12px corners on an "indigo mist" ground #EEF0FA; ink #10122B. Money and wallet in royal blue with marigold figures; green only as status text; vermilion #C4321D only for alerts, waitlists and cancellations. Poppins (600–700) for headings, numbers, boards and labels; Inter for reading text, Hind for Devanagari. Painted controls: indigo checkboxes with marigold ticks, drawn chevrons and calendar marks.

STORY: The visitor sees a station-sign world that is unmistakably Indian rail and modern, finds a train in one search, reads availability in words, and trusts the confirmation plate before money moves.

FIRST VIEWPORT: Rounded night-blue header melting into a full-width royal-blue board: "Safarnama" in marigold Poppins Bold with सफ़रनामा beside it and a one-line promise, a marigold meaning plate on the right; the white search plate hangs across the board's lower edge with a marigold Search button. Below, a marigold "Plan a trip in one sentence" plate beside a royal-blue "Where can I go?" plate with a real dot map; popular routes as coach destination boards.

FORM: Railway Enamel Signs (user-steered from Painted Signboard, list position 7 roll; user pinned, then refined by the user's palette and type revisions), seed key 908a41ed. Signature: coach destination boards (marigold plate, train number, name, FROM → TO) heading every train, ticket, plan and payment; motion: plates settle in once with a short drop.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
