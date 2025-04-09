declare module 'config-manager' {
  export function parseArgs(): {
    command: string;
    namespaceId: string;
    configFile: string;
    outputFile: string;
    env: string;
    dryRun: boolean;
    skipValidation: boolean;
  };

  export function printHelp(): void;
  export function loadConfig(filePath: string): Record<string, any>;
  export function validateConfig(config: Record<string, any>): boolean;
  export function listKeys(namespaceId: string): { name: string; metadata: any }[];
  export function getValue(namespaceId: string, key: string): any;
  export function putKvValue(namespaceId: string, key: string, value: any, metadata: any, dryRun: boolean): void;
  export function handleUpload(args: any): Promise<void>;
  export function handleDownload(args: any): Promise<void>;
  export function handleList(args: any): Promise<void>;
  export function main(): Promise<void>;
}