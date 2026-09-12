import { Header } from './components/Header'
import { TokenUsage } from './components/TokenUsage'
import { SessionProgress } from './components/SessionProgress'
import { StatCards } from './components/StatCards'
import { PromptOptimizer } from './components/PromptOptimizer'
import { useUsage } from './popup/useUsage'
import { DEMO_SESSION_PERCENT } from './popup/demoSessionPercent'
import { formatTokenCount } from './usage/formatTokenCount'
import './App.css'

function App() {
  const usage = useUsage()

  return (
    <div className="app">
      <Header />
      <TokenUsage totalTokens={formatTokenCount(usage.totalTokens)} />
      <SessionProgress percent={DEMO_SESSION_PERCENT} />
      <StatCards
        inputTokens={formatTokenCount(usage.inputTokens)}
        outputTokens={formatTokenCount(usage.outputTokens)}
      />
      <PromptOptimizer />
    </div>
  )
}

export default App
