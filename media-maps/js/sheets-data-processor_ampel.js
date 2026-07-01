/**
 * Google Sheets Data Processor for Media Maps 22
 *
 * Replaces the Python script workflow by directly fetching data from Google Sheets
 * and transforming it to the expected GeoJSON format with rich popup content.
 */

const SheetsDataProcessor = {
  // Cache for performance
  cache: {
    data: null,
    timestamp: null,
    duration: 5 * 60 * 1000, // 5 minutes cache
  },

  /** Sheet headers treated as latitude (WGS84, decimal degrees) */
  LAT_COLUMN_KEYS: ["Breite", "Latitude", "Lat"],

  /** Sheet headers treated as longitude (WGS84, decimal degrees) */
  LNG_COLUMN_KEYS: ["Länge", "Laenge", "Longitude", "Lng", "Lon"],

  /**
   * Fetch and process data from Google Sheets
   * @param {string} sheetId - Google Sheets ID
   * @param {string} range - Sheet range (e.g. 'Tabellenblatt1!A:M' — includes optional Breite/Länge columns)
   * @returns {Promise<Object>} Processed GeoJSON data
   */
  async fetchAndProcess(sheetId, range = "Tabellenblatt2!A:M") {
    // Check cache first
    if (this.isCacheValid()) {
      console.log("Using cached Google Sheets data");
      return this.cache.data;
    }

    try {
      console.log("Fetching fresh data from Google Sheets...");

      // Load environment variables
      await EnvLoader.load();

      // Build Google Sheets API URL
      const sheetsUrl = EnvLoader.buildSheetsUrl(sheetId, range);

//      if (!sheetsUrl) {
//        throw new Error("Google Sheets API key not configured");
//      }

//      // Fetch data from Google Sheets
//      const response = await fetch(sheetsUrl);
//
//      if (!response.ok) {
//        throw new Error(
//          `Google Sheets API error: ${response.status} ${response.statusText}`,
//        );
//      }
//
//      const data = await response.json();

      const XLSX = require("xlsx");

      const workbook = XLSX.readFile("Schaltkästen_Karte_Einbettung.xlsx");
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const data = XLSX.utils.sheet_to_json;

      if (!data.values || data.values.length < 2) {
        throw new Error("No data found in Google Sheets");
      }

      // Process the data
      const processedData = this.processSheetData(data.values);

      // Update cache
      this.cache.data = processedData;
      this.cache.timestamp = Date.now();

      console.log("Successfully processed Google Sheets data");
      return processedData;
    } catch (error) {
      console.error("Error fetching from Google Sheets:", error);
      throw error;
    }
  },

  /**
   * Check if cached data is still valid
   */
  isCacheValid() {
    return (
      this.cache.data &&
      this.cache.timestamp &&
      Date.now() - this.cache.timestamp < this.cache.duration
    );
  },

  /**
   * Clear the cache (useful for forcing refresh)
   */
  clearCache() {
    this.cache.data = null;
    this.cache.timestamp = null;
  },

  /**
   * Process raw Google Sheets data into GeoJSON format
   * @param {Array} values - Raw sheet values from Google Sheets API
   * @returns {Object} Processed data in the expected format
   */
  processSheetData(values) {
    const headers = values[0];
    const rows = values.slice(1);

    // Create the main data structure
    const data = {};

    // Process each row
    rows.forEach((row) => {
      if (!row[0]) {
        return;
      }

      const rowData = this.rowToObject(headers, row);
      const name = rowData["Name"];

      if (!name) {
        return;
      }

      const coordinates = this.parseCoordinates(rowData);
      if (!coordinates) {
        return;
      }

      // Get category from Werbeträger
      const category = rowData["Werbeträger"];
      if (!category) {
        console.warn(`No Werbeträger specified for ${rowData["Name"]}`);
        return;
      }

      // Initialize category if it doesn't exist
      if (!data[category]) {
        data[category] = {
          type: "FeatureCollection",
          features: [],
        };
      }

      // Create GeoJSON feature
      const feature = {
        type: "Feature",
        properties: {
          Name: rowData["Name"],
          popupContent: this.generatePopup(rowData),
          Category: category,
        },
        geometry: {
          type: "Point",
          coordinates: coordinates,
        },
      };

      data[category].features.push(feature);
    });

    return data;
  },

  /**
   * Build a header-keyed row object (trimmed headers for stable lookups)
   */
  rowToObject(headers, row) {
    const rowData = {};
    headers.forEach((header, index) => {
      const key = String(header ?? "").trim();
      if (key) {
        rowData[key] = row[index] ?? "";
      }
    });
    return rowData;
  },

  /**
   * Parse a single numeric coordinate from a sheet cell (supports German decimal commas)
   */
  parseCoordinateValue(value) {
    if (value === undefined || value === null || value === "") {
      return NaN;
    }
    const normalized = String(value).trim().replace(",", ".");
    return parseFloat(normalized);
  },

  /**
   * Read latitude or longitude from row using known column header aliases
   */
  getAxisValue(rowData, axis) {
    const keys = axis === "lat" ? this.LAT_COLUMN_KEYS : this.LNG_COLUMN_KEYS;
    for (const key of keys) {
      if (key in rowData && rowData[key] !== "") {
        return this.parseCoordinateValue(rowData[key]);
      }
    }
    return NaN;
  },

  /**
   * Resolve coordinates as GeoJSON [longitude, latitude].
   * Prefers separate Breite/Länge (or Lat/Lng) columns; falls back to legacy "Koordinaten".
   */
  parseCoordinates(rowData) {
    const lat = this.getAxisValue(rowData, "lat");
    const lng = this.getAxisValue(rowData, "lng");

    if (!isNaN(lat) && !isNaN(lng)) {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn(
          `Coordinates out of range for ${rowData["Name"]}: lat=${lat}, lng=${lng}`,
        );
        return null;
      }
      return [lng, lat];
    }

    const legacy = rowData["Koordinaten"];
    if (legacy) {
      return this.parseLegacyKoordinaten(legacy, rowData["Name"]);
    }

    return null;
  },

  /**
   * Parse legacy combined "Koordinaten" cell (comma-separated pair).
   * Infers lat/lng order for Berlin-area values when ambiguous.
   */
  parseLegacyKoordinaten(koordinaten, name) {
    const parts = String(koordinaten)
      .split(",")
      .map((part) => this.parseCoordinateValue(part));

    if (parts.length !== 2 || parts.some((n) => isNaN(n))) {
      console.warn(`Invalid coordinates for ${name}: ${koordinaten}`);
      return null;
    }

    const [first, second] = parts;
    const ordered = this.orderLatLngPair(first, second);

    if (!ordered) {
      console.warn(
        `Could not determine coordinate order for ${name}: ${koordinaten}`,
      );
      return null;
    }

    const [lat, lng] = ordered;
    return [lng, lat];
  },

  /**
   * Return [lat, lng] from two numbers; uses Berlin-area heuristics when needed.
   */
  orderLatLngPair(first, second) {
    const firstIsBerlinLat = first >= 51 && first <= 53;
    const firstIsBerlinLng = first >= 12 && first <= 15;
    const secondIsBerlinLat = second >= 51 && second <= 53;
    const secondIsBerlinLng = second >= 12 && second <= 15;

    if (firstIsBerlinLat && secondIsBerlinLng) {
      return [first, second];
    }
    if (firstIsBerlinLng && secondIsBerlinLat) {
      return [second, first];
    }

    // Outside Berlin: assume "lat, lng" (common copy-paste from maps)
    if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
      return [first, second];
    }

    return null;
  },

  /**
   * Generate popup HTML content (equivalent to Python generatePopup function)
   * @param {Object} row - Row data object
   * @returns {string} HTML popup content
   */
  generatePopup(row) {
    const infoSection = this.generateInfoSection(row);
    const imagesSection = this.generateImagesSection(row);

    const popupHtml = `
      <div class='location-popup'>
        <div class='popup-layout'>
          <div class='popup-info-section'>
            ${infoSection}
          </div>
          <div class='popup-images-section'>
            ${imagesSection}
          </div>
        </div>
      </div>
    `;

    // Remove extra whitespace and newlines for cleaner output
    return popupHtml.split(/\s+/).join(" ").trim();
  },

  /**
   * Generate the information section of the popup
   * @param {Object} row - Row data object
   * @returns {string} HTML info section
   */
  generateInfoSection(row) {
    const visibleColumns = [
      "Werbeträger",
      "Ort",
      "Maße",
      "Anlage-Nr.",
      "ID",
      "Buchungsintervall",
      "Vorlaufzeit",
    ];

    let infoSection = `<h3>${row["Name"]}</h3><br>`;

    visibleColumns.forEach((column) => {
      const data = row[column];
      if (data) {
        infoSection += `${column}: ${data}<br>`;
      }
    });

    infoSection += `
      <br>
      <img src='https://www.wtm-aussenwerbung.de/wp-content/uploads/wtm-aussenwerbung.webp' style='width: 10vw;'>
    `;

    return infoSection;
  },

  /**
   * Generate the images section of the popup
   * @param {Object} row - Row data object
   * @returns {string} HTML images section
   */
  generateImagesSection(row) {
    let imagesHtml = "";

    // Add custom images if they exist
    if (row["Bild1"]) {
      imagesHtml += this.generateImageHtml(row["Bild1"]);
    }
    if (row["Bild2"]) {
      imagesHtml += this.generateImageHtml(row["Bild2"]);
    }

    return imagesHtml;
  },

  /**
   * Generate HTML for a single image
   * @param {string} imageUrl - Image URL
   * @returns {string} HTML img tag
   */
  generateImageHtml(imageUrl) {
    if (!imageUrl) {
      return "";
    }
    return `<img src='${imageUrl}' style='width: 15vw; min-width: 200px;'>`;
  },
};

// Export for global access
window.SheetsDataProcessor = SheetsDataProcessor;
