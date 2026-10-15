/**
 * Shared Map Base Functionality
 * 
 * This module provides common map setup features used by both
 * city maps and media maps to reduce duplication.
 */

const MapBase = {
  /**
   * Create a basic Leaflet map with common configuration
   */
  createMap(config) {
    const map = L.map(config.containerId || 'map', {
      center: config.center,
      zoom: config.zoom,
      scrollWheelZoom: 'center',
      minZoom: config.minZoom,
      maxZoom: config.maxZoom
    });
    
    // Configure attribution
    map.attributionControl.setPosition('bottomleft');
    
    return map;
  },

  /**
   * Setup common map panes for proper layering
   */
  setupCommonPanes(map, options = {}) {
    const paneConfig = {
      colorFilter: 200,
      transportationPane: 202,
      districtPane: 205,
      markerPane: 600,
      ...options
    };

    Object.entries(paneConfig).forEach(([paneName, zIndex]) => {
      map.createPane(paneName);
      map.getPane(paneName).style.zIndex = zIndex;
    });
  },

  /**
   * Add a subtle color filter over the entire map
   */
  addColorFilter(map, options = {}) {
    const filterOptions = {
      color: '#000',
      weight: 0,
      fillColor: '#13538a',
      fillOpacity: 0.05,
      pane: 'colorFilter',
      ...options
    };

    const colorFilter = L.rectangle(
      [[-90, -180], [90, 180]],
      filterOptions
    );
    
    colorFilter.addTo(map);
    return colorFilter;
  },

  /**
   * Setup custom scroll wheel zoom behavior with instruction overlay
   */
  setupCustomScrollZoom(map, instructionText = 'Strg + Mausrad zum Zoomen') {
    const mapContainer = map.getContainer();
    
    // Create zoom instruction element
    const zoomInstruction = document.createElement('div');
    zoomInstruction.className = 'zoom-instruction';
    zoomInstruction.textContent = instructionText;
    mapContainer.appendChild(zoomInstruction);
    
    let instructionTimeout;
    
    // Disable default scroll wheel zoom
    map.scrollWheelZoom.disable();
    
    // Override scroll wheel behavior
    mapContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        // Zoom with Ctrl key
        e.preventDefault();
        e.stopPropagation();
        zoomInstruction.style.opacity = '0';
        
        const currentZoom = map.getZoom();
        const delta = e.deltaY > 0 ? -1 : 1;
        const newZoom = currentZoom + delta;
        
        // Check zoom limits before attempting to zoom
        const minZoom = map.getMinZoom();
        const maxZoom = map.getMaxZoom();
        
        // Only zoom if within limits
        if (newZoom >= minZoom && newZoom <= maxZoom) {
          const mousePoint = map.mouseEventToContainerPoint(e);
          const mouseLatLng = map.containerPointToLatLng(mousePoint);
          
          map.setZoomAround(mouseLatLng, newZoom);
        } else {
          // At zoom limits - provide subtle feedback
          if (newZoom < minZoom) {
            zoomInstruction.textContent = 'Maximaler Zoom erreicht';
          } else {
            zoomInstruction.textContent = 'Minimaler Zoom erreicht';
          }
          zoomInstruction.style.opacity = '1';
          
          // Clear timeout and reset text after short delay
          if (instructionTimeout) {
            clearTimeout(instructionTimeout);
          }
          
          instructionTimeout = setTimeout(() => {
            zoomInstruction.style.opacity = '0';
            zoomInstruction.textContent = instructionText; // Reset to original text
          }, 1000);
        }
      } else {
        // Show instruction when trying to scroll without Ctrl
        e.preventDefault();
        e.stopPropagation();
        zoomInstruction.style.opacity = '1';
        
        if (instructionTimeout) {
          clearTimeout(instructionTimeout);
        }
        
        instructionTimeout = setTimeout(() => {
          zoomInstruction.style.opacity = '0';
        }, 2000);
      }
    }, { passive: false });
    
    return {
      element: zoomInstruction,
      cleanup() {
        if (zoomInstruction.parentNode) {
          zoomInstruction.parentNode.removeChild(zoomInstruction);
        }
      }
    };
  },

  /**
   * Setup a base tile layer
   */
  setupBaseTileLayer(map, tileConfig = null) {
    // Default to Carto Light if no config provided
    const defaultConfig = {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      options: {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: map.options.maxZoom,
        minZoom: map.options.minZoom
      }
    };

    const config = tileConfig || defaultConfig;
    const tileUrl = config.url.includes('.basemaps.cartocdn.com')
      ? EnvLoader.buildCartoTileUrl(config.url)
      : config.url;
    const tileLayer = L.tileLayer(tileUrl, config.options);
    tileLayer.addTo(map);
    
    return tileLayer;
  },

  /**
   * Create loading indicator management
   */
  createLoadingManager(containerId = 'loading-indicator') {
    let loadingIndicator = null;

    return {
      show(message = 'Lade Daten...') {
        if (!loadingIndicator) {
          loadingIndicator = document.getElementById(containerId);
        }
        
        if (loadingIndicator) {
          const loadingText = loadingIndicator.querySelector('.loading-text');
          if (loadingText) {
            loadingText.textContent = message;
          }
          loadingIndicator.style.display = 'flex';
        }
      },

      hide() {
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }
      },

      updateMessage(message) {
        if (loadingIndicator) {
          const loadingText = loadingIndicator.querySelector('.loading-text');
          if (loadingText) {
            loadingText.textContent = message;
          }
        }
      }
    };
  },

  /**
   * Complete basic map initialization with common features
   */
  initializeBasicMap(config, options = {}) {
    const {
      enableColorFilter = false,
      enableCustomScrollZoom = true,
      enableResponsive = true,
      enableExternalEvents = true,
      customPanes = {},
      tileConfig = null
    } = options;

    // Create the map
    const map = this.createMap(config);
    
    // Setup base tile layer
    const tileLayer = this.setupBaseTileLayer(map, tileConfig);
    
    // Setup common panes
    this.setupCommonPanes(map, customPanes);
    
    // Add color filter if requested
    let colorFilter = null;
    if (enableColorFilter) {
      colorFilter = this.addColorFilter(map);
    }
    
    // Setup custom scroll zoom if requested
    let scrollZoom = null;
    if (enableCustomScrollZoom) {
      const instructionText = config.ui?.zoomInstructionText || 'Strg + Mausrad zum Zoomen';
      scrollZoom = this.setupCustomScrollZoom(map, instructionText);
    }
    
    // Setup responsive behavior
    let responsiveCleanup = null;
    if (enableResponsive) {
      responsiveCleanup = MapUtils.initResponsive(map);
    }
    
    // Setup external events
    if (enableExternalEvents) {
      MapUtils.setupExternalEvents(map);
    }
    
    // Create loading manager
    const loading = this.createLoadingManager();
    
    return {
      map,
      tileLayer,
      colorFilter,
      scrollZoom,
      loading,
      cleanup() {
        if (scrollZoom) scrollZoom.cleanup();
        if (responsiveCleanup) responsiveCleanup();
      }
    };
  }
};

// Export for use in other modules
window.MapBase = MapBase;
