import { useMemo, useState } from 'react'
import { Header } from './components/Header'
import { ContextCard } from './components/ContextCard'
import { LimitsExplainer } from './components/LimitsExplainer'
import { PromptOptimizer } from './components/PromptOptimizer'
import { SettingsView } from './components/SettingsView'
import { StateScreen } from './components/StateScreen'
import { UsageCard } from './components/UsageCard'
import { AnimatedNumber } from './components/ui/AnimatedNumber'
import { useBudgetObservations, useLedger, useLimitHit, useNow, useSettings, useTabStatus } from './popup/hooks'
import { useConversationUsage } from './popup/useConversationUsage'
import { useDraftTokens } from './popup/useDraftTokens'
import { useUsage } from './popup/useUsage'
import { buildViewModel } from './popup/viewModel'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const tab = useTabStatus()
  const settings = useSettings()
  const conversation = useConversationUsage()
  const draft = useDraftTokens(conversation.conversationId)
  const ledger = useLedger()
  const observations = useBudgetObservations()
  const limitHit = useLimitHit()
  const allTime = useUsage()
  const now = useNow()

  const view = useMemo(
    () =>
      buildViewModel({
        conversation: conversation.usage,
        draftTokens: draft.tokens + draft.fileTokens,
        settings,
        ledger,
        observations,
        limitHit,
        now,
      }),
    [conversation.usage, draft, settings, ledger, observations, limitHit, now],
  )

  const tracking = tab === 'ready'

  return (
    <div className="app">
      <Header settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((open) => !open)} />

      {settingsOpen ? (
        <SettingsView key={JSON.stringify(settings)} settings={settings} />
      ) : (
        <>
          {tab !== 'ready' && <StateScreen status={tab} />}
          {tracking && <ContextCard view={view.context} hasChat={conversation.conversationId !== null} />}
          {tab !== 'loading' && <UsageCard view={view.usage} now={now} />}
          <LimitsExplainer />
          {tracking && <PromptOptimizer />}
        </>
      )}

      <footer className="footer">
        <span>
          All-time: <AnimatedNumber value={allTime.totalTokens} /> tokens
        </span>
        <span>Estimates only</span>
      </footer>
    </div>
  )
}

export default App
