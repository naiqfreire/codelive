import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Node 24 ships undici's `Request`, which rejects the `AbortSignal` created by jsdom.
// React Router builds a `Request` with that signal on every navigation, so data-router
// tests would fail with "Expected signal to be an instance of AbortSignal".
// Unit tests do not rely on navigation aborts, so the signal is dropped here.
const BaseRequest = globalThis.Request

if (BaseRequest) {
  class TestRequest extends BaseRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      const sanitized: RequestInit = { ...init }
      delete sanitized.signal
      super(input, sanitized)
    }
  }

  globalThis.Request = TestRequest as typeof Request
}

afterEach(() => {
  cleanup()
})
