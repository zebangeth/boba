import type { Language, PetAppearanceId, PetState } from "./types";

export type PetAssetDefinition = {
  path: string | string[];
  isPlaceholder?: boolean;
  replayIntervalMs?: number;
};

export type PetAppearanceManifest = {
  id: PetAppearanceId;
  label: Record<Language, string>;
  fallback: PetAssetDefinition;
  states: Partial<Record<PetState, PetAssetDefinition>>;
};

const goldenPuppy = (state: PetState, name: string): string =>
  `pet_assets/金毛 puppy/${state}/${name}`;
const lineDog = (state: PetState, name: string): string => `pet_assets/线条小狗/${state}/${name}`;
const xiaoJiMao = (state: PetState, name: string): string => `pet_assets/小鸡毛/${state}/${name}`;

const STATE_FALLBACKS: Partial<Record<PetState, PetState>> = {
  breakDone: "happy",
  hydrationDone: "happy",
  focusDone: "happy"
};

export const PET_APPEARANCES: Record<PetAppearanceId, PetAppearanceManifest> = {
  lovartPuppy: {
    id: "lovartPuppy",
    label: {
      "zh-CN": "金毛 puppy (beta)",
      en: "Golden Puppy (beta)"
    },
    fallback: {
      path: goldenPuppy("idle", "standing pose.gif"),
      isPlaceholder: true
    },
    states: {
      idle: {
        path: [
          goldenPuppy("idle", "standing pose.gif"),
          goldenPuppy("idle", "standing pose2.gif"),
          goldenPuppy("idle", "standing pose3.gif")
        ]
      },
      sitting: { path: goldenPuppy("sitting", "3 - welcome to work.gif") },
      happy: {
        path: [
          goldenPuppy("happy", "1 - waiting for playing outside.gif"),
          goldenPuppy("happy", "3 - welcome to work.gif")
        ]
      },
      breakPrompt: { path: goldenPuppy("breakPrompt", "1 - waiting for playing outside.gif") },
      breakRunning: {
        path: goldenPuppy("breakRunning", "1 - playing outside.gif"),
        replayIntervalMs: 4500
      },
      hydrationPrompt: { path: goldenPuppy("hydrationPrompt", "want_water.gif") },
      drinking: { path: goldenPuppy("drinking", "got_water.gif") },
      focusGuard: { path: goldenPuppy("focusGuard", "standing pose4.gif") },
      focusAlert: { path: goldenPuppy("focusAlert", "2 - standing reminder.gif") },
      sad: { path: goldenPuppy("sad", "4 - sleeping.gif"), isPlaceholder: true },
      sleeping: { path: goldenPuppy("sleeping", "4 - sleeping.gif"), isPlaceholder: true }
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
  },
  xiaoJiMao: {
    id: "xiaoJiMao",
    label: {
      "zh-CN": "小鸡毛",
      en: "Xiao Ji Mao"
    },
    fallback: {
      path: xiaoJiMao("idle", "线条小狗第6弹_放松.gif"),
      isPlaceholder: true
    },
    states: {
      idle: {
        path: [
          xiaoJiMao("idle", "线条小狗第11弹_转圈.gif"),
          xiaoJiMao("idle", "线条小狗第6弹_放松.gif"),
          xiaoJiMao("idle", "线条小狗第6弹_晃脚脚.gif")
        ]
      },
      sitting: {
        path: xiaoJiMao("idle", "线条小狗第6弹_晃脚脚.gif"),
        isPlaceholder: true
      },
      happy: {
        path: [
          xiaoJiMao("happy", "线条小狗第20弹_开心.gif"),
          xiaoJiMao("happy", "线条小狗第6弹_开心.gif")
        ]
      },
      breakPrompt: {
        path: [
          xiaoJiMao("breakPrompt", "线条小狗第10弹_在.gif"),
          xiaoJiMao("breakPrompt", "线条小狗第10弹_摇尾巴.gif"),
          xiaoJiMao("breakPrompt", "线条小狗第9弹_甩.gif")
        ]
      },
      breakRunning: {
        path: [
          xiaoJiMao("breakRunning", "线条小狗第14弹_摇摆.gif"),
          xiaoJiMao("breakRunning", "线条小狗第8弹_贴贴.gif"),
          xiaoJiMao("breakRunning", "线条小狗第9弹_加油.gif")
        ]
      },
      breakDone: {
        path: [
          xiaoJiMao("breakDone", "线条小狗第18弹_爱你.gif"),
          xiaoJiMao("breakDone", "线条小狗第6弹_拍手.gif"),
          xiaoJiMao("breakDone", "线条小狗第7弹_爱你.gif")
        ]
      },
      hydrationPrompt: {
        path: xiaoJiMao("hydrationPrompt", "线条小狗第11弹_吃手手.gif")
      },
      drinking: {
        path: xiaoJiMao("drinking", "线条小狗第20弹_喝咖啡.gif")
      },
      hydrationDone: {
        path: [
          xiaoJiMao("hydrationDone", "很棒.gif"),
          xiaoJiMao("hydrationDone", "线条小狗第8弹_扔心心.gif")
        ]
      },
      focusGuard: {
        path: [
          xiaoJiMao("focusGuard", "线条小狗第18弹_工作.gif"),
          xiaoJiMao("focusGuard", "线条小狗第6弹_写不动了.gif"),
          xiaoJiMao("focusGuard", "线条小狗第9弹_写.gif")
        ]
      },
      focusAlert: {
        path: [
          xiaoJiMao("focusAlert", "发现.gif"),
          xiaoJiMao("focusAlert", "疑问.gif"),
          xiaoJiMao("focusAlert", "线条小狗第20弹_警告.gif"),
          xiaoJiMao("focusAlert", "线条小狗第6弹_惊讶.gif"),
          xiaoJiMao("focusAlert", "线条小狗第8弹_哼.gif"),
          xiaoJiMao("focusAlert", "线条小狗第9弹_疑问.gif")
        ]
      },
      focusDone: {
        path: [
          xiaoJiMao("focusDone", "开心.gif"),
          xiaoJiMao("focusDone", "很棒.gif"),
          xiaoJiMao("focusDone", "线条小狗第14弹_庆祝.gif"),
          xiaoJiMao("focusDone", "线条小狗第6弹_拍手.gif")
        ]
      },
      sad: {
        path: [
          xiaoJiMao("sad", "线条小狗第14弹_大哭.gif"),
          xiaoJiMao("sad", "线条小狗第6弹_呜呜.gif"),
          xiaoJiMao("sad", "线条小狗第7弹_对不起.gif"),
          xiaoJiMao("sad", "线条小狗第9弹_伤心.gif")
        ]
      },
      sleeping: {
        path: xiaoJiMao("sleeping", "线条小狗第14弹_难受.gif")
      }
    }
  }
};

export function resolvePetAppearanceId(value: unknown): PetAppearanceId {
  if (value === "lineDog" || value === "lovartPuppy" || value === "xiaoJiMao") return value;
  return "lineDog";
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
