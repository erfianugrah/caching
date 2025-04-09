#!/usr/bin/env node

/**
 * Configuration Manager for Caching Service
 * 
 * A unified tool for managing KV-based configuration for the Caching Service.
 * This utility allows uploading, downloading, and listing configuration data
 * in the Cloudflare Workers KV store.
 * 
 * Features:
 * - Upload configuration from a JSON file to KV
 * - Download configuration from KV to a JSON file
 * - List KV keys without downloading content
 * - Environment-specific configuration handling
 * - Support for dry run mode
 * - Zod schema validation before uploading
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { z } from 'zod';

// Configuration
const __dirname = process.cwd();
const CONFIG_FILE = path.resolve(__dirname, './config.json');
const OUTPUT_FILE = path.resolve(__dirname, './config-downloaded.json');
const DEFAULT_NAMESPACE_ID = 'a51cb6eeb7684f45a73173ec75e3f14e'; // CACHE_CONFIGURATION_STORE

// Command types as constants
const COMMAND_UPLOAD = 'upload';
const COMMAND_DOWNLOAD = 'download';
const COMMAND_LIST = 'list';
type CommandType = typeof COMMAND_UPLOAD | typeof COMMAND_DOWNLOAD | typeof COMMAND_LIST;

// Interface for command line arguments
interface CommandLineArgs {
  command: CommandType;
  namespaceId: string;
  configFile: string;
  outputFile: string;
  env: string;
  dryRun: boolean;
  skipValidation: boolean;
}

/**
 * Zod schemas for configuration validation 
 * Imported from the main codebase schemas
 */

// Basic schemas
const ttlConfigSchema = z.object({
  ok: z.number().int().nonnegative(),
  redirects: z.number().int().nonnegative(),
  clientError: z.number().int().nonnegative(),
  serverError: z.number().int().nonnegative(),
  info: z.number().int().nonnegative().optional(),
}).catchall(z.number().int().nonnegative().optional());

const queryParamConfigSchema = z.object({
  include: z.boolean(),
  includeParams: z.array(z.string()).optional(),
  excludeParams: z.array(z.string()).optional(),
  sortParams: z.boolean().optional(),
  normalizeValues: z.boolean().optional(),
});

const variantConfigSchema = z.object({
  headers: z.array(z.string()).optional(),
  cookies: z.array(z.string()).optional(),
  clientHints: z.array(z.string()).optional(),
  useAcceptHeader: z.boolean().optional(),
  useUserAgent: z.boolean().optional(),
  useClientIP: z.boolean().optional(),
});

const cacheDirectivesConfigSchema = z.object({
  private: z.boolean().optional(),
  staleWhileRevalidate: z.number().int().nonnegative().optional(),
  staleIfError: z.number().int().nonnegative().optional(),
  mustRevalidate: z.boolean().optional(),
  noCache: z.boolean().optional(),
  noStore: z.boolean().optional(),
  immutable: z.boolean().optional(),
});

// Asset configuration schema
const assetConfigSchema = z.object({
  regexPattern: z.string(),
  useQueryInCacheKey: z.boolean(),
  queryParams: queryParamConfigSchema.optional(),
  variants: variantConfigSchema.optional(),
  ttl: ttlConfigSchema,
  imageOptimization: z.boolean().optional(),
  minifyCss: z.boolean().optional(),
  cacheDirectives: cacheDirectivesConfigSchema.optional(),
  preventCacheControlOverride: z.boolean().optional(),
});

// Asset configuration map schema
const assetConfigMapSchema = z.record(z.string(), assetConfigSchema);

// Logging configuration schema
const loggingConfigSchema = z.object({
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  includeDebugInfo: z.boolean().default(false),
  sampleRate: z.number().min(0).max(1).default(1),
  redactSensitiveInfo: z.boolean().default(true),
  performanceMetrics: z.boolean().default(true),
  alwaysLogPaths: z.array(z.string()).default([]),
  neverLogPaths: z.array(z.string()).default([]),
});

// Environment configuration schema
const environmentConfigSchema = z.object({
  environment: z.string().default('development'),
  logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  debugMode: z.boolean().default(false),
  maxCacheTags: z.number().int().positive().default(10),
  cacheTagNamespace: z.string().default('cf'),
  version: z.string().default('dev'),
  configKvNamespace: z.string().optional(),
  configRefreshInterval: z.number().int().positive().default(300),
  logging: loggingConfigSchema.optional(),
});

