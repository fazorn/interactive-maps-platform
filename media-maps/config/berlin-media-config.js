/**
 * Berlin media locations map configuration.
 *
 * The media map is Berlin-only, so this config stays deliberately small.
 * Advertising categories, marker and cluster styling live next to the map
 * logic in media-maps/berlin.html.
 */

const BerlinMediaConfig = {
  map: {
    center: [52.51, 13.39],
    zoom: 11,
    minZoom: 10,
    maxZoom: 19,
    containerId: "map",
  },

  dataSources: {
    mediaLocations: {
      // Primary source: live Google Sheet (requires an API key).
      googleSheets: {
        sheetId: "1ltHBwFfhnMvTEh1qzpZ6WFvMKBG9Q1v0358kyKSrLcg",
        range: "Tabellenblatt1!A:M",
      },
      // Used when the Google Sheet is unavailable.
      fallback: "../shared/data/geojson/standort_daten.json",
    },
    districts: "../shared/data/geojson/berlin_districts.geojson",
  },

  // Advertising displays per district. Recalculated from the loaded
  // locations at runtime; starts empty.
  districtStatistics: {},

  // UI text (German).
  ui: {
    title: "Berlin Medienstandorte",
    loadingText: "Lade Medienstandorte...",
    errorText: "Fehler beim Laden der Medienstandorte",
    noDataText: "Keine Medienstandorte gefunden",
    districtSelectPrompt: "Bezirk auswählen",
    zoomInstructionText: "Strg + Mausrad zum Zoomen",
  },

  features: {
    showDistrictSelection: true,
    enableScrollZoom: true,
    showLoadingIndicator: true,
    showPopups: true,
  },
};

BerlinMediaConfig.getDistrictStatistic = function (districtName) {
  return this.districtStatistics[districtName] || 0;
};

window.BerlinMediaConfig = BerlinMediaConfig;
