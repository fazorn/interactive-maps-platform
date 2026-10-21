/**
 * Netlify Function to serve configuration
 * 
 * This function securely provides environment variables to the client
 * using Netlify's server-side environment variables.
 */

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get environment variables from Netlify
    const config = {};
    
    // Only include API key if it exists
    if (process.env.GOOGLE_SHEETS_API_KEY) {
      config.GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    }
    if (process.env.CARTO_API_KEY) {
      config.CARTO_API_KEY = process.env.CARTO_API_KEY;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(config)
    };
  } catch (error) {
    console.error('Config function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: 'Could not load configuration'
      })
    };
  }
};
