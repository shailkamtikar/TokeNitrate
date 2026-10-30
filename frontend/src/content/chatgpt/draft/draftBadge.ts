/**
 * The on-page draft token badge. It lives in a Shadow DOM so ChatGPT's CSS
 * can't touch it and ours can't leak out. The number animates as rolling
 * digits (each digit slides to its new value), the badge pulses on large
 * jumps and fades in/out. Everything is plain DOM + CSS transforms.
 */
const STYLE = `
:host { all: initial; }
.badge {
  position: fixed; z-index: 2147483000; pointer-events: none;
  display: flex; align-items: center; gap: 8px;
  padding: 7px 13px; border-radius: 999px;
  font: 600 12px/1 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #e8fff4; background: rgba(12, 22, 20, 0.84);
  border: 1px solid rgba(94, 234, 168, 0.35);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28), 0 0 18px rgba(52, 211, 153, 0.18);
  backdrop-filter: blur(10px);
  opacity: 0; transform: translateY(6px) scale(0.96);
  transition: opacity 220ms cubic-bezier(.2,.8,.2,1), transform 220ms cubic-bezier(.2,.8,.2,1),
              border-color 300ms ease, box-shadow 300ms ease;
}
.badge.visible { opacity: 1; transform: translateY(0) scale(1); }
.badge.pulse { animation: pulse 420ms cubic-bezier(.2,.8,.2,1); }
.badge.warn { border-color: rgba(251, 191, 36, 0.6); }
.badge.danger { border-color: rgba(248, 113, 113, 0.7); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399; transition: background 300ms ease; }
.warn .dot { background: #fbbf24; box-shadow: 0 0 8px #fbbf24; }
.danger .dot { background: #f87171; box-shadow: 0 0 8px #f87171; }
.num { display: inline-flex; align-items: center; font-variant-numeric: tabular-nums; font-size: 14px; letter-spacing: -0.01em; }
.wheel { display: inline-block; height: 1em; width: 0.62em; overflow: hidden; line-height: 1em; }
.strip { display: flex; flex-direction: column; transition: transform 320ms cubic-bezier(.2,.8,.2,1); }
.strip span { display: block; height: 1em; text-align: center; }
.sep { display: inline-block; width: 0.3em; text-align: center; }
.label { opacity: 0.7; font-weight: 500; }
.files { opacity: 0.85; font-weight: 500; color: #a7f3d0; }
@keyframes pulse { 0% { transform: scale(1); } 40% { transform: scale(1.07); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .badge, .strip { transition: none !important; }
  .badge.pulse { animation: none !important; }
}
`

export interface BadgeValue {
  tokens: number
  fileTokens: number
  approximate: boolean
  severity: 'normal' | 'warn' | 'danger'
}

export interface DraftBadge {
  update: (value: BadgeValue, anchor: HTMLElement | null) => void
  hide: () => void
  destroy: () => void
}

const DIGITS = '0123456789'

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function createDraftBadge(doc: Document = document): DraftBadge {
  const host = doc.createElement('div')
  host.setAttribute('data-tokenitrate-badge', '')
  const shadow = host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  style.textContent = STYLE
  const badge = doc.createElement('div')
  badge.className = 'badge'
  badge.setAttribute('role', 'status')
  badge.setAttribute('aria-live', 'polite')
  badge.innerHTML =
    '<span class="dot"></span><span class="num"></span><span class="label"></span><span class="files"></span>'
  shadow.append(style, badge)
  doc.documentElement.appendChild(host)

  const num = badge.querySelector<HTMLElement>('.num')!
  const label = badge.querySelector<HTMLElement>('.label')!
  const files = badge.querySelector<HTMLElement>('.files')!

  let shownText = ''
  let wheels: HTMLElement[] = []
  let lastValue = 0
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let anchor: HTMLElement | null = null
  let frame = 0

  function position(): void {
    if (!anchor || !anchor.isConnected) return
    const rect = anchor.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return
    const width = badge.offsetWidth || 160
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))
    const top = Math.max(8, rect.top - (badge.offsetHeight || 28) - 10)
    badge.style.left = `${left}px`
    badge.style.top = `${top}px`
  }

  function schedulePosition(): void {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(position)
  }

  function renderNumber(value: number): void {
    const text = value.toLocaleString('en-US')
    if (text === shownText) return
    const sameShape = text.length === shownText.length && wheels.length > 0
    if (!sameShape) {
      num.textContent = ''
      wheels = []
      for (const ch of text) {
        if (DIGITS.includes(ch)) {
          const wheel = doc.createElement('span')
          wheel.className = 'wheel'
          const strip = doc.createElement('span')
          strip.className = 'strip'
          strip.innerHTML = [...DIGITS].map((d) => `<span>${d}</span>`).join('')
          wheel.appendChild(strip)
          num.appendChild(wheel)
          wheels.push(strip)
        } else {
          const sep = doc.createElement('span')
          sep.className = 'sep'
          sep.textContent = ch
          num.appendChild(sep)
          wheels.push(sep)
        }
      }
    }
    let i = 0
    for (const ch of text) {
      const el = wheels[i++]
      if (DIGITS.includes(ch)) el.style.transform = `translateY(-${DIGITS.indexOf(ch)}em)`
    }
    shownText = text
  }

  function hide(): void {
    badge.classList.remove('visible')
    lastValue = 0
    if (hideTimer !== undefined) clearTimeout(hideTimer)
    // Reset after the fade-out so the next appearance doesn't roll from a stale number.
    hideTimer = setTimeout(() => {
      shownText = ''
      wheels = []
      num.textContent = ''
    }, 260)
  }

  function update(value: BadgeValue, nextAnchor: HTMLElement | null): void {
    anchor = nextAnchor
    const total = value.tokens + value.fileTokens
    if (total <= 0 || !nextAnchor) {
      hide()
      return
    }
    if (hideTimer !== undefined) clearTimeout(hideTimer)
    renderNumber(total)
    label.textContent = value.approximate ? 'tokens (approx.)' : 'tokens'
    files.textContent =
      value.fileTokens > 0 ? `· incl. ~${value.fileTokens.toLocaleString('en-US')} from files` : ''
    badge.classList.toggle('warn', value.severity === 'warn')
    badge.classList.toggle('danger', value.severity === 'danger')
    badge.classList.add('visible')
    if (!reducedMotion() && lastValue > 0 && Math.abs(total - lastValue) / lastValue > 0.1) {
      badge.classList.remove('pulse')
      void badge.offsetWidth
      badge.classList.add('pulse')
    }
    lastValue = total
    schedulePosition()
  }

  window.addEventListener('resize', schedulePosition)
  window.addEventListener('scroll', schedulePosition, true)

  return {
    update,
    hide,
    destroy() {
      window.removeEventListener('resize', schedulePosition)
      window.removeEventListener('scroll', schedulePosition, true)
      cancelAnimationFrame(frame)
      if (hideTimer !== undefined) clearTimeout(hideTimer)
      host.remove()
    },
  }
}
