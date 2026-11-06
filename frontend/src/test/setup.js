import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom has no layout scrolling; Radix keyboard selection uses this browser API.
Element.prototype.scrollIntoView ??= function () {}
Element.prototype.hasPointerCapture ??= function () {
  return false
}
Element.prototype.setPointerCapture ??= function () {}
Element.prototype.releasePointerCapture ??= function () {}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.dispatchEvent(new Event('online'))
})
