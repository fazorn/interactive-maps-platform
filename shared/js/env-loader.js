/**
 * Environment Configuration Loader for Netlify
 * 
 * Handles environment variables properly for Netlify deployment.
 * Uses build-time injection for sensitive values like API keys.
 */

const EnvLoader = {
  variables: {},
  loaded: false,

  /**
   * Load configuration - works with both local development and Netlify
   */
  async load() {
    if (this.loaded) return this.variables;

    try {
      // Try to load from build-time injected config first
      if (window.ENV_CONFIG) {
        this.variables = window.ENV_CONFIG;
        this.loaded = true;
        return this.variables;
      }

      // Fallback: try to load from config endpoint (Netlify Functions)
      try {
        const response = await fetch('/.netlify/functions/config');
        if (response.ok) {
          this.variables = await response.json();
          this.loaded = true;
          return this.variables;
        }
      } catch (configError) {
        console.info('No Netlify function config available');
      }

      // Final fallback: try local .env for development
      try {
        const response = await fetch('/.env');
        if (response.ok) {
          const content = await response.text();
          this.variables = this.parse(content);
          console.info('Loaded local .env for development');
        }
      } catch (envError) {
        console.info('No .env file found - using defaults');
      }

      this.loaded = true;
      return this.variables;
    } catch (error) {
      console.warn('Could not load configuration:', error.message);
      this.loaded = true;
      return this.variables;
    }
  },

  /**
   * Parse .env content (for local development)
   */
  parse(content) {
    const vars = {};
    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        let value = valueParts.join('=').trim();
        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        vars[key.trim()] = value;
      }
    });
    return vars;
  },

  /**
   * Get environment variable
   */
  get(key, defaultValue = null) {
    return this.variables[key] || defaultValue;
  },

  /**
   * Build Google Sheets URL
   */
  buildSheetsUrl(sheetId, range) {
    const apiKey = this.get('GOOGLE_SHEETS_API_KEY');
    
    if (!apiKey || apiKey === 'your_google_sheets_api_key_here') {
      return null;
    }

    return `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
  },

  /**
   * Add the CARTO API key to a tile URL.
   */
  buildCartoTileUrl(url) {
    const separator = url.includes('?') ? '&' : '?';
    const apiKey = this.get('CARTO_API_KEY', '');
    return `${url}${separator}api=${encodeURIComponent(apiKey)}`;
  }

  /**
   * 
   */
};

// Export
window.EnvLoader = EnvLoader;
