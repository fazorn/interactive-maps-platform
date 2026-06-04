# Interactive Maps

Static [Leaflet](https://leafletjs.com/) maps for Berlin, deployed on Netlify.
There are two maps:

- **City map** – Berlin districts and public transport routes, with per-district
  statistics. Built so additional cities can be added later (see
  [Adding a city](#adding-a-city)).
- **Media map** – advertising / media locations across Berlin. This map is
  Berlin-only for the foreseeable future and is intentionally kept simple.

There is no build step: HTML, CSS, JavaScript, and GeoJSON are served as-is.

## Project structure

```
index.html              Landing page linking to both maps
city-maps/
  berlin.html           Berlin city map page
  config/               Per-city config (one file per city)
  css/                  City-map-specific styles
  js/map-core.js        InteractiveMap class (the city map)
media-maps/
  berlin.html           Berlin media map (page + logic in one file)
  config/               Berlin media config
  css/                  Media-map-specific styles
  js/                   Google Sheets -> GeoJSON processing
shared/
  css/                  base.css, components.css, map-common.css
  js/                   map-base.js, map-utils.js, env-loader.js
  data/geojson/         District, route, and location data
netlify/functions/      config.js (exposes the Sheets API key at runtime)
netlify.toml            Deploy config and clean URLs
```

Why the two maps differ: the city map is config-driven (a class plus one config
file per city) because it should grow to more cities. The media map is a single
self-contained page because it only ever needs to serve Berlin.

## Running locally

```bash
npm run dev       # serves the site at http://localhost:3000
```

(`npm run dev` just runs `npx serve .` — any static file server works.)

## Deploying

Connect the repository to Netlify. The settings in `netlify.toml` are picked up
automatically:

- Publish directory: `.`
- No build command (static files)

Live URLs:

- `/` – landing page
- `/city-maps/berlin` – Berlin city map
- `/media-maps/berlin` – Berlin media map

## Configuration & data

Each map reads from GeoJSON in `shared/data/geojson/` and, optionally, from a
Google Sheet:

- **District boundaries** – `berlin_districts.geojson`
- **Transport routes** – `berlin_routes.geojson`
- **Media locations** – the media map fetches a live Google Sheet and falls
  back to `standort_daten.json` if the Sheet is unavailable.

### Google Sheets API key

District statistics (city map) and live media locations (media map) need a
Google Sheets API key. **Never commit the key.**

- **Production:** set `GOOGLE_SHEETS_API_KEY` in the Netlify UI
  (Site settings → Environment variables). `netlify/functions/config.js` exposes
  it to the browser at runtime.
- **Local development:** create a `.env` file (already git-ignored) with:

  ```
  GOOGLE_SHEETS_API_KEY=your_key_here
  ```

Without a key, both maps still work — they just skip the live data and use the
GeoJSON files / disable statistics.

## Adding a city

The city map is the only map designed to be extended. To add, e.g., Hamburg:

1. Copy the Berlin config and adjust center, zoom, data sources, routes, and
   German UI text:

   ```bash
   cp city-maps/config/berlin-city-config.js city-maps/config/hamburg-city-config.js
   ```

2. Copy `city-maps/berlin.html` to `city-maps/hamburg.html` and point the config
   `<script>` tag at the new file.

3. Add the district / route GeoJSON to `shared/data/geojson/`.

4. Add a redirect in `netlify.toml`:

   ```toml
   [[redirects]]
     from = "/city-maps/hamburg"
     to = "/city-maps/hamburg.html"
     status = 200
   ```

5. Link the new map from `index.html`.

No changes to `map-core.js` are needed — a city is just a config plus its data.

## Troubleshooting

- Map doesn't load → check the browser console and that the GeoJSON URLs resolve.
- No statistics / live data → the API key is probably missing (see above).
- Deploy issues → check the Netlify deploy log.
