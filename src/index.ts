// Core Model Classes
export { HerokuMia } from "./heroku-mia.js";
export { HerokuMiaAgent } from "./heroku-mia-agent.js";

// Common Error Classes
export { HerokuApiError } from "./common.js";

// Type Definitions for HerokuMia (Chat Completions)
export type {
  HerokuMiaFields,
  HerokuMiaCallOptions,
  HerokuChatMessageRole,
  HerokuToolCall,
  HerokuToolMessageContent,
  HerokuChatMessage,
  HerokuFunctionToolParameters,
  HerokuFunctionTool,
  HerokuChatCompletionRequest,
  HerokuChatCompletionChoice,
  HerokuChatCompletionUsage,
  HerokuChatCompletionResponse,
  HerokuChatCompletionStreamChoiceDelta,
  HerokuChatCompletionStreamChoice,
  HerokuChatCompletionStreamResponse,
  LocalToolCallChunk, // If this is intended to be part of the public API for consumers handling streams
} from "./types.js";

// Type Definitions for HerokuMiaAgent (Agents)
export type {
  HerokuMiaAgentFields,
  HerokuMiaAgentCallOptions,
  HerokuAgentToolDefinition,
  HerokuAgentInvokeRequest,
  HerokuAgentInvokeResponse,
  HerokuAgentStreamRequest,
  // Agent SSE Event Data Types (if consumers need to parse additional_kwargs from AIMessageChunk)
  HerokuAgentMessageDeltaEvent,
  HerokuAgentToolCallEvent,
  HerokuAgentToolCompletionEvent,
  HerokuAgentToolErrorEvent,
  HerokuAgentAgentErrorEvent,
  HerokuAgentStreamEndEvent,
  HerokuAgentSSEData, // Union type for agent SSE data
} from "./types.js";
