import { Header } from './components/Header'
import { TokenUsage } from './components/TokenUsage'
import { SessionProgress } from './components/SessionProgress'
import { StatCards } from './components/StatCards'
import { PromptOptimizer } from './components/PromptOptimizer'
import { useUsage } from './popup/useUsage'
import { useConversationUsage } from './popup/useConversationUsage'
import { formatTokenCount } from './usage/formatTokenCount'
import { calculateContextUsagePercentage } from './usage/contextPercentage'
import { getContextWarning } from './usage/warningState'
import './App.css'

function App() {
  const usage = useUsage()
  const conversation = useConversationUsage()

  const { roundedPercent, remainingPercent } = calculateContextUsagePercentage(
    conversation.usage.estimatedContextTokens,
  )
  const warning = getContextWarning(roundedPercent)

  return (
    <div className="app">
      <Header />
      <TokenUsage totalTokens={formatTokenCount(usage.totalTokens)} />
      <SessionProgress
        percent={roundedPercent}
        remainingPercent={remainingPercent}
        warningLevel={warning.level}
        warningMessage={warning.message}
      />
      <StatCards
        inputTokens={formatTokenCount(usage.inputTokens)}
        outputTokens={formatTokenCount(usage.outputTokens)}
      />
      <PromptOptimizer />
    </div>
  )
}

export default App
