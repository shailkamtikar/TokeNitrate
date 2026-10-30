import { describe, expect, it, vi } from 'vitest'
import { compressText, describeCompressError } from './compress'

const getClientId = async () => 'client-id-12345'

function reply(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

describe('compressText', () => {
  it('returns the shortened text on success', async () => {
    const fetchFn = reply(200, { compressed: 'Short.', original_chars: 40, compressed_chars: 6, unchanged: false })
    const result = await compressText('A much longer original prompt text', { fetchFn, getClientId })
    expect(result).toEqual({ ok: true, compressed: 'Short.', originalChars: 40, compressedChars: 6, unchanged: false })
  })

  it('sends the text and a client id to the backend', async () => {
    const fetchFn = reply(200, { compressed: 'a', original_chars: 2, compressed_chars: 1, unchanged: false })
    await compressText('hello there', { fetchFn, getClientId })
    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/compress$/)
    expect((init.headers as Record<string, string>)['X-Client-Id']).toBe('client-id-12345')
    expect(JSON.parse(init.body as string)).toEqual({ text: 'hello there' })
  })

  it('rejects empty text without calling the network', async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch
    expect(await compressText('   ', { fetchFn, getClientId })).toEqual({ ok: false, code: 'empty' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects over-long text without calling the network', async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch
    expect(await compressText('x'.repeat(20_001), { fetchFn, getClientId })).toEqual({ ok: false, code: 'too_long' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it.each([
    [429, 'quota_exhausted', 'quota_exhausted'],
    [429, 'rate_limited', 'rate_limited'],
    [504, 'timeout', 'timeout'],
    [503, 'not_configured', 'not_configured'],
    [502, 'upstream_error', 'upstream_error'],
    [500, 'something_else', 'upstream_error'],
  ])('maps HTTP %i %s to %s', async (status, code, expected) => {
    const result = await compressText('hello world', { fetchFn: reply(status, { code, message: 'x' }), getClientId })
    expect(result).toEqual({ ok: false, code: expected })
  })

  it('maps a too-long rejection from the server', async () => {
    const result = await compressText('hello world', {
      fetchFn: reply(422, { code: 'text_too_long', message: 'x' }),
      getClientId,
    })
    expect(result).toEqual({ ok: false, code: 'too_long' })
  })

  it('reports the backend as unreachable when the request fails', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect(await compressText('hello world', { fetchFn, getClientId })).toEqual({ ok: false, code: 'unreachable' })
  })

  it('times out slow requests', async () => {
    const fetchFn = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    ) as unknown as typeof fetch
    const result = await compressText('hello world', { fetchFn, getClientId, timeoutMs: 20 })
    expect(result).toEqual({ ok: false, code: 'timeout' })
  })

  it('rejects a malformed success body', async () => {
    const result = await compressText('hello world', { fetchFn: reply(200, { nope: true }), getClientId })
    expect(result).toEqual({ ok: false, code: 'invalid_response' })
  })

  it('has friendly copy for every error code', () => {
    const codes = [
      'empty',
      'too_long',
      'rate_limited',
      'quota_exhausted',
      'timeout',
      'unreachable',
      'not_configured',
      'upstream_error',
      'invalid_response',
    ] as const
    for (const code of codes) {
      expect(describeCompressError(code).length).toBeGreaterThan(10)
    }
  })
})
