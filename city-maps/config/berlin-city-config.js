/**
 * Berlin city map configuration.
 *
 * To add another city, copy this file, adjust the values below, and load it
 * from that city's HTML page. No other code changes are required.
 */

const SHEET_ID = "16j8VuT1ziwtkP-M5uuhFg7Z0AWqkxlLDTCwmdTwIEVA";
const SHEET_RANGE = "Berlin!A:F";

const BerlinCityConfig = {
  center: [52.51, 13.39],
  zoom: 11,
  minZoom: 10,
  maxZoom: 14,
  containerId: "map",

  dataSources: {
    districts: "../shared/data/geojson/berlin_districts.geojson",
    transportation: "../shared/data/geojson/berlin_routes.geojson",
    // Set at runtime by setupGoogleSheets() when an API key is configured.
    districtStats: null,
  },

  transportation: {
    routesToDisplay: [
      "U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9",
      "S41", "S5", "S9",
    ],
    // Official BVG line colors.
    routeColors: {
      S1: "#DE4DA4",
      S2: "#006F35",
      S25: "#006F35",
      S3: "#003F7F",
      S41: "#A23B1E",
      S5: "#FF6600",
      S9: "#8B1538",
      U1: "#7DAD4C",
      U2: "#DA421E",
      U3: "#16683D",
      U4: "#F0D722",
      U5: "#7E5330",
      U6: "#007734",
      U7: "#009BD5",
      U8: "#224F86",
      U9: "#F3791D",
    },
  },

  // UI text (German).
  ui: {
    cityName: "Berlin",
    title: "Berlin – Bezirke & Verkehr",
    transportToggleText: "Öffentliche Verkehrsmittel",
    zoomInstructionText: "Strg + Mausrad zum Zoomen",
    districtSelectPrompt: "Bezirk auswählen",
    districtSelectHint: "Wähle einen Bezirk auf der Karte, um Details anzuzeigen.",
    loadingText: "Lade Kartendaten...",
    errorText: "Fehler beim Laden der Daten",
    dataSource: "Datenquelle: Bezirksamt / interne Erhebung",
  },

  features: {
    showTransportation: true,
    showDistrictStats: true,
    enableScrollZoom: true,
    showDistrictInfo: true,
  },
};

/**
 * Point districtStats at Google Sheets when an API key is available.
 * Without a key the district statistics simply stay disabled.
 */
BerlinCityConfig.setupGoogleSheets = async function () {
  await EnvLoader.load();

  const url = EnvLoader.buildSheetsUrl(SHEET_ID, SHEET_RANGE);
  if (url) {
    this.dataSources.districtStats = url;
  } else {
    console.info("Google Sheets API key not configured - district stats disabled");
  }

  return url;
};

window.BerlinCityConfig = BerlinCityConfig;
