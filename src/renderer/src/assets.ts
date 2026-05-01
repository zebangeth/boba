import {
  getPetAssetDefinition,
  resolvePetAppearanceId
} from "../../shared/petAppearances";
import type { PetAppearanceId, PetState } from "../../shared/types";

const warnedPlaceholders = new Set<string>();

export type PetAsset = {
  src: string;
  isPlaceholder: boolean;
};

function normalizeAssetPaths(path: string | string[]): string[] {
  return Array.isArray(path) ? path : [path];
}

export function getPetAssetVariantCount(appearanceId: PetAppearanceId, state: PetState): number {
  const resolvedAppearanceId = resolvePetAppearanceId(appearanceId);
  const asset = getPetAssetDefinition(resolvedAppearanceId, state);
  return normalizeAssetPaths(asset.path).length;
}

export function getPetAsset(
  appearanceId: PetAppearanceId,
  state: PetState,
  variantIndex = 0
): PetAsset {
  const resolvedAppearanceId = resolvePetAppearanceId(appearanceId);
  const asset = getPetAssetDefinition(resolvedAppearanceId, state);
  const paths = normalizeAssetPaths(asset.path);
  const selectedPath = paths[Math.abs(variantIndex) % paths.length];
  const warningKey = `${resolvedAppearanceId}:${state}`;

  if (asset.isPlaceholder && !warnedPlaceholders.has(warningKey)) {
    warnedPlaceholders.add(warningKey);
    console.warn(`Pawse is using a placeholder asset for ${warningKey}.`);
  }

  return {
    src: window.pawse.assetUrl(selectedPath),
    isPlaceholder: Boolean(asset.isPlaceholder)
  };
}
