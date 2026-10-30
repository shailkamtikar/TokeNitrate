import { findComposer } from '../selectors'

/**
 * Reads the text currently typed into ChatGPT's composer. The composer is
 * either a plain <textarea> or a ProseMirror contenteditable (one <p> per
 * line, with a placeholder <p> when empty), depending on the layout.
 */
export function readComposerText(composer: HTMLElement | null): string {
  if (!composer) return ''
  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    return composer.value
  }

  // The placeholder paragraph only counts as a placeholder while it is empty;
  // some builds leave its class on after the user starts typing.
  const paragraphs = Array.from(composer.children).filter((child) => {
    const looksLikePlaceholder =
      child.classList.contains('placeholder') || child.hasAttribute('data-empty-paragraph')
    return !looksLikePlaceholder || (child.textContent ?? '').trim() !== ''
  })
  if (paragraphs.length === 0) {
    const hasOnlyPlaceholders = composer.children.length > 0
    return hasOnlyPlaceholders ? '' : (composer.textContent ?? '')
  }
  return paragraphs.map((paragraph) => paragraph.textContent ?? '').join('\n')
}

export { findComposer }
