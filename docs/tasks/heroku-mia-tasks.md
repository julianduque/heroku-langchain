# HerokuMia (Chat Completions) Implementation

Brief description of the feauture and its purpose.

Integration with Heroku's Managed Inference API (/v1/chat/completions) for direct LLM chat interactions.

## Completed Tasks

- [x] Define `HerokuMiaFields` and `HerokuMiaCallOptions` interfaces.
- [x] Implement `HerokuMia` class structure extending `BaseChatModel`.
- [x] Implement `HerokuMia` constructor and initialize properties.
- [x] Implement `_llmType()` method.
- [x] Implement `invocationParams()` method.
- [x] Implement `_generate()` method (core logic: fetch, retry, non-streaming/aggregated-streaming response parsing, error handling).
- [x] Implement `_stream()` method (core logic: fetch, retry, SSE parsing, yielding AIMessageChunks).
- [x] Implement request formatting for `/v1/chat/completions`.
- [x] Implement response parsing (standard and streaming).
- [x] Implement function calling support (tool definition, passing tools, handling `tool_calls` and `tool_call_chunks`).
- [x] Implement `invoke()` method (implicitly via `BaseChatModel` using `_generate()`).
- [x] Implement `batch()` method (relies on `BaseChatModel` default behavior).
- [x] Assessed `getNumTokens()` (deferred due to lack of reliable tokenization strategy).
- [x] Reviewed error handling for `/v1/chat/completions` (current implementation is robust; further refinements need more API specifics).

## In Progress Tasks

(None remaining for HerokuMia core features)

## Future Tasks

- [ ] Unit tests for `HerokuMia`.
- [ ] Integration tests for `HerokuMia` (mocking Heroku API).

## Implementation Plan

Follow `SPECS.md` section 2. The class will extend `BaseChatModel` from `@langchain/core`. Key methods include `invoke`, `stream`, `batch`, and the internal `_generate`. It needs to handle request formatting, response parsing (including SSE for streaming), and function tool integration as per Heroku's API.

## Relevant files

- `src/heroku-mia.ts` - Main implementation of the HerokuMia class.
- `src/types.ts` - Shared type definitions, including those for Heroku API request/response structures if not covered by LangChain.
- `SPECS.md` - Technical specification document.
