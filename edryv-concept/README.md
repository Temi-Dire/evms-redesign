# eDryv / EVMS redesign

Redesign of https://evms-frontend.onrender.com/ in the eDryv brand (edryv.io, a Foltï company).

## Run
```
python3 -m http.server 5178
```
- `index.html` — live site. Hero + 3D car that assembles as you scroll (battery → motors → seats → wheels → body → glass → roof → lights), then drag to rotate and switch paint.
- `figma.html` — static version for Figma: the 3D scene is swapped for pre-rendered PNGs (`figma/renders/`) in three frames (hero / building / assembled).
- `?p=0..1` on index.html freezes the build at that point (used to make the renders).

## Into Figma (html.to.design)
1. Install the html.to.design Chrome extension and the html.to.design plugin in Figma.
2. Run the server above, open http://localhost:5178/figma.html in Chrome.
3. Click the extension → Import → choose Desktop (1440) and Mobile (375) → open the downloaded file with the Figma plugin (or send straight to Figma).

## Design system
- Paints as palette: Imperial Green #12574d, Oxygen White #eef2f0, Jet Black #0e1211, Lime Green #b8de5a, Storm Grey #56635f; eDryv orange #ef6420 only on primary actions.
- Type: Archivo variable — width 125% for display, 100% for body.
- Station names, bay counts and ETAs are sample data.
