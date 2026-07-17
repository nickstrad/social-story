import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// This project runs without `globals: true`, so React Testing Library never
// auto-registers its own cleanup. Without this, every render in a file leaks
// into the next test's queries. jsdom-only — the server project must not load
// it.
afterEach(cleanup)
