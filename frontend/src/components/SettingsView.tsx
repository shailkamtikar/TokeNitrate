import { useState, type FormEvent } from 'react'
import {
  DEFAULT_SETTINGS,
  resetSettings,
  saveSettings,
  SETTINGS_LIMITS,
  type Settings,
} from '../settings/settingsStore'
import { parseWholeNumber } from '../settings/parseWholeNumber'
import { clearUsageData } from '../usage/resetData'

type SettingsViewProps = {
  settings: Settings
}

export function SettingsView({ settings }: SettingsViewProps) {
  const [capacity, setCapacity] = useState(String(settings.contextCapacityTokens))
  const [budget, setBudget] = useState(settings.usageBudgetTokens === null ? '' : String(settings.usageBudgetTokens))
  const [hours, setHours] = useState(String(settings.usageWindowHours))
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    const L = SETTINGS_LIMITS
    const cap = parseWholeNumber(capacity)
    const bud = parseWholeNumber(budget)
    const hrs = parseWholeNumber(hours)

    if (cap === 'invalid' || cap === null || cap < L.contextCapacityTokens.min || cap > L.contextCapacityTokens.max) {
      return setError(`Chat capacity must be a whole number between ${L.contextCapacityTokens.min.toLocaleString()} and ${L.contextCapacityTokens.max.toLocaleString()}.`)
    }
    if (bud === 'invalid' || (bud !== null && (bud < L.usageBudgetTokens.min || bud > L.usageBudgetTokens.max))) {
      return setError(`Usage budget must be blank (automatic) or between ${L.usageBudgetTokens.min.toLocaleString()} and ${L.usageBudgetTokens.max.toLocaleString()}.`)
    }
    if (hrs === 'invalid' || hrs === null || hrs < L.usageWindowHours.min || hrs > L.usageWindowHours.max) {
      return setError(`Window must be a whole number of hours between ${L.usageWindowHours.min} and ${L.usageWindowHours.max}.`)
    }

    setError(null)
    await saveSettings({ contextCapacityTokens: cap, usageBudgetTokens: bud, usageWindowHours: hrs })
    setMessage('Saved.')
  }

  async function onRestoreDefaults() {
    await resetSettings()
    setCapacity(String(DEFAULT_SETTINGS.contextCapacityTokens))
    setBudget('')
    setHours(String(DEFAULT_SETTINGS.usageWindowHours))
    setError(null)
    setMessage('Defaults restored.')
  }

  async function onClear() {
    await clearUsageData()
    setConfirmingClear(false)
    setError(null)
    setMessage('Usage data cleared.')
  }

  return (
    <form className="card card--enter settings" onSubmit={onSubmit} noValidate>
      <div className="card__head">
        <h2 className="card__title">Settings</h2>
      </div>

      <label className="field">
        <span className="field__label">Chat capacity (tokens)</span>
        <input className="field__input mono" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <span className="field__help">How much one chat can hold. Free-tier estimate: 16,000.</span>
      </label>

      <label className="field">
        <span className="field__label">Usage budget (tokens)</span>
        <input
          className="field__input mono"
          inputMode="numeric"
          placeholder="Automatic"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <span className="field__help">Leave blank to learn it from limit messages (starts at 30,000).</span>
      </label>

      <label className="field">
        <span className="field__label">Usage window (hours)</span>
        <input className="field__input mono" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} />
        <span className="field__help">How long usage counts before it ages out. Default: 5.</span>
      </label>

      {error && <p className="alert alert--danger" role="alert">{error}</p>}
      {message && <p className="alert alert--ok" role="status">{message}</p>}

      <div className="actions">
        <button type="submit" className="btn btn--primary">Save</button>
        <button type="button" className="btn" onClick={onRestoreDefaults}>Restore defaults</button>
      </div>

      <div className="danger-zone">
        {confirmingClear ? (
          <div className="actions">
            <span className="note">Delete all counted usage?</span>
            <button type="button" className="btn btn--danger" onClick={onClear}>Yes, clear</button>
            <button type="button" className="btn" onClick={() => setConfirmingClear(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmingClear(true)}>
            Clear all usage data
          </button>
        )}
      </div>
    </form>
  )
}
