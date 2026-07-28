export const UI_LAYOUT = {
  logicalWidth: 960,
  logicalHeight: 540,
  margin: 12,
  gap: 8,
  protagonistWidth: 246,
  protagonistHeight: 88,
  partyWidth: 246,
  partyHeight: 88,
  threatWidth: 154,
  threatHeight: 34,
  controlsWidth: 340,
  controlsHeight: 38,
  objectiveWidth: 520,
  objectiveHeight: 62,
  interactionMaxWidth: 540,
  interactionHeight: 34,
  dialogueMaxWidth: 820,
  dialogueHeight: 154,
  pauseWidth: 430,
  pauseHeight: 318,
  transitionMaxWidth: 640,
  transitionHeight: 170,
  fatalMaxWidth: 760,
  fatalHeight: 286
} as const;

export interface UiLayoutSnapshot {
  width: number;
  height: number;
  protagonist: { x: number; y: number };
  party: { x: number; y: number };
  threat: { x: number; y: number };
  controls: { x: number; y: number };
  objective: { x: number; y: number; width: number };
  interaction: { x: number; y: number; maxWidth: number };
  dialogue: { x: number; y: number; width: number; height: number };
  modal: { x: number; y: number };
}

export type UiModalLayer = 'fatal' | 'transition' | 'pause' | 'dialogue' | 'gameplay';

export function resolveDominantUiLayer(state: {
  fatal: boolean;
  transition: boolean;
  pause: boolean;
  dialogue: boolean;
}): UiModalLayer {
  if (state.fatal) return 'fatal';
  if (state.transition) return 'transition';
  if (state.pause) return 'pause';
  if (state.dialogue) return 'dialogue';
  return 'gameplay';
}

/** Computes every UIScene anchor from the current logical canvas size. */
export function calculateUiLayout(width: number, height: number): UiLayoutSnapshot {
  const safeWidth = Math.max(320, width);
  const safeHeight = Math.max(240, height);
  const margin = UI_LAYOUT.margin;
  const objectiveWidth = Math.min(UI_LAYOUT.objectiveWidth, safeWidth - margin * 2);
  const dialogueWidth = Math.min(UI_LAYOUT.dialogueMaxWidth, safeWidth - margin * 2);

  return {
    width: safeWidth,
    height: safeHeight,
    protagonist: { x: margin, y: margin },
    party: { x: margin, y: margin + UI_LAYOUT.protagonistHeight + UI_LAYOUT.gap },
    threat: { x: safeWidth - margin - UI_LAYOUT.threatWidth, y: margin },
    controls: { x: safeWidth - margin - UI_LAYOUT.controlsWidth, y: margin + UI_LAYOUT.threatHeight + UI_LAYOUT.gap },
    objective: { x: (safeWidth - objectiveWidth) / 2, y: safeHeight - margin - UI_LAYOUT.objectiveHeight, width: objectiveWidth },
    interaction: {
      x: safeWidth / 2,
      y: safeHeight - margin - UI_LAYOUT.objectiveHeight - UI_LAYOUT.gap,
      maxWidth: Math.min(UI_LAYOUT.interactionMaxWidth, safeWidth - margin * 2)
    },
    dialogue: {
      x: (safeWidth - dialogueWidth) / 2,
      y: safeHeight - margin - UI_LAYOUT.dialogueHeight,
      width: dialogueWidth,
      height: UI_LAYOUT.dialogueHeight
    },
    modal: { x: safeWidth / 2, y: safeHeight / 2 }
  };
}
