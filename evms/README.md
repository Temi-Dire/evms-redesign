# EVMS redesign (Foltï Charge)

Redesign of https://evms-frontend.onrender.com/ (public landing + login; Stations/Vehicles/Fleet are behind auth).

## Run
```
python3 -m http.server 5180
```
- `index.html` — landing. Hero with a 3D DC fast charger that assembles on scroll (plinth → power modules → cabinet → fascia → screen → tap reader → light ring → holster → cable → connector), paints its parking bay, then turns green and can be dragged to rotate.
- `login.html` — sign-in page.
- `figma.html` — static version for Figma import (3D swapped for PNGs in `figma/renders/`: hero, building, assembled; desktop + mobile).
- `index.html?p=0..1` freezes the build; `window.__evms.capture()` returns a PNG of the canvas.

## Into Figma (html.to.design)
1. Install the html.to.design Chrome extension + Figma plugin.
2. Run the server, open http://localhost:5180/figma.html (and /login.html) in Chrome.
3. Import at Desktop 1440 and Mobile 375.

## System
- Concept: the charging bay. Asphalt #1d2023, concrete #e3e5e1, paper #f5f6f3, ink #16181b, road-marking yellow #f5c518 (accent), green #38c977 only for "free/healthy".
- Type: Barlow Condensed (display) + Barlow (body), a family based on highway signage.
- Brand: the live site uses "ChargePoint" (a real company's name), so the redesign uses "Foltï Charge" as a placeholder.
- Station names, counts, plates and dashboard numbers are sample data.
