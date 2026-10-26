export const ART_PATTERN: RegExp;
export const hashBytes: (bytes: Uint8Array) => string;
export function buildAssetManifest(
  publicDir: string,
  exclude?: readonly string[],
): { version: string; files: { path: string; size: number; hash: string }[] };
export function fileRevision(publicDir: string, path: string): string;
