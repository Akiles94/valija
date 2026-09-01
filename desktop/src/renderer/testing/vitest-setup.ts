import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Without this, renders from separate `it()` blocks accumulate in the same
// jsdom document, since Vitest doesn't auto-reset it between tests the way
// Jest's testEnvironment does.
afterEach(cleanup);
