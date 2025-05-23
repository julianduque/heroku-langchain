# HerokuMiaAgent (Agents) Implementation

Brief description of the feature and its purpose.

Integration with Heroku's Managed Agents API (/v1/agents/heroku) for agentic interactions with server-side tool execution.

## Completed Tasks

- [x] Define `HerokuMiaAgentFields` and `HerokuMiaAgentCallOptions` interfaces (in `src/types.ts`).
- [x] Define `HerokuAgentToolDefinition` interface (in `src/types.ts`).
- [x] Define Heroku Agent API request/response/stream payload types (in `src/types.ts`).
- [x] Implement `HerokuMiaAgent` class structure extending `BaseChatModel` (in `src/heroku-mia-agent.ts`).
- [x] Implement `HerokuMiaAgent` constructor and initialize properties.
- [x] Implement `_llmType()` method.
- [x] Implement `invocationParams()` method (basic structure).
- [x] Implement `_generate()` method (core logic: API call to `/invoke`, response parsing, error handling).
- [x] Implement request formatting for Heroku Agent API (`/invoke` path - messages, metadata, session_id).
- [x] Implement `_stream()` method (core logic: API call to `/stream`, SSE parsing for various agent events, mapping to `AIMessageChunk`, error handling).
- [x] Implement request formatting for Heroku Agent API (`/stream` path).
- [x] Implement SSE response parsing for `message.delta`, `tool.call`, `tool.completion`, `tool.error`, `agent.error`, `stream.end` events within `_stream()`.
- [x] Map agent SSE events to LangChain `AIMessageChunk` (using `additional_kwargs` for non-standard data like tool results/errors).
- [x] Handle server-side tool execution results (`tool.completion`, `tool.error`) by yielding AIMessageChunks with event data in `additional_kwargs`.

## In Progress Tasks

- [ ] Refine how `tool.completion` and `tool.error` AIMessageChunks are consumed/interpreted by a LangChain AgentExecutor (this is more of an integration/usage concern than a direct implementation issue for `HerokuMiaAgent` itself, but worth noting).

## Future Tasks

- [ ] Unit tests for `HerokuMiaAgent`.
- [ ] Integration tests for `HerokuMiaAgent` (mocking Heroku Agent API).

## Implementation Plan

Follow `SPECS.md` section 3. The class will extend `BaseChatModel`. Key methods are `_generate` (for `/invoke`) and `_stream` (for `/stream`). The main challenge is handling the complex SSE stream from `/v1/agents/heroku/stream` which includes various event types like `message.delta`, `tool.call`, `tool.completion`, `tool.error`, and `stream.end`. These need to be parsed and mapped to appropriate LangChain message chunks or agent actions/observations.

## Relevant files

- `src/heroku-mia-agent.ts` - Main implementation of the `HerokuMiaAgent` class.
- `src/types.ts` - Shared type definitions, including those for Heroku Agent API.
- `SPECS.md` - Technical specification document.
