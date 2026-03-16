export interface DialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface DialogueSystemPresentation {
  show: (line: DialogueLine) => void;
  clear: (context: { cinematicId: string }) => void;
}

export class DialogueSystem {
  private readonly presentation: DialogueSystemPresentation;

  constructor(presentation: DialogueSystemPresentation) {
    this.presentation = presentation;
  }

  showLine(line: DialogueLine): void {
    this.presentation.show(line);
  }

  clear(cinematicId: string): void {
    this.presentation.clear({ cinematicId });
  }
}