// Complete configuration schema
const configSchema = z.object({
  'environment-config': environmentConfigSchema,
  'asset-configs': assetConfigMapSchema
});

/**
 * Parse command line arguments
 */
function parseArgs(): CommandLineArgs {
  const args: CommandLineArgs = {
    command: COMMAND_LIST, // Default command
    namespaceId: DEFAULT_NAMESPACE_ID,
    configFile: CONFIG_FILE,
    outputFile: OUTPUT_FILE,
    env: 'dev',
    dryRun: false,
    skipValidation: false
  };

  // Determine command from first argument
  if (process.argv.length > 2) {
    const cmdArg = process.argv[2].toLowerCase();
    if (cmdArg === 'upload' || cmdArg === 'up') {
      args.command = COMMAND_UPLOAD;
    } else if (cmdArg === 'download' || cmdArg === 'down') {
      args.command = COMMAND_DOWNLOAD;
    } else if (cmdArg === 'list' || cmdArg === 'ls') {
      args.command = COMMAND_LIST;
    }
  }

  // Process remaining command line arguments
  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg === '--namespace-id' && i + 1 < process.argv.length) {
      args.namespaceId = process.argv[++i];
    } else if (arg === '--config-file' && i + 1 < process.argv.length) {
      args.configFile = path.resolve(process.argv[++i]);
    } else if (arg === '--output-file' && i + 1 < process.argv.length) {
      args.outputFile = path.resolve(process.argv[++i]);
    } else if (arg === '--env' && i + 1 < process.argv.length) {
      args.env = process.argv[++i];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--skip-validation') {
      args.skipValidation = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
Configuration Manager for Caching Service

Usage: 
  ts-node config-manager.ts <command> [options]

Commands:
  upload    Upload configuration from file to KV store
  download  Download configuration from KV store to file
  list      List keys in the KV store without downloading

Options:
  --namespace-id <id>   KV namespace ID (default: ${DEFAULT_NAMESPACE_ID})
  --config-file <path>  Path to config file for upload (default: ../config.json)
  --output-file <path>  Path to output file for download (default: ../config-downloaded.json)
  --env <environment>   Environment to use (default: dev)
  --dry-run             Print commands without executing them (upload only)
  --skip-validation     Skip Zod schema validation before upload
  --help, -h            Show this help message

Examples:
  ts-node config-manager.ts upload --env production
  ts-node config-manager.ts download --output-file ./my-config.json
  ts-node config-manager.ts list
  `);
}

/**
 * Load configuration from file
 */
function loadConfig(filePath: string): Record<string, any> {
  try {
    console.log(`Loading configuration from ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error loading config file: ${error}`);
    process.exit(1);
  }
}

/**
 * Validate configuration against schema
 */
function validateConfig(config: Record<string, any>): boolean {
  try {
    console.log('Validating configuration against schema...');
    const result = configSchema.safeParse(config);
    
    if (!result.success) {
      console.error('Configuration validation failed:');
      console.error(result.error.format());
      return false;
    }
    
    console.log('Configuration validation successful');
    return true;
  } catch (error) {
    console.error('Error during configuration validation:', error);
    return false;
  }
}

/**
 * List keys in the KV namespace
 */
function listKeys(namespaceId: string): { name: string; metadata: any }[] {
  try {
    const command = `wrangler kv key list --namespace-id ${namespaceId} --remote`;
    console.log(`Listing keys in namespace: ${namespaceId} (remote)`);
    
    const output = execSync(command, { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (error) {
    console.error('Error listing keys:', error);
    return [];
  }
}

/**
 * Get a value from KV namespace
 */
function getValue(namespaceId: string, key: string): any {
  try {
    const command = `wrangler kv key get --namespace-id ${namespaceId} --remote ${key}`;
    console.log(`Fetching value for key: ${key} (remote)`);
    
    const output = execSync(command, { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (error) {
    console.error(`Error getting value for key ${key}:`, error);
    return null;
  }
}

/**
 * Execute wrangler command to put a KV value
 */
function putKvValue(namespaceId: string, key: string, value: any, metadata: any, dryRun: boolean): void {
  const valueString = JSON.stringify(value);
  const metadataString = JSON.stringify(metadata);
  
  const command = `wrangler kv key put --namespace-id ${namespaceId} ${key} '${valueString}' --metadata '${metadataString}' --remote`;
  
  console.log(`Uploading config for key: ${key} (remote)`);
  
  if (dryRun) {
    console.log(`[DRY RUN] Would execute: ${command}`);
    return;
  }
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`Successfully uploaded ${key} configuration`);
  } catch (error) {
    console.error(`Error uploading ${key} configuration:`, error);
    process.exit(1);
  }
}

/**
 * Handle the upload command
 */
async function handleUpload(args: CommandLineArgs): Promise<void> {
  console.log('Configuration Uploader for Caching Service');
  console.log('------------------------------------------');
  console.log(`Using namespace ID: ${args.namespaceId}`);
  console.log(`Using config file: ${args.configFile}`);
  console.log(`Environment: ${args.env}`);
  if (args.dryRun) {
    console.log('DRY RUN MODE: Commands will be printed but not executed');
  }
  if (args.skipValidation) {
    console.log('WARNING: Schema validation is skipped!');
  }
  console.log('------------------------------------------');
  
  // Load configuration
  const config = loadConfig(args.configFile);
  
  // Validate configuration if not skipped
  if (!args.skipValidation) {
    const isValid = validateConfig(config);
    if (!isValid) {
      console.error('Configuration validation failed. Aborting upload.');
      console.error('Use --skip-validation to bypass validation if needed.');
      process.exit(1);
    }
  }
  
  // Current timestamp for metadata
  const timestamp = new Date().toISOString();
  
  // Check for required configuration sections
  const hasEnvironmentConfig = 'environment-config' in config;
  const hasAssetConfigs = 'asset-configs' in config;
  
  if (!hasEnvironmentConfig || !hasAssetConfigs) {
    console.log('\n⚠️  Warning: Configuration is incomplete:');
    if (!hasEnvironmentConfig) console.log('   - Missing environment-config section');
    if (!hasAssetConfigs) console.log('   - Missing asset-configs section');
    
    if (!args.dryRun) {
      console.log('\nProceeding with upload of available configuration...');
    }
  }

  // Process each configuration section
  for (const [key, value] of Object.entries(config)) {
    const metadata = {
      configVersion: "1.0.0",
      description: `${key} configuration settings`,
      lastUpdated: timestamp,
      updatedBy: process.env.USER || 'config-manager',
      environment: args.env,
      source: 'config-manager.ts'
    };
    
    putKvValue(args.namespaceId, key, value, metadata, args.dryRun);
  }
  
  console.log('------------------------------------------');
  console.log(`Configuration upload ${args.dryRun ? 'simulation' : 'completion'} summary:`);
  console.log(`- Environment: ${args.env}`);
  console.log(`- Keys processed: ${Object.keys(config).length}`);
  
  // Provide information about what the service will use
  if (!hasEnvironmentConfig || !hasAssetConfigs) {
    console.log('\n⚠️  Service will use default values for missing configuration');
  } else {
    console.log('\n✅ Complete configuration uploaded');
  }
}

/**
 * Handle the download command
 */
async function handleDownload(args: CommandLineArgs): Promise<void> {
  console.log('Configuration Downloader for Caching Service');
  console.log('------------------------------------------');
  console.log(`Using namespace ID: ${args.namespaceId}`);
  console.log(`Output file: ${args.outputFile}`);
  console.log(`Environment: ${args.env}`);
  console.log('------------------------------------------');
  
  // List keys in the namespace
  const keyEntries = listKeys(args.namespaceId);
  
  if (keyEntries.length === 0) {
    console.log('No keys found in the namespace');
    return;
  }
  
  console.log(`Found ${keyEntries.length} keys:`);
  keyEntries.forEach(entry => {
    const envInfo = entry.metadata?.environment ? ` (${entry.metadata.environment})` : '';
    console.log(`- ${entry.name}${envInfo}`);
  });
  
  // Download each key's value
  const config: Record<string, any> = {};
  
  for (const entry of keyEntries) {
    const value = getValue(args.namespaceId, entry.name);
    if (value !== null) {
      config[entry.name] = value;
    }
  }
  
  // Add information about default values if any essential configuration is missing
  const hasEnvironmentConfig = 'environment-config' in config;
  const hasAssetConfigs = 'asset-configs' in config;
  
  if (!hasEnvironmentConfig || !hasAssetConfigs) {
    console.log('\n⚠️  Warning: Some configuration is missing from KV store');
    
    // Add metadata to indicate default values
    config._metadata = {
      downloadDate: new Date().toISOString(),
      source: 'KV with gaps',
      missing: [],
      defaultsUsed: true
    };
    
    if (!hasEnvironmentConfig) {
      console.log('   - environment-config: Not found in KV (service will use defaults)');
      config._metadata.missing.push('environment-config');
    }
    
    if (!hasAssetConfigs) {
      console.log('   - asset-configs: Not found in KV (service will use defaults)');
      config._metadata.missing.push('asset-configs');
    }
  } else {
    // Add metadata with source information
    config._metadata = {
      downloadDate: new Date().toISOString(),
      source: 'KV store',
      complete: true,
      environment: args.env
    };
  }
  
  // Save to output file
  try {
    fs.writeFileSync(args.outputFile, JSON.stringify(config, null, 2));
    console.log(`Configuration saved to ${args.outputFile}`);
  } catch (error) {
    console.error('Error saving configuration:', error);
    process.exit(1);
  }
  
  console.log('------------------------------------------');
  console.log('Configuration download complete!');
  
  // Provide additional guidance
  if (!hasEnvironmentConfig || !hasAssetConfigs) {
    console.log('\nℹ️  To upload complete configuration:');
    console.log('   1. Update config.json with all required configuration');
    console.log('   2. Run: npm run config:upload');
  }
}

/**
 * Handle the list command
 */
async function handleList(args: CommandLineArgs): Promise<void> {
  console.log('Configuration Manager - Listing KV Keys');
  console.log('------------------------------------------');
  console.log(`Using namespace ID: ${args.namespaceId}`);
  console.log(`Environment: ${args.env}`);
  console.log('------------------------------------------');
  
  // List keys in the namespace
  const keyEntries = listKeys(args.namespaceId);
  
  if (keyEntries.length === 0) {
    console.log('No keys found in the namespace');
    return;
  }
  
  console.log(`Found ${keyEntries.length} keys:`);
  
  // Display in table format
  console.log('┌───────────────────────┬──────────────┬─────────────────────────┬────────┐');
  console.log('│ Key                   │ Environment  │ Last Updated            │ Source │');
  console.log('├───────────────────────┼──────────────┼─────────────────────────┼────────┤');
  
  keyEntries.forEach(entry => {
    const key = entry.name.padEnd(22).slice(0, 22);
    const env = (entry.metadata?.environment || 'unknown').padEnd(11).slice(0, 11);
    const updated = (entry.metadata?.lastUpdated || 'unknown').padEnd(24).slice(0, 24);
    // Always "KV" for explicitly listed keys
    console.log(`│ ${key} │ ${env} │ ${updated} │ KV     │`);
  });
  
  console.log('└───────────────────────┴──────────────┴─────────────────────────┴────────┘');
  
  // Indicate if using defaults (no KV keys found)
  if (keyEntries.length === 0) {
    console.log('\n⚠️  No keys found in KV store. Service will use default configurations.');
  } else {
    // Check for both required config keys
    const hasEnvironmentConfig = keyEntries.some(entry => entry.name === 'environment-config');
    const hasAssetConfigs = keyEntries.some(entry => entry.name === 'asset-configs');
    
    if (!hasEnvironmentConfig || !hasAssetConfigs) {
      console.log('\n⚠️  Missing required configuration keys:');
      if (!hasEnvironmentConfig) console.log('   - environment-config: Default environment settings will be used');
      if (!hasAssetConfigs) console.log('   - asset-configs: Default asset configurations will be used');
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  // Parse command line arguments
  const args = parseArgs();
  
  // Handle the command
  switch (args.command) {
    case COMMAND_UPLOAD:
      await handleUpload(args);
      break;
    case COMMAND_DOWNLOAD:
      await handleDownload(args);
      break;
    case COMMAND_LIST:
      await handleList(args);
      break;
    default:
      console.error('Unknown command');
      printHelp();
      process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});