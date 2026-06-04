/**
 * City map (districts + public transport).
 *
 * A single config object describes one city, so adding another city means
 * writing a new config file (see city-maps/config/) rather than new code.
 */

class InteractiveMap {
  constructor(config) {
    this.config = {
      containerId: 'map',
      center: [52.51, 13.39],
      zoom: 11,
      minZoom: 10,
      maxZoom: 14,
      scrollWheelZoom: 'center',

      dataSources: {
        districts: null,
        transportation: null,
        districtStats: null
      },

      transportation: {
        routesToDisplay: [],
        routeColors: {}
      },

      ui: {
        cityName: 'City',
        title: 'Interactive Map',
        transportToggleText: 'Transportation',
        zoomInstructionText: 'Ctrl + Mouse Wheel to Zoom',
        districtSelectPrompt: 'Select District',
        districtSelectHint: 'Choose a district on the map to view details.',
        loadingText: 'Loading map data...',
        errorText: 'Error loading data',
        dataSource: 'Data source: Local government'
      },

      features: {
        showTransportation: false,
        showDistrictStats: false,
        enableScrollZoom: true,
        showDistrictInfo: true
      },

      ...config
    };
    
    this.map = null;
    this.layers = {
      districts: null,
      transportation: null,
      markers: null
    };
    
    this.controls = {
      districtInfo: null
    };
    
    this.state = {
      isTransportationVisible: false,
      currentDistrict: null
    };
    
    this.init();
  }

  /**
   * Build the Leaflet map and shared controls via MapBase.
   */
  init() {
    const mapSetup = MapBase.initializeBasicMap(this.config, {
      enableColorFilter: true,
      enableCustomScrollZoom: this.config.features.enableScrollZoom,
      enableResponsive: true,
      enableExternalEvents: true,
      customPanes: {
        transportationPane: 202,
        districtPane: 205,
        markerPane: 600
      }
    });

    this.map = mapSetup.map;
    this.baseSetup = mapSetup;

    if (this.config.features.showDistrictInfo) {
      this.setupDistrictInfoControl();
    }
  }


  /**
   * Set up the district information control panel
   */
  setupDistrictInfoControl() {
    const districtInfoControl = L.control();
    districtInfoControl._visible = false;
    
    // Control methods
    districtInfoControl.open = function() {
      if (!this._div) return;
      this._div.classList.remove('is-hidden');
      this._visible = true;
    };
    
    districtInfoControl.close = function() {
      if (!this._div) return;
      this._div.classList.add('is-hidden');
      this._visible = false;
    };
    
    districtInfoControl.toggle = function() {
      if (this._visible) this.close();
      else this.open();
    };
    
    districtInfoControl.onAdd = function(map) {
      this._div = L.DomUtil.create('div', 'info is-hidden');
      L.DomEvent.disableClickPropagation(this._div);
      this.update();
      return this._div;
    };
    
    districtInfoControl.update = function(districtProperties = null) {
      if (!this._els) {
        this._createElements();
      }
      
      const id = districtProperties?.cartodb_id;
      const statsById = window.statsById;
      
      if (!statsById || !id || !statsById[id]) {
        this._showEmptyState();
        return;
      }
      
      const { name = '', area, population, adCount, notes } = statsById[id];
      this._updateContent(name, area, population, adCount, notes);
    };
    
    districtInfoControl._createElements = function() {
      const root = this._div;
      const panel = L.DomUtil.create('section', 'district-panel', root);
      panel.id = 'district-info';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', 'district-title');
      panel.setAttribute('lang', 'de');
      panel.setAttribute('aria-live', 'polite');
      
      // Header
      const header = L.DomUtil.create('header', 'district-panel__header', panel);
      const titleEl = L.DomUtil.create('h2', 'district-panel__title', header);
      titleEl.id = 'district-title';
      
      // Body
      const body = L.DomUtil.create('div', 'district-panel__body', panel);
      const meta = L.DomUtil.create('div', 'district-panel__meta', body);
      const notesSection = L.DomUtil.create('section', 'district-panel__notes', body);
      notesSection.setAttribute('aria-label', 'Hinweise');
      const notesP = L.DomUtil.create('p', '', notesSection);
      
      // Footer
      const footer = L.DomUtil.create('footer', 'district-panel__footer', panel);
      const small = L.DomUtil.create('small', 'source', footer);
      small.textContent = this._mapConfig.ui.dataSource;
      const logo = L.DomUtil.create('img', 'logo', footer);
      logo.src = 'https://wtm-aussenwerbung-berlin.de/wp-content/uploads/2024/01/wtm-logo-neu.png';
      logo.alt = 'WTM Logo';
      
      // Cache references
      this._els = { titleEl, meta, notesP };
    };
    
    districtInfoControl._showEmptyState = function() {
      this._els.titleEl.textContent = this._mapConfig.ui.districtSelectPrompt;
      this._els.meta.replaceChildren();
      this._els.notesP.textContent = this._mapConfig.ui.districtSelectHint;
    };
    
    districtInfoControl._updateContent = function(name, area, population, adCount, notes) {
      const cityName = this._mapConfig.ui.cityName || 'City';
      this._els.titleEl.textContent = name ? `${cityName} – ${name}` : this._mapConfig.ui.districtSelectPrompt;
      
      // Create chips
      const chipsFrag = document.createDocumentFragment();
      const fmtInt = new Intl.NumberFormat('de-DE');
      const fmtArea = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
      
      if (Number.isFinite(area)) {
        const areaStr = `${fmtArea.format(area)} km²`;
        chipsFrag.appendChild(this._createChip('Fläche:', areaStr));
      }
      
      if (Number.isFinite(population)) {
        chipsFrag.appendChild(this._createChip('Einwohner:', fmtInt.format(population)));
      }
      
      if (Number.isFinite(adCount)) {
        chipsFrag.appendChild(this._createChip('Werbeträger:', fmtInt.format(adCount)));
      }
      
      this._els.meta.replaceChildren(chipsFrag);
      
      // Notes
      this._els.notesP.textContent = name ? (notes ?? '') : this._mapConfig.ui.districtSelectHint;
    };
    
    districtInfoControl._createChip = function(label, valueStr) {
      const span = L.DomUtil.create('span', 'chip');
      const title = L.DomUtil.create('div', 'chipTitle', span);
      title.textContent = label;
      const content = L.DomUtil.create('div', 'chipContent', span);
      content.textContent = valueStr ?? '—';
      return span;
    };
    
    // Pass the map config to the control for access to UI text
    districtInfoControl._mapConfig = this.config;
    
    districtInfoControl.addTo(this.map);
    this.controls.districtInfo = districtInfoControl;
  }

  /**
   * Load and display district boundaries
   */
  async loadDistrictBoundaries(geoJsonUrl) {
    try {
      const response = await fetch(geoJsonUrl);
      const geoJsonData = await response.json();
      
      this.layers.districts = this.createDistrictLayer(geoJsonData);
      this.layers.districts.addTo(this.map);
      
      return this.layers.districts;
    } catch (error) {
      console.error('Error loading district data:', error);
      throw error;
    }
  }

  /**
   * Create district layer with styling and interactions
   */
  createDistrictLayer(geoJsonData) {
    return new L.geoJSON(geoJsonData, {
      style: () => ({
        color: '#13538a',
        opacity: 1,
        fillOpacity: 0,
        weight: 2,
        dashArray: '10',
      }),
      pane: 'districtPane',
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => this.highlightDistrict(e),
          mouseout: (e) => this.resetDistrictHighlight(e),
          click: (e) => this.zoomToDistrict(e),
        });
        
        layer.bindTooltip(
          () => feature.properties.name,
          {
            permanent: true,
            direction: 'center',
            className: 'district-label',
          }
        );
      },
    });
  }

  /**
   * Load and display transportation routes
   */
  async loadTransportationRoutes(geoJsonUrl, routesToDisplay = []) {
    try {
      const response = await fetch(geoJsonUrl);
      const geoJsonData = await response.json();
      
      // Filter routes if specified
      if (routesToDisplay.length > 0) {
        geoJsonData.features = geoJsonData.features.filter(feat => 
          routesToDisplay.includes(feat.properties.route_name)
        );
      }
      
      this.layers.transportation = this.createTransportationLayer(geoJsonData);
      
      return this.layers.transportation;
    } catch (error) {
      console.error('Error loading transportation data:', error);
      throw error;
    }
  }

  /**
   * Create transportation layer with route styling
   */
  createTransportationLayer(geoJsonData) {
    return new L.geoJSON(geoJsonData, {
      style: (feature) => ({
        color: this.getTransportationColor(feature.properties.route_name),
        opacity: 0.6,
        fillOpacity: 0,
        weight: 2,
      }),
      pane: 'transportationPane',
    });
  }

  /**
   * Get the configured color for a transport route.
   */
  getTransportationColor(routeName) {
    return this.config.transportation.routeColors[routeName] || '#000000';
  }

  /**
   * Set up transportation toggle functionality
   */
  setupTransportationToggle(buttonId = 'transportToggle') {
    const toggleButton = document.getElementById(buttonId);
    if (!toggleButton) return;
    
    // Prevent map interactions on the button
    L.DomEvent.disableClickPropagation(toggleButton);
    
    L.DomEvent.on(toggleButton, 'click', (e) => {
      L.DomEvent.stop(e);
      this.toggleTransportation();
    });
    
    L.DomEvent.on(toggleButton, 'dblclick', (e) => {
      L.DomEvent.stop(e);
    });
  }

  /**
   * Toggle transportation layer visibility
   */
  toggleTransportation() {
    if (!this.layers.transportation || !this.layers.districts) return;
    
    const toggleButton = document.getElementById('transportToggle');
    
    if (this.state.isTransportationVisible) {
      // Hide transportation layer
      this.map.removeLayer(this.layers.transportation);
      this.layers.districts.setStyle({ opacity: 1 });
      
      if (toggleButton) {
        L.DomUtil.removeClass(toggleButton, 'active');
      }
      
      this.state.isTransportationVisible = false;
    } else {
      // Show transportation layer
      this.map.addLayer(this.layers.transportation);
      this.layers.districts.setStyle({ opacity: 0.2 });
      
      if (toggleButton) {
        L.DomUtil.addClass(toggleButton, 'active');
      }
      
      this.state.isTransportationVisible = true;
    }
  }

  /**
   * Highlight district on hover
   */
  highlightDistrict(event) {
    const layer = event.target;
    layer.setStyle({
      weight: 5,
      color: '#13538a',
      dashArray: '',
      fillOpacity: 0.4,
    });
    
    this.controls.districtInfo.update(layer.feature.properties);
    this.controls.districtInfo.open();
    
    layer.bringToFront();
  }

  /**
   * Reset district highlight
   */
  resetDistrictHighlight(event) {
    event.target.setStyle({
      opacity: this.state.isTransportationVisible ? 0.2 : 1,
      fillOpacity: 0,
      weight: 2,
      dashArray: '10',
    });
    
    this.controls.districtInfo.close();
  }

  /**
   * Zoom to district bounds
   */
  zoomToDistrict(event) {
    this.map.fitBounds(event.target.getBounds());
    this.controls.districtInfo.open();
  }

  /**
   * Load district statistics from external source
   */
  async loadDistrictStats(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const [headers, ...rows] = data.values;
      const colIndex = Object.fromEntries(
        headers.map((h, i) => [h.trim().toLowerCase(), i])
      );
      
      const statsById = Object.create(null);
      for (const row of rows) {
        const id = row[colIndex['cartodb_id']];
        if (!id) continue;
        
        statsById[id] = {
          name: row[colIndex['name']],
          population: Number(row[colIndex['population']] || 0),
          area: Number(row[colIndex['area']] || 0),
          adCount: Number(row[colIndex['adcount']] || 0),
          notes: row[colIndex['notes']] || '',
        };
      }
      
      window.statsById = statsById;
      return statsById;
    } catch (error) {
      console.error('Error loading district stats:', error);
      throw error;
    }
  }

  /**
   * Get the map instance
   */
  getMap() {
    return this.map;
  }

  /**
   * Load every data source declared in the config.
   */
  async initializeWithData(showLoadingCallback = null, hideLoadingCallback = null) {
    try {
      // Load district statistics if configured and feature is enabled
      if (this.config.features.showDistrictStats && this.config.dataSources.districtStats) {
        if (showLoadingCallback) showLoadingCallback('Loading district statistics...');
        await this.loadDistrictStats(this.config.dataSources.districtStats);
      }

      // Load district boundaries if configured
      if (this.config.dataSources.districts) {
        if (showLoadingCallback) showLoadingCallback('Loading district boundaries...');
        await this.loadDistrictBoundaries(this.config.dataSources.districts);
      }

      // Load transportation routes if configured and feature is enabled
      if (this.config.features.showTransportation && this.config.dataSources.transportation) {
        if (showLoadingCallback) showLoadingCallback('Loading transportation data...');
        await this.loadTransportationRoutes(
          this.config.dataSources.transportation,
          this.config.transportation.routesToDisplay
        );

        // Setup transportation toggle
        this.setupTransportationToggle('transportToggle');
      }

      if (hideLoadingCallback) hideLoadingCallback();
      return true;
    } catch (error) {
      console.error('Failed to initialize map with data:', error);
      if (hideLoadingCallback) hideLoadingCallback();
      throw error;
    }
  }
}

window.InteractiveMap = InteractiveMap;
