export const SLOTS: readonly string[];
export const LAYERS: readonly string[];
export const BONE_SLOT: Readonly<Record<string, string>>;
export interface RigBone {
  pivot: readonly [number, number];
  sourceOrigin: readonly [number, number];
}
export function pieceRelative(
  pieceOrigin: readonly [number, number],
  bone: RigBone,
): { pivot: [number, number]; position: [number, number] };
export function coversOfBones(bones: readonly string[]): string[];
export function webpSize(bytes: Uint8Array): [number, number] | null;
export interface WardrobePieceOut {
  file: string;
  size: [number, number];
  pivot: [number, number];
  parent: string;
  bone: string;
  position: [number, number];
  rotation: number;
  drawAfter: string;
  layer: string;
  sourceOrigin: [number, number];
}
export function layerFromSpec(
  spec: unknown,
  rigParts: Record<string, RigBone>,
  readSize?: (file: string) => [number, number] | null,
): {
  id: string;
  layer: { visible: boolean; slot: string; pieces: WardrobePieceOut[] };
  copies: { from: string; to: string }[];
  covers: string[] | undefined;
};
export function formatRig(value: unknown, depth?: number): string;
