/**
 * Heroku LangChain Integration
 *
 * This package provides LangChain-compatible integrations for Heroku's Managed Inference API (Mia),
 * enabling developers to use Heroku's hosted language models, agents, and embeddings within
 * LangChain applications.
 *
 * Key features:
 * - **Chat Models**: Access to various LLMs via ChatHeroku class
 * - **Agents**: Intelligent agents with tool execution via HerokuAgent class
 * - **Embeddings**: Text embeddings generation via HerokuEmbeddings class
 * - **Function Calling**: Support for structured tools and function calling
 * - **Streaming**: Real-time response streaming for all models
 * - **Error Handling**: Robust error handling with retry logic
 *
 * @example Basic Usage
 * ```typescript
 * import { ChatHeroku, HerokuEmbeddings } from "heroku-langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 *
 * // Chat completion
 * const model = new ChatHeroku({
 *   model: "gpt-oss-120b",
 *   apiKey: process.env.INFERENCE_KEY
 * });
 *
 * const response = await model.invoke([
 *   new HumanMessage("Explain quantum computing")
 * ]);
 *
 * // Text embeddings
 * const embeddings = new HerokuEmbeddings({
 *   model: "cohere-embed-multilingual",
 *   apiKey: process.env.EMBEDDING_KEY
 * });
 *
 * const vectors = await embeddings.embedDocuments([
 *   "Hello world",
 *   "LangChain is awesome"
 * ]);
 * ```
 *
 * @author Julián Duque <jduque@heroku.com>
 * @since 0.1.2
 * @license Apache-2.0
 * @packageDocumentation
 */

// Core Model Classes
/**
 * ChatHeroku - Chat model for Heroku's Managed Inference API
 *
 * Provides access to various language models hosted on Heroku's infrastructure
 * with support for function calling, structured outputs, and streaming responses.
 *
 * @see {@link ChatHeroku} for detailed documentation
 */
export { ChatHeroku } from "./chat.js";

/**
 * @deprecated Use ChatHeroku instead.
 */
export { ChatHeroku as HerokuMia } from "./chat.js";

/**
 * Configuration options and parameter types for structured output functionality.
 * @see {@link StructuredOutputMethodOptions}
 * @see {@link StructuredOutputMethodParams}
 */
export type {
  StructuredOutputMethodOptions,
  StructuredOutputMethodParams,
} from "./chat.js";

/**
 * HerokuAgent - Intelligent agent with tool execution capabilities
 *
 * Provides access to Heroku's agent API that can execute tools and perform
 * complex multi-step reasoning tasks with Heroku-specific and MCP tools.
 *
 * @see {@link HerokuAgent} for detailed documentation
 */
export { HerokuAgent } from "./heroku-agent.js";
export { createHerokuAgent } from "./create-heroku-agent.js";

/**
 * @deprecated Use HerokuAgent instead.
 */
export { HerokuAgent as HerokuMiaAgent } from "./heroku-agent.js";

/**
 * HerokuEmbeddings - Text embeddings for similarity search and RAG
 *
 * Provides access to various embedding models for generating vector representations
 * of text, supporting different input types and encoding formats.
 *
 * @see {@link HerokuEmbeddings} for detailed documentation
 */
export { HerokuEmbeddings } from "./embeddings.js";

// Common Error Classes
/**
 * Custom error class for Heroku API errors with status codes and response details.
 * @see {@link HerokuApiError}
 */
export { HerokuApiError } from "./common.js";

// Type Definitions for ChatHeroku (Chat Completions)
/**
 * Configuration options for creating a ChatHeroku instance.
 * @see {@link ChatHerokuFields}
 */
export type {
  ChatHerokuFields,
  ChatHerokuCallOptions,
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

/**
 * @deprecated Use ChatHerokuFields and ChatHerokuCallOptions instead.
 */
export type {
  ChatHerokuFields as HerokuMiaFields,
  ChatHerokuCallOptions as HerokuMiaCallOptions,
} from "./types.js";

// Type Definitions for HerokuAgent (Agents)
/**
 * Configuration options for creating a HerokuAgent instance.
 * @see {@link HerokuAgentFields}
 */
export type {
  HerokuAgentFields,
  HerokuAgentCallOptions,
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

// Type Definitions for HerokuEmbeddings (Embeddings)
/**
 * Configuration options for creating a HerokuEmbeddings instance.
 * @see {@link HerokuEmbeddingsFields}
 */
export type {
  HerokuEmbeddingsFields,
  HerokuEmbeddingsCallOptions,
  HerokuEmbeddingsRequest,
  HerokuEmbeddingObject,
  HerokuEmbeddingsUsage,
  HerokuEmbeddingsResponse,
} from "./types.js";

/**
 * @deprecated Use HerokuEmbeddingsFields instead.
 */
export type {
  HerokuEmbeddingsFields as HerokuMiaEmbeddingsFields,
  HerokuEmbeddingsCallOptions as HerokuMiaEmbeddingsCallOptions,
} from "./types.js";
