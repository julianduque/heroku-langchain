/**
 * Heroku LangChain Integration
 *
 * This package provides LangChain-compatible integrations for Heroku's Managed Inference API (Mia),
 * enabling developers to use Heroku's hosted language models, agents, and embeddings within
 * LangChain applications.
 *
 * Key features:
 * - **Chat Models**: Access to various LLMs via HerokuMia class
 * - **Agents**: Intelligent agents with tool execution via HerokuMiaAgent class
 * - **Embeddings**: Text embeddings generation via HerokuMiaEmbeddings class
 * - **Function Calling**: Support for structured tools and function calling
 * - **Streaming**: Real-time response streaming for all models
 * - **Error Handling**: Robust error handling with retry logic
 *
 * @example Basic Usage
 * ```typescript
 * import { HerokuMia, HerokuMiaEmbeddings } from "heroku-langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 *
 * // Chat completion
 * const model = new HerokuMia({
 *   model: "gpt-oss-120b",
 *   apiKey: process.env.INFERENCE_KEY
 * });
 *
 * const response = await model.invoke([
 *   new HumanMessage("Explain quantum computing")
 * ]);
 *
 * // Text embeddings
 * const embeddings = new HerokuMiaEmbeddings({
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
 * HerokuMia - Chat model for Heroku's Managed Inference API
 *
 * Provides access to various language models hosted on Heroku's infrastructure
 * with support for function calling, structured outputs, and streaming responses.
 *
 * @see {@link HerokuMia} for detailed documentation
 */
export { HerokuMia } from "./heroku-mia.js";
/**
 * HerokuMiaAgent - Intelligent agent with tool execution capabilities
 *
 * Provides access to Heroku's agent API that can execute tools and perform
 * complex multi-step reasoning tasks with Heroku-specific and MCP tools.
 *
 * @see {@link HerokuMiaAgent} for detailed documentation
 */
export { HerokuMiaAgent } from "./heroku-mia-agent.js";
/**
 * HerokuMiaEmbeddings - Text embeddings for similarity search and RAG
 *
 * Provides access to various embedding models for generating vector representations
 * of text, supporting different input types and encoding formats.
 *
 * @see {@link HerokuMiaEmbeddings} for detailed documentation
 */
export { HerokuMiaEmbeddings } from "./heroku-mia-embeddings.js";
// Common Error Classes
/**
 * Custom error class for Heroku API errors with status codes and response details.
 * @see {@link HerokuApiError}
 */
export { HerokuApiError } from "./common.js";
//# sourceMappingURL=index.js.map