import { logger } from '../utils/logger';
import { reporting } from '../telemetry';

/**
 * HTML template for debug page
 */
const DEBUG_HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Caching Service Debug</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; max-width: 1200px; margin: 0 auto; }
    h1, h2, h3 { margin-top: 1.5em; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 0.3em; }
    h2 { color: #2980b9; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { text-align: left; padding: 8px; border: 1px solid #ddd; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    pre { background-color: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; padding: 1em; overflow: auto; }
    .chart-container { width: 500px; height: 300px; margin: 1em 0; }
    .metric-card { background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 16px; margin: 8px; display: inline-block; min-width: 200px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #2980b9; }
    .metric-name { font-size: 14px; color: #7f8c8d; }
    .metrics-container { display: flex; flex-wrap: wrap; margin: 0 -8px; }
    .percent::after { content: '%'; }
    .refresh-button { background-color: #3498db; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .reset-button { background-color: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: 10px; }
  </style>
  <script>
    function formatPercent(value) {
      return (value * 100).toFixed(2);
    }
    
    function formatDuration(ms) {
      return ms.toFixed(2);
    }
    
    function refreshDebugData() {
      fetch(window.location.href)
        .then(response => response.json())
        .then(data => {
          document.getElementById('debug-json').textContent = JSON.stringify(data, null, 2);
          
          // Update metrics cards
          if (data.performanceMetrics) {
            document.getElementById('total-requests').textContent = data.performanceMetrics.totalRequests;
            document.getElementById('avg-duration').textContent = formatDuration(data.performanceMetrics.averageDuration);
            document.getElementById('cache-hit-rate').textContent = formatPercent(data.performanceMetrics.cacheHitRate);
            document.getElementById('error-rate').textContent = formatPercent(data.performanceMetrics.errorRate);
          }
          
          if (data.cacheAnalytics) {
            document.getElementById('hit-rate').textContent = formatPercent(data.cacheAnalytics.hitRate);
            document.getElementById('miss-rate').textContent = formatPercent(data.cacheAnalytics.missRate);
            document.getElementById('avg-hit-time').textContent = formatDuration(data.cacheAnalytics.averageHitTime);
            document.getElementById('avg-miss-time').textContent = formatDuration(data.cacheAnalytics.averageMissTime);
          }
          
          // Last updated timestamp
          document.getElementById('last-updated').textContent = new Date().toLocaleString();
        });
    }
    
    function resetTelemetry() {
      fetch(window.location.href + '?reset=true', { method: 'POST' })
        .then(() => {
          refreshDebugData();
          alert('Telemetry data has been reset');
        });
    }
    
    function fetchConfigStatus() {
      fetch(window.location.href + '?config=true')
        .then(response => response.json())
        .then(data => {
          // Update config status metrics
          document.getElementById('env-config-source').textContent = data.environment.source;
          document.getElementById('asset-configs-source').textContent = data.assetConfigs.source;
          document.getElementById('environment-name').textContent = data.environment.environment;
          document.getElementById('asset-config-count').textContent = data.assetConfigs.count;
          
          // Display the panel
          document.getElementById('config-status-panel').style.display = 'block';
          
          // Format based on source
          const envSourceElement = document.getElementById('env-config-source');
          const assetSourceElement = document.getElementById('asset-configs-source');
          
          if (data.environment.source === 'KV_CONFIG') {
            envSourceElement.style.color = '#27ae60'; // Green
          } else {
            envSourceElement.style.color = '#e67e22'; // Orange
          }
          
          if (data.assetConfigs.source === 'KV_CONFIG') {
            assetSourceElement.style.color = '#27ae60'; // Green
          } else {
            assetSourceElement.style.color = '#e67e22'; // Orange
          }
        });
    }
    
    // Refresh data on load
    window.onload = function() {
      refreshDebugData();
      fetchConfigStatus(); // Also load config status
      // Set up auto-refresh every 30 seconds
      setInterval(refreshDebugData, 30000);
    };
  </script>
</head>
<body>
  <h1>Caching Service Debug</h1>
  <p>Last updated: <span id="last-updated">-</span> 
     <button class="refresh-button" onclick="refreshDebugData()">Refresh Data</button>
     <button class="reset-button" onclick="resetTelemetry()">Reset Telemetry</button>
     <button class="refresh-button" onclick="fetchConfigStatus()" style="background-color: #27ae60;">Check Config Status</button>
  </p>
  
  <div id="config-status-panel" style="display: none; margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; border-left: 5px solid #2980b9;">
    <h3 style="margin-top: 0;">Configuration Status</h3>
    <div class="metrics-container">
      <div class="metric-card">
        <div class="metric-name">Environment Config</div>
        <div class="metric-value" id="env-config-source">-</div>
      </div>
      <div class="metric-card">
        <div class="metric-name">Asset Configs</div>
        <div class="metric-value" id="asset-configs-source">-</div>
      </div>
      <div class="metric-card">
        <div class="metric-name">Environment</div>
        <div class="metric-value" id="environment-name">-</div>
      </div>
      <div class="metric-card">
        <div class="metric-name">Asset Types</div>
        <div class="metric-value" id="asset-config-count">-</div>
      </div>
    </div>
    <div style="margin-top: 15px; font-size: 0.9em; color: #7f8c8d;">
      <p><strong>KV_CONFIG</strong>: Using configuration from Cloudflare KV Store<br>
      <strong>DEFAULT_CONFIG</strong>: Using built-in default configuration</p>
    </div>
  </div>
  
  <h2>Performance Overview</h2>
  <div class="metrics-container">
    <div class="metric-card">
      <div class="metric-value" id="total-requests">-</div>
      <div class="metric-name">Total Requests</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" id="avg-duration">-</div>
      <div class="metric-name">Avg Duration (ms)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value percent" id="cache-hit-rate">-</div>
      <div class="metric-name">Cache Hit Rate</div>
    </div>
    <div class="metric-card">
      <div class="metric-value percent" id="error-rate">-</div>
      <div class="metric-name">Error Rate</div>
    </div>
  </div>
  
  <h2>Cache Analytics</h2>
  <div class="metrics-container">
    <div class="metric-card">
      <div class="metric-value percent" id="hit-rate">-</div>
      <div class="metric-name">Hit Rate</div>
    </div>
    <div class="metric-card">
      <div class="metric-value percent" id="miss-rate">-</div>
      <div class="metric-name">Miss Rate</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" id="avg-hit-time">-</div>
      <div class="metric-name">Avg Hit Time (ms)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" id="avg-miss-time">-</div>
      <div class="metric-name">Avg Miss Time (ms)</div>
    </div>
  </div>
  
  <h2>Raw Telemetry Data</h2>
  <pre id="debug-json">Loading...</pre>
</body>
</html>
`;

/**
 * Service for providing debug information and tools
 */
export class DebugService {
  private static instance: DebugService;
  
  /**
   * Create a new debug service
   */
  private constructor() {
    logger.debug('DebugService initialized');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): DebugService {
    if (!DebugService.instance) {
      DebugService.instance = new DebugService();
    }
    return DebugService.instance;
  }
  
  /**
   * Handle debug requests
   * @param request The HTTP request
   * @returns Debug response
   */
  handleDebugRequest(request: Request): Response {
    const url = new URL(request.url);
    
    // Check if this is a request to reset telemetry
    if (request.method === 'POST' && url.searchParams.has('reset')) {
      reporting.resetAll();
      return new Response(JSON.stringify({ status: 'ok', message: 'Telemetry reset' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if this is a request for the debug UI
    const acceptHeader = request.headers.get('Accept') || '';
    if (acceptHeader.includes('text/html')) {
      return new Response(DEBUG_HTML_TEMPLATE, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Check if this is a request for configuration status
    if (url.searchParams.has('config')) {
      // Import the ConfigService only when needed to avoid circular dependencies
      const { ConfigService } = require('../services/config-service');
      const configService = new ConfigService();
      
      // Get configuration source information
      const configStatus = {
        timestamp: new Date().toISOString(),
        environment: {
          source: configService.isUsingKvEnvironmentConfig() ? 'KV_CONFIG' : 'DEFAULT_CONFIG',
          lastUpdated: configService.getEnvironmentConfigLastUpdated(),
          environment: configService.getEnvironmentConfig().environment
        },
        assetConfigs: {
          source: configService.isUsingKvAssetConfigs() ? 'KV_CONFIG' : 'DEFAULT_CONFIG',
          lastUpdated: configService.getAssetConfigsLastUpdated(),
          count: configService.getAssetConfigCount()
        }
      };
      
      return new Response(JSON.stringify(configStatus, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Default: return JSON telemetry data
    const report = reporting.generateReport({
      includePerformance: true,
      includeCacheAnalytics: true,
      detailedBreakdown: true
    });
    
    // Add config source information 
    try {
      const { ConfigService } = require('../services/config-service');
      const configService = new ConfigService();
      
      // Add to report as extra data (not part of the CompleteTelemetryReport type)
      (report as any).configStatus = {
        environmentConfigSource: configService.isUsingKvEnvironmentConfig() ? 'KV_CONFIG' : 'DEFAULT_CONFIG',
        assetConfigsSource: configService.isUsingKvAssetConfigs() ? 'KV_CONFIG' : 'DEFAULT_CONFIG'
      };
    } catch (error) {
      // Add to report as extra data
      (report as any).configStatus = {
        error: 'Could not determine configuration source'
      };
    }
    
    return new Response(JSON.stringify(report, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  /**
   * Add debug information to a response
   * @param response Original response
   * @returns Response with debug headers
   */
  addDebugInfo(response: Response): Response {
    const headers = new Headers(response.headers);
    
    // Generate a summary report
    const report = reporting.generateReport({
      includePerformance: true,
      includeCacheAnalytics: true,
      detailedBreakdown: false
    });
    
    // Add basic debug headers
    headers.set('X-Cache-Debug-HitRate', (report.cacheAnalytics?.hitRate || 0).toString());
    headers.set('X-Cache-Debug-RequestCount', (report.performanceMetrics?.totalRequests || 0).toString());
    headers.set('X-Cache-Debug-AvgDuration', (report.performanceMetrics?.averageDuration || 0).toString());
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
}