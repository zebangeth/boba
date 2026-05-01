# Pawse 素材指南

这份文档定义 Pawse 的宠物动画素材契约。后续补素材或新增宠物形象时，应以这里的状态列表为准。即使某个宠物暂时没有完全匹配的素材，也不要删除状态或压缩状态数量，而是在 manifest 里使用同一宠物形象下的 fallback 或 placeholder。

## 目标

- 让产品行为不依赖当前素材是否齐全。
- 让每个宠物形象都能通过本地 manifest 接入。
- 给素材准备方一个明确的 GIF 清单。
- 给开发者一个新增宠物形象的代码接入参考。
- 保证桌宠窗口保持透明，不出现宠物背后的矩形背景。

## GIF 基础要求

- 当前实现使用 animated `.gif`。
- GIF 背景必须透明，不要烘焙纯色底。
- 同一个宠物形象的所有状态应保持一致画布尺寸、视觉比例和锚点。
- 每个 GIF 四周要留出足够 padding，避免 CSS 上下浮动、跳跃、摇晃或镜像时被裁切。
- 移动类素材默认应面朝右。小狗向左移动时，renderer 会用 CSS 镜像。
- 长时间状态需要能自然循环，例如 `idle`、`focusGuard`、`sleeping`。
- 短反馈状态可以更夸张，例如 `happy`、`sad`、`focusAlert`，但也要能被保持 1 到 3 秒而不突兀。
- 文件命名优先使用语义名称，例如 `idle.gif`、`break-running.gif`、`focus-guard.gif`。

推荐的新宠物素材目录结构。每个状态目录里可以放 1 个或多个 GIF：

```text
pet_assets/<pet-id>/
  idle/
    idle-1.gif
    idle-2.gif
  sitting/
    sitting.gif
  happy/
    happy-1.gif
    happy-2.gif
  breakPrompt/
    break-prompt.gif
  breakRunning/
    break-running.gif
  breakDone/
    break-done.gif
  hydrationPrompt/
    hydration-prompt.gif
  drinking/
    drinking.gif
  hydrationDone/
    hydration-done.gif
  focusGuard/
    focus-guard-1.gif
    focus-guard-2.gif
  focusAlert/
    focus-alert.gif
  focusDone/
    focus-done.gif
  sad/
    sad.gif
  sleeping/
    sleeping.gif
```

当前已有素材仍保留在原目录里，不需要为了这份指南立刻迁移。

## 状态契约

`PetState` 定义在 `src/shared/types.ts`。每个宠物形象最终都可以为下面 14 个状态准备素材。

| 状态 | 什么时候触发 | 动画意图 | 素材要求 |
| --- | --- | --- | --- |
| `idle` | 默认空闲状态。小狗可见、未专注、没有阻塞提醒时触发。 | 呼吸、眨眼、张望、发呆、轻微等待。 | 应该克制，不要看起来像提醒或警告。 |
| `sitting` | 预留的安静待命状态。未来可用于手动坐下、固定陪伴、长时间低打扰或睡前过渡场景。当前拖拽不会切换到该状态。 | 坐下、趴下、安静待命。 | 适合作为“我就在这里”的稳定状态。 |
| `happy` | 点击小狗、通用正反馈、Demo Happy。 | 开心、摇尾巴、庆祝、跳跃、爱心。 | 短反馈状态。CSS 会额外加轻微跳跃。 |
| `breakPrompt` | 休息提醒弹出时，用户还没有选择操作。 | 敲门、戳戳、等待出去玩、吸引注意。 | 要表达“请回应我”，但不要太凶。CSS 会加轻微敲击感。 |
| `breakRunning` | 用户接受休息提醒后触发。主动休息阶段持续 60 秒，或用户点击“我回来了”后结束。 | 更活跃、更有存在感的奔跑或玩耍，促使用户离开屏幕。 | 面朝右。不要复用太安静的普通走路素材。 |
| `breakDone` | 主动休息阶段结束后触发。 | 休息完成、欢迎回来、满足、鼓励。 | 如果缺失会自动 fallback 到 `happy`。 |
| `hydrationPrompt` | 喝水提醒弹出时，用户还没有确认喝水。 | 口渴、想喝水、举杯、讨水、提醒补水。 | 最好一眼能看出和补水有关。 |
| `drinking` | 用户确认“我喝水了”之后立即触发。 | 喝水、收到水、正在补水。 | 通常会在随后切到 `hydrationDone`。 |
| `hydrationDone` | 喝水确认后的完成反馈。 | 补水成功、清爽、满足、健康感。 | 如果缺失会自动 fallback 到 `happy`。 |
| `focusGuard` | 专注模式启动、用户点“回去工作”后触发。 | 守卫、警觉、工作中、认真盯着、帮用户守住专注。 | 这是专注模式的核心形象，要坚定但不要吓人。 |
| `focusAlert` | 专注期间检测到用户分心时触发，直到用户选择“回去工作”或结束专注。 | 提醒、警觉、叫醒、轻微施压。 | 要比 `focusGuard` 更有注意力，但不要过度负面。CSS 会加轻微 alert 动效。 |
| `focusDone` | 专注完成或手动结束后的反馈。 | 守护完成、放松、认可、庆祝。 | 如果缺失会自动 fallback 到 `happy`。 |
| `sad` | 用户选择今天不再休息提醒时触发。未来也可用于长时间忽略、低活跃、负向反馈或关怀场景。 | 难过、担心、委屈、轻微失落。 | 不要过度敌意，整体仍然是陪伴感。 |
| `sleeping` | 预留状态。未来可用于夜间、长时间 idle、勿扰、休眠。当前主流程还没有完整接入。 | 睡觉、休息、晚安、低能量循环。 | 有真实素材最好，没有则用同宠物 placeholder。 |

