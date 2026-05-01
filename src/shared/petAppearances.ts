import type { Language, PetAppearanceId, PetState } from "./types";

export type PetAssetDefinition = {
  path: string | string[];
  isPlaceholder?: boolean;
};

export type PetAppearanceManifest = {
  id: PetAppearanceId;
  label: Record<Language, string>;
  fallback: PetAssetDefinition;
  states: Partial<Record<PetState, PetAssetDefinition>>;
};

const lineDog = (state: PetState, name: string): string => `pet_assets/线条小狗/${state}/${name}`;

const STATE_FALLBACKS: Partial<Record<PetState, PetState>> = {
  breakDone: "happy",
  hydrationDone: "happy",
  focusDone: "happy"
};

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
      path: lineDog("idle", "线条小狗第9弹_甩耳朵.gif"),
      isPlaceholder: true
    },
    states: {
      idle: {
        path: [
          lineDog("idle", "线条小狗第12弹_无聊.gif"),
          lineDog("idle", "线条小狗第12弹_晃脚脚.gif"),
          lineDog("idle", "线条小狗第1弹_摆烂.gif"),
          lineDog("idle", "线条小狗第7弹_开心.gif"),
          lineDog("idle", "线条小狗第9弹_甩耳朵.gif")
        ]
      },
      sitting: {
        path: lineDog("idle", "线条小狗第12弹_晃脚脚.gif"),
        isPlaceholder: true
      },
      happy: {
        path: [
          lineDog("happy", "线条小狗第1弹_嗨.gif"),
          lineDog("happy", "线条小狗第1弹_爱你.gif"),
          lineDog("happy", "线条小狗第8弹_好耶.gif")
        ]
      },
      breakPrompt: {
        path: [
          lineDog("breakPrompt", "线条小狗第2弹_激动.gif"),
          lineDog("breakPrompt", "线条小狗第5弹_偷看.gif"),
          lineDog("breakPrompt", "线条小狗第5弹_出去玩.gif")
        ]
      },
      breakRunning: {
        path: [
          lineDog("breakRunning", "线条小狗第1弹_啦啦啦.gif"),
          lineDog("breakRunning", "线条小狗第1弹_来了.gif")
        ]
      },
      breakDone: {
        path: [
          lineDog("breakDone", "线条小狗第11弹_骄傲.gif"),
          lineDog("breakDone", "线条小狗第12弹_送你心心.gif"),
          lineDog("breakDone", "线条小狗第2弹_耶.gif")
        ]
      },
      hydrationPrompt: {
        path: lineDog("hydrationPrompt", "线条小狗第2弹_快点.gif")
      },
      drinking: {
        path: lineDog("drinking", "线条小狗第19弹_喝咖啡.gif")
      },
      hydrationDone: {
        path: lineDog("hydrationDone", "线条小狗第12弹_好棒.gif")
      },
      focusGuard: {
        path: [
          lineDog("focusGuard", "线条小狗第17弹_工作.gif"),
          lineDog("focusGuard", "线条小狗第2弹_努力.gif"),
          lineDog("focusGuard", "线条小狗第9弹_甩耳朵.gif")
        ]
      },
      focusAlert: {
        path: [
          lineDog("focusAlert", "线条小狗第15弹_惊.gif"),
          lineDog("focusAlert", "线条小狗第15弹_疑问.gif"),
          lineDog("focusAlert", "线条小狗第1弹_什么.gif"),
          lineDog("focusAlert", "线条小狗第1弹_哼.gif"),
          lineDog("focusAlert", "线条小狗第3弹_不要.gif")
        ]
      },
      focusDone: {
        path: [
          lineDog("focusDone", "线条小狗第1弹_庆祝.gif"),
          lineDog("focusDone", "线条小狗第2弹_庆祝.gif"),
          lineDog("focusDone", "线条小狗第3弹_好耶.gif")
        ]
      },
      sad: {
        path: [
          lineDog("sad", "线条小狗第13弹_大哭.gif"),
          lineDog("sad", "线条小狗第15弹_呜呜呜.gif"),
          lineDog("sad", "线条小狗第8弹_伤心.gif"),
          lineDog("sad", "线条小狗第8弹_呜呜.gif")
        ]
      },
      sleeping: {
        path: lineDog("sleeping", "线条小狗第12弹_困.gif")
      }
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
  const fallbackState = STATE_FALLBACKS[state];
  return (
    appearance.states[state] ??
    (fallbackState ? appearance.states[fallbackState] : undefined) ??
    appearance.fallback
  );
}
