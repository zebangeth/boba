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

export function getPetAsset(appearanceId: PetAppearanceId, state: PetState): PetAsset {
  const resolvedAppearanceId = resolvePetAppearanceId(appearanceId);
  const asset = getPetAssetDefinition(resolvedAppearanceId, state);
  const warningKey = `${resolvedAppearanceId}:${state}`;

  if (asset.isPlaceholder && !warnedPlaceholders.has(warningKey)) {
    warnedPlaceholders.add(warningKey);
    console.warn(`Pawse is using a placeholder asset for ${warningKey}.`);
  }

  return {
    src: window.pawse.assetUrl(asset.path),
    isPlaceholder: Boolean(asset.isPlaceholder)
  };
}