## 当前触发流程

当前主要状态切换发生在 `src/main/main.ts`。

| 流程 | 状态变化 |
| --- | --- |
| 普通空闲 | `idle`，位置保持固定 |
| 拖拽小狗 | 保持拖拽前的状态，不额外切换状态 |
| 点击小狗 | `happy`，然后回到 `focusGuard` 或 `idle` |
| 休息提醒 | 提醒弹窗期间使用 `breakPrompt` |
| 确认休息 | `breakRunning`，结束后 `breakDone`，再回到 `idle` |
| 稍后休息 | 回到长期状态，通常是 `idle` 或 `focusGuard` |
| 今天不再提醒休息 | `sad`，然后回到长期状态 |
| 喝水提醒 | 提醒弹窗期间使用 `hydrationPrompt` |
| 确认喝水 | `drinking`，然后 `hydrationDone`，再回到长期状态 |
| 开始专注 | `focusGuard` |
| 分心警告 | `focusAlert`，同时显示警告气泡 |
| 回去工作 | `focusGuard` |
| 结束或完成专注 | `focusDone`，然后回到 `idle` |
| Demo Happy | `happy` |

## 素材优先级

给一个新宠物形象准备素材时，建议按这个顺序补齐：

1. 核心循环：`idle`、`sitting`
2. 核心产品流程：`breakPrompt`、`breakRunning`、`hydrationPrompt`、`drinking`、`focusGuard`、`focusAlert`、`happy`
3. 完成反馈 polish：`breakDone`、`hydrationDone`、`focusDone`
4. 负反馈和预留状态：`sad`、`sleeping`
5. fallback：一个属于同一宠物形象的中性 GIF

fallback 必须来自同一个宠物形象。不要让某个宠物缺素材时退回到另一个宠物形象。

## 多素材轮换

manifest 的 `path` 可以是一个字符串，也可以是字符串数组。

- 一次性状态每次进入状态时随机选择一个素材，并在这次状态期间保持不变。例如 `happy`、`breakPrompt`、`breakRunning`、`breakDone`、`hydrationPrompt`、`drinking`、`hydrationDone`、`focusAlert`、`focusDone`、`sad`。
- 持续状态每次进入状态时先随机选择一个素材，然后每 15 分钟轮换一次。例如 `idle`、`focusGuard`。
- 当前轮换发生在 renderer，不改变主进程状态机。

如果状态只有一个素材，就不会发生轮换。

## 有限循环或异常 GIF

有些 GIF 文件虽然能播放，但内部 frame delay 或 loop metadata 不适合桌宠长期展示。例如某个 GIF 跑几秒后停在一帧上。遇到这种素材时，优先重新导出 GIF；如果暂时不能重做素材，可以在 manifest 里加 `replayIntervalMs`：

```ts
breakRunning: {
  path: "pet_assets/example/breakRunning/run.gif",
  replayIntervalMs: 1700
}
```

renderer 会按这个间隔重新挂载图片，让 GIF 在进入停顿帧前重新开始播放。这个字段只应该用于修复有问题的 GIF，不要给正常无限循环素材滥用。

## 状态级 Fallback

部分完成态可以选择不提供专门素材。当前 resolver 会按下面顺序找素材：

1. 当前状态的精确素材。
2. 状态级 fallback。
3. 当前宠物形象的 `fallback`。

当前状态级 fallback：

| 状态 | fallback |
| --- | --- |
| `breakDone` | `happy` |
| `hydrationDone` | `happy` |
| `focusDone` | `happy` |

例如某个宠物没有 `hydrationDone`，但有 `happy`，喝水完成时会显示 `happy`。如果连 `happy` 也没有，才会显示该宠物自己的 `fallback`。

## 移动和镜像规则

当前 renderer 会根据 `petFacing` 对 GIF 做左右镜像：

- `petFacing === "right"` 时正常显示。
- `petFacing === "left"` 时使用 `scaleX(-1)` 镜像。

