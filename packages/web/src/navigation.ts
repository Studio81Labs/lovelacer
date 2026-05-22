interface FrameLikeWindow {
  readonly self: unknown
  readonly top: unknown
  open(url: string, target: string): unknown
}

export function isEmbeddedInFrame(win: Pick<FrameLikeWindow, 'self' | 'top'> = window): boolean {
  try {
    return win.self !== win.top
  } catch {
    return true
  }
}

export function openHomeAssistantPath(url: string, win: FrameLikeWindow = window): void {
  win.open(url, isEmbeddedInFrame(win) ? '_top' : '_blank')
}
