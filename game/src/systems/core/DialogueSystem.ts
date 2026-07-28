export interface DialogueLine {
  id?: string;
  speaker: string;
  text: string;
  emotion?: string;
  portrait?: string;
  durationMs?: number;
  choices?: DialogueChoice[];
  nextId?: string;
}

export interface DialogueChoice {
  id?: string;
  text: string;
  nextId?: string;
}

export interface DialoguePresentationContext {
  cinematicId?: string;
  index?: number;
  lineId?: string;
}

export interface DialogueSystemPresentation {
  show: (line: DialogueLine, context?: DialoguePresentationContext) => void;
  clear: (context: { cinematicId?: string }) => void;
}

export interface DialoguePlaybackCallbacks {
  context?: { cinematicId?: string };
  onLine?: (line: DialogueLine, context: { index: number }) => void | Promise<void>;
  onChoiceRequested?: (line: DialogueLine, choices: DialogueChoice[]) => Promise<number> | number;
  shouldInterrupt?: () => boolean;
}

export class DialogueSystem {
  private readonly presentation: DialogueSystemPresentation;

  constructor(presentation: DialogueSystemPresentation) {
    this.presentation = presentation;
  }

  showLine(line: DialogueLine, context?: DialoguePresentationContext): void {
    this.presentation.show(line, context);
  }

  async playSequence(lines: DialogueLine[], callbacks: DialoguePlaybackCallbacks = {}): Promise<void> {
    if (lines.length === 0) {
      return;
    }

    const linesById = new Map(lines.map((line) => [line.id, line] as const));
    const visitedLines = new Set<string>();

    let index = 0;
    while (index >= 0 && index < lines.length) {
      if (callbacks.shouldInterrupt?.()) {
        break;
      }

      const line = lines[index];
      this.presentation.show(line, {
        cinematicId: callbacks.context?.cinematicId,
        index,
        lineId: line.id
      });
      await Promise.resolve(callbacks.onLine?.(line, { index }));

      if (line.choices && line.choices.length > 0) {
        const selectedChoiceIndex = await Promise.resolve(
          callbacks.onChoiceRequested?.(line, line.choices) ?? 0
        );
        const safeChoiceIndex = Math.min(Math.max(0, selectedChoiceIndex), line.choices.length - 1);
        const selectedChoice = line.choices[safeChoiceIndex];
        if (selectedChoice?.nextId && linesById.get(selectedChoice.nextId)) {
          const nextLine = linesById.get(selectedChoice.nextId);
          const nextIndex = nextLine ? lines.indexOf(nextLine) : -1;
          if (nextIndex >= 0) {
            index = nextIndex;
            continue;
          }
        }
      }

      if (line.nextId) {
        const nextLine = linesById.get(line.nextId);
        const nextIndex = nextLine ? lines.indexOf(nextLine) : -1;
        if (nextIndex >= 0) {
          if (line.id && visitedLines.has(line.id)) {
            break;
          }
          if (line.id) {
            visitedLines.add(line.id);
          }
          index = nextIndex;
          continue;
        }
      }

      index += 1;
    }
  }

  clear(cinematicId?: string): void {
    this.presentation.clear({ cinematicId });
  }
}
