import { describe, expect, it } from 'vitest'
import { getContextWarning } from './warningState'

describe('getContextWarning', () => {
  it('is normal with no message below 50%', () => {
    expect(getContextWarning(0)).toEqual({ level: 'normal', message: null, suggestCompression: false })
    expect(getContextWarning(49)).toMatchObject({ level: 'normal', message: null })
  })

  it('is moderate at 50%', () => {
    const warning = getContextWarning(50)
    expect(warning.level).toBe('moderate')
    expect(warning.message).toBe('Halfway through estimated context capacity.')
  })

  it('stays moderate up to 74%', () => {
    expect(getContextWarning(74).level).toBe('moderate')
  })

  it('is high at 75%', () => {
    const warning = getContextWarning(75)
    expect(warning.level).toBe('high')
    expect(warning.message).toBe('Context usage is getting high.')
  })

  it('is critical at 90%', () => {
    const warning = getContextWarning(90)
    expect(warning.level).toBe('critical')
    expect(warning.message).toContain('long or complex responses may become incomplete')
  })

  it('stays critical up to 99%', () => {
    expect(getContextWarning(99).level).toBe('critical')
  })

  it('reaches capacity at 100%', () => {
    const warning = getContextWarning(100)
    expect(warning.level).toBe('capacityReached')
    expect(warning.message).toBe(
      'Estimated context capacity reached — consider starting a new chat or compressing your prompt.',
    )
  })

  it('stays at capacityReached above 100%', () => {
    expect(getContextWarning(150).level).toBe('capacityReached')
  })

  it('never claims things TokeNitrate cannot guarantee', () => {
    const allMessages = [0, 50, 75, 90, 100]
      .map((percent) => getContextWarning(percent).message)
      .filter((message): message is string => message !== null)

    for (const message of allMessages) {
      expect(message.toLowerCase()).not.toContain('chatgpt will')
      expect(message.toLowerCase()).not.toContain('you have only')
    }
  })

  it('flags compression as relevant from the high threshold up, not below', () => {
    expect(getContextWarning(49).suggestCompression).toBe(false)
    expect(getContextWarning(50).suggestCompression).toBe(false)
    expect(getContextWarning(75).suggestCompression).toBe(true)
    expect(getContextWarning(90).suggestCompression).toBe(true)
    expect(getContextWarning(100).suggestCompression).toBe(true)
  })
})