最需要注意方向的状态：

- `breakRunning`

`breakRunning` 的 GIF 默认应该面朝右。避免在这类 GIF 里出现文字、Logo、单侧道具等镜像后会明显不合理的元素。

## Placeholder 规则

当产品状态存在，但当前宠物还没有完全匹配的素材时，可以使用 placeholder。

在 `src/shared/petAppearances.ts` 里用 `isPlaceholder: true` 标记：

```ts
sad: {
  path: "pet_assets/example/sleeping/sleeping.gif",
  isPlaceholder: true
}
```

适合标记 placeholder 的情况：

- 语义接近但不完全准确。
- 状态是预留状态，当前主流程还不常触发。
- Demo 可接受，但正式 polish 前应该替换。

不要因为素材不完整就删除状态。状态数量由产品行为定义，不由素材完整度定义。

## 新增宠物形象流程

1. 在 `src/shared/types.ts` 的 `PetAppearanceId` 里增加新 ID。
2. 在 `src/shared/petAppearances.ts` 的 `PET_APPEARANCES` 里增加 manifest。
3. 为新宠物提供中英文名称，分别用于 `zh-CN` 和 `en`。
4. 设置一个同宠物形象下的 fallback。
5. 尽可能映射所有 `PetState`。
6. 对不完全匹配的素材加 `isPlaceholder: true`。
7. 打开 Settings，确认宠物形象下拉里出现新选项。
8. 用 Demo 和基础操作走一遍：
   - Demo Break
   - Demo Hydration
   - Demo Focus Warning
   - Demo Happy
   - Start/Stop Focus

manifest 示例：

```ts
export const PET_APPEARANCES = {
  examplePet: {
    id: "examplePet",
    label: {
      "zh-CN": "示例宠物",
      en: "Example Pet"
    },
    fallback: {
      path: "pet_assets/example/idle/idle-1.gif",
      isPlaceholder: true
    },
    states: {
      idle: {
        path: [
          "pet_assets/example/idle/idle-1.gif",
          "pet_assets/example/idle/idle-2.gif"
        ]
      },
      sitting: { path: "pet_assets/example/sitting/sitting.gif" },
      happy: {
        path: [
          "pet_assets/example/happy/happy-1.gif",
          "pet_assets/example/happy/happy-2.gif"
        ]
      },
      breakPrompt: { path: "pet_assets/example/breakPrompt/break-prompt.gif" },
      breakRunning: { path: "pet_assets/example/breakRunning/break-running.gif" },
      breakDone: { path: "pet_assets/example/breakDone/break-done.gif" },
      hydrationPrompt: { path: "pet_assets/example/hydrationPrompt/hydration-prompt.gif" },
      drinking: { path: "pet_assets/example/drinking/drinking.gif" },
      hydrationDone: { path: "pet_assets/example/hydrationDone/hydration-done.gif" },
      focusGuard: { path: "pet_assets/example/focusGuard/focus-guard.gif" },
      focusAlert: { path: "pet_assets/example/focusAlert/focus-alert.gif" },
      focusDone: { path: "pet_assets/example/focusDone/focus-done.gif" },
      sad: { path: "pet_assets/example/sad/sad.gif" },
      sleeping: { path: "pet_assets/example/sleeping/sleeping.gif" }
    }
  }
};
```

## QA Checklist

新增或替换宠物素材前，至少检查：

- 宠物窗口背景保持透明。
- 每个 manifest 里映射的 GIF 都能在 dev 和 build 中加载。
- fallback 来自同一个宠物形象。
- `breakRunning` 向左镜像时看起来合理。
- 语音气泡不会遮住宠物最关键的身体或表情。
- 同一宠物的所有状态视觉尺寸一致。
- 切换状态时宠物不会突然大幅跳动、缩放或偏移。
- Demo Break 会依次看到 `breakPrompt`、`breakRunning`、`breakDone`。
- Demo Hydration 会依次看到 `hydrationPrompt`、`drinking`、`hydrationDone`。
- Focus Mode 会显示 `focusGuard`。
- Demo Focus Warning 会显示 `focusAlert`。
- Stop Focus 会显示 `focusDone`。
- Demo Happy 会显示 `happy`。
- placeholder 状态都已经在 manifest 里明确标记。

## 当前内置宠物形象

当前内置 manifest 位于 `src/shared/petAppearances.ts`。

| Appearance ID | 名称 | 说明 |
| --- | --- | --- |
| `lovartPuppy` | 金毛 puppy / Golden Puppy | 当前主 Demo 宠物。素材位于 `pet_assets/金毛 puppy/`，部分预留状态仍使用 placeholder 或状态级 fallback。 |
| `lineDog` | 线条小狗 / Line Dog | 第二个内置宠物。部分状态使用语义接近的表情包 GIF 作为 placeholder。 |
