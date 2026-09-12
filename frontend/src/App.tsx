import { Header } from './components/Header'
import { TokenUsage } from './components/TokenUsage'
import { SessionProgress } from './components/SessionProgress'
import { StatCards } from './components/StatCards'
import { PromptOptimizer } from './components/PromptOptimizer'
import { demoUsage } from './demoData'
import './App.css'

function App() {
  return (
    <div className="app">
      <Header />
      <TokenUsage totalTokens={demoUsage.totalTokens} />
      <SessionProgress percent={demoUsage.sessionPercent} />
      <StatCards
        inputTokens={demoUsage.inputTokens}
        outputTokens={demoUsage.outputTokens}
      />
      <PromptOptimizer />
    </div>
  )
}

export default App
