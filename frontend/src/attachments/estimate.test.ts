import { describe, expect, it } from 'vitest'
import { classifyAttachment, estimateAttachmentTokens } from './estimate'

describe('classifyAttachment', () => {
  it('uses the MIME type first', () => {
    expect(classifyAttachment({ name: 'x', type: 'image/png' })).toBe('image')
    expect(classifyAttachment({ name: 'x', type: 'application/pdf' })).toBe('pdf')
    expect(classifyAttachment({ name: 'x', type: 'text/plain' })).toBe('text')
  })
  it('falls back to the extension', () => {
    expect(classifyAttachment({ name: 'notes.MD', type: '' })).toBe('text')
    expect(classifyAttachment({ name: 'report.docx', type: '' })).toBe('office')
    expect(classifyAttachment({ name: 'scan.pdf', type: '' })).toBe('pdf')
  })
  it('is unknown for unrecognised files', () => {
    expect(classifyAttachment({ name: 'blob.xyz', type: '' })).toBe('unknown')
  })
})

describe('estimateAttachmentTokens', () => {
  it('estimates a text file at about size/4', () => {
    expect(estimateAttachmentTokens({ name: 'a.txt', type: 'text/plain', size: 4000 })).toBe(1000)
  })
  it('buckets images by size', () => {
    expect(estimateAttachmentTokens({ name: 'a.png', type: 'image/png', size: 50 * 1024 })).toBe(255)
    expect(estimateAttachmentTokens({ name: 'a.png', type: 'image/png', size: 500 * 1024 })).toBe(765)
    expect(estimateAttachmentTokens({ name: 'a.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 })).toBe(1105)
  })
  it('estimates a 1 MB PDF as a positive, capped number', () => {
    const tokens = estimateAttachmentTokens({ name: 'a.pdf', type: 'application/pdf', size: 1024 * 1024 })
    expect(tokens).toBeGreaterThan(1000)
    expect(tokens).toBeLessThanOrEqual(100_000)
  })
  it('is zero for an empty file', () => {
    expect(estimateAttachmentTokens({ name: 'a.txt', type: 'text/plain', size: 0 })).toBe(0)
  })
  it('caps a huge file', () => {
    expect(estimateAttachmentTokens({ name: 'a.txt', type: 'text/plain', size: 2 * 1024 ** 3 })).toBe(100_000)
  })
  it('never throws or goes negative on invalid sizes', () => {
    expect(estimateAttachmentTokens({ name: 'a.txt', type: '', size: -5 })).toBe(0)
    expect(estimateAttachmentTokens({ name: 'a.txt', type: '', size: Number.NaN })).toBe(0)
  })
  it('uses the fallback ratio for unknown types', () => {
    expect(estimateAttachmentTokens({ name: 'a.xyz', type: '', size: 800 })).toBe(100)
  })
})
