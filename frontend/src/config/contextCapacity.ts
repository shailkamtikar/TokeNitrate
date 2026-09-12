/**
 * TokeNitrate's own reference figure for how much input/context capacity a
 * conversation has to work with, used only as the denominator for the
 * estimated context-usage meter.
 *
 * This is NOT ChatGPT's official quota or context window size — OpenAI
 * doesn't publish an exact, guaranteed number for what a given chat will
 * actually accept, and it can vary by model/mode. 128,000 tokens is our
 * current reference point for the GPT-5.x "Thinking" context model this
 * build targets.
 *
 * Kept behind this function (rather than inlined at call sites) so it can
 * later vary by detected model/mode without touching any component or
 * percentage-calculation code.
 */
const DEFAULT_CONTEXT_CAPACITY_TOKENS = 128_000

export function getContextCapacityTokens(): number {
  return DEFAULT_CONTEXT_CAPACITY_TOKENS
}
