import type { Language, PetAppearanceId, PetState } from "./types";

export type PetAssetDefinition = {
  path: string;
  isPlaceholder?: boolean;
};

export type PetAppearanceManifest = {
  id: PetAppearanceId;
  label: Record<Language, string>;
  fallback: PetAssetDefinition;
  states: Partial<Record<PetState, PetAssetDefinition>>;
};

const lineDog = (name: string): string => `线条小狗表情包全集/${name}`;

export const PET_APPEARANCES: Record<PetAppearanceId, PetAppearanceManifest> = {
  lovartPuppy: {
    id: "lovartPuppy",
    label: {
      "zh-CN": "Lovart 小狗",
      en: "Lovart Puppy"
    },
    fallback: {
      path: "lovart_footage/puppy/standing pose.gif",
      isPlaceholder: true
    },
    states: {
      idle: { path: "lovart_footage/puppy/standing pose.gif" },
      sitting: { path: "lovart_footage/puppy/3 - welcome to work.gif" },
      happy: { path: "lovart_footage/puppy/1 - waiting for playing outside.gif" },
      breakPrompt: { path: "lovart_footage/puppy/1 - waiting for playing outside.gif" },
      breakRunning: { path: "lovart_footage/puppy/1 - playing outside.gif" },
      hydrationPrompt: { path: "lovart_footage/water_gifs/want_water.gif" },
      drinking: { path: "lovart_footage/water_gifs/got_water.gif" },
      focusGuard: { path: "lovart_footage/puppy/standing pose4.gif" },
      focusAlert: { path: "lovart_footage/puppy/standing pose4.gif", isPlaceholder: true },
      sad: { path: "lovart_footage/puppy/4 - sleeping.gif", isPlaceholder: true },
      sleeping: { path: "lovart_footage/puppy/4 - sleeping.gif", isPlaceholder: true }
    }
  },
  lineDog: {
    id: "lineDog",
    label: {
      "zh-CN": "线条小狗",
      en: "Line Dog"
    },
    fallback: {
      path: lineDog("线条小狗第2弹_好.gif"),
      isPlaceholder: true
    },
    states: {
      idle: { path: lineDog("线条小狗第8弹_无聊.gif") },
      sitting: { path: lineDog("线条小狗第11弹_趴趴.gif"), isPlaceholder: true },
      happy: { path: lineDog("线条小狗第3弹_开心.gif") },
      breakPrompt: { path: lineDog("线条小狗第12弹_醒醒.gif"), isPlaceholder: true },
      breakRunning: { path: lineDog("线条小狗第12弹_爬行.gif"), isPlaceholder: true },
      hydrationPrompt: { path: lineDog("线条小狗第19弹_喝咖啡.gif"), isPlaceholder: true },
      drinking: { path: lineDog("线条小狗第16弹_吃饭.gif"), isPlaceholder: true },
      focusGuard: { path: lineDog("线条小狗第17弹_工作.gif") },
      focusAlert: { path: lineDog("线条小狗第12弹_醒醒.gif"), isPlaceholder: true },
      sad: { path: lineDog("线条小狗第20弹_难过.gif") },
      sleeping: { path: lineDog("线条小狗第10弹_睡觉.gif") }
    }
  }
};

export function resolvePetAppearanceId(value: unknown): PetAppearanceId {
  return value === "lineDog" ? "lineDog" : "lovartPuppy";
}

export function petAppearanceOptions(language: Language): Array<{ value: PetAppearanceId; label: string }> {
  return Object.values(PET_APPEARANCES).map((appearance) => ({
    value: appearance.id,
    label: appearance.label[language]
  }));
}

export function getPetAssetDefinition(
  appearanceId: PetAppearanceId,
  state: PetState
): PetAssetDefinition {
  const appearance = PET_APPEARANCES[appearanceId];
  return appearance.states[state] ?? appearance.fallback;
}
