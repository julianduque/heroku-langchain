# Shared Library Functionality Implementation

Brief description of the feature and its purpose.

Common utilities and types for `@langchain/heroku` library, supporting both `HerokuMia` and `HerokuMiaAgent`.

## Completed Tasks

- [x] Implement centralized authentication (API key, API URL handling via `getHerokuConfigOptions`).
- [x] Define common TypeScript types for Heroku API structures (e.g., `HerokuChatMessage`, `HerokuToolCall`, request/response/stream payloads for chat completions).
- [x] Set up shared error classes (e.g., `HerokuApiError`).
- [x] Create message transformation utilities (LangChain `BaseMessage` to/from Heroku format - `langchainMessagesToHerokuMessages`).
- [x] Create tool format conversion utility (for `HerokuMia` function tools - `langchainToolsToHerokuTools`).
- [x] Create SSE parsing utility (`parseHerokuSSE`).

## In Progress Tasks

## Future Tasks

- [x] Unit tests for all shared utilities.

## Implementation Plan

Follow `SPECS.md` section 4. Develop a module for shared functionalities like API authentication (reading from env vars or constructor), base URL management, common type definitions for Heroku's API schema, SSE parsing, and message/tool format conversions. This will reduce duplication between `HerokuMia` and `HerokuMiaAgent`.

## Relevant files

- `src/common.ts` (or `src/utils.ts`) - Implementation of shared utilities.
- `src/types.ts` - Common TypeScript type definitions for the library.
- `SPECS.md` - Technical specification document.
