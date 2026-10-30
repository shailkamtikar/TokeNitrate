import type { TabStatus } from '../popup/hooks'

type StateScreenProps = {
  status: Exclude<TabStatus, 'ready'>
}

const COPY: Record<StateScreenProps['status'], { title: string; body: string; glyph: string }> = {
  loading: { title: 'One moment…', body: 'Checking your ChatGPT tab.', glyph: '◌' },
  'not-chatgpt': {
    title: 'Open ChatGPT to start',
    body: 'TokeNitrate counts tokens while you chat on chatgpt.com. Open it in this window and click the icon again.',
    glyph: '⌁',
  },
  'needs-reload': {
    title: 'Refresh this tab once',
    body: 'This ChatGPT tab was open before TokeNitrate was installed or updated. Reload it one time and counting starts, with no more reloads needed.',
    glyph: '↻',
  },
}

export function StateScreen({ status }: StateScreenProps) {
  const copy = COPY[status]
  return (
    <section className="card card--enter state">
      <div className={`state__glyph${status === 'loading' ? ' state__glyph--spin' : ''}`} aria-hidden="true">
        {copy.glyph}
      </div>
      <h2 className="state__title">{copy.title}</h2>
      <p className="note">{copy.body}</p>
    </section>
  )
}
