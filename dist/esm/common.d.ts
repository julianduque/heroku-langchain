import { BaseMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import type { HerokuChatMessage, HerokuFunctionTool } from "./types.js";
/**
 * Default Heroku Inference API base URL.
 * Used when no custom API URL is provided in configuration.
 */
export declare const DEFAULT_INFERENCE_URL = "https://us.inference.heroku.com";
/**
 * Configuration options for Heroku API requests.
 * Contains the resolved API key, full URL, and endpoint path.
 */
export interface HerokuConfigOptions {
    /** The resolved Heroku API key for authentication */
    apiKey: string;
    /** The complete API URL including base URL and endpoint path */
    apiUrl: string;
    /** The API endpoint path (e.g., "/v1/chat/completions") */
    apiEndpoint: string;
}
/**
 * Resolves the Heroku API key and URL using default environment variable names.
 *
 * This is a convenience function that uses standard Heroku environment variables:
 * - INFERENCE_KEY for the API key
 * - INFERENCE_URL for the base URL
 *
 * Priority order:
 * 1. Explicitly passed values
 * 2. Environment variables (INFERENCE_KEY, INFERENCE_URL)
 * 3. Default API URL if not specified
 *
 * @param apiKey - Optional Heroku API Key. If not provided, uses INFERENCE_KEY env var
 * @param apiUrl - Optional Heroku API Base URL. If not provided, uses INFERENCE_URL env var or default
 * @param apiEndpoint - The specific API endpoint path (e.g., "/v1/chat/completions")
 * @returns The resolved API configuration
 * @throws {Error} If API key is not found in parameters or environment variables
 *
 * @example
 * ```typescript
 * // Using environment variables
 * const config = getHerokuConfigOptions(undefined, undefined, "/v1/chat/completions");
 *
 * // Using explicit values
 * const config = getHerokuConfigOptions("my-key", "https://custom.api.url", "/v1/chat/completions");
 * ```
 */
export declare function getHerokuConfigOptions(apiKey?: string, apiUrl?: string, apiEndpoint?: string): HerokuConfigOptions;
/**
 * Resolves the Heroku API key and URL with configurable environment variable names.
 *
 * This function provides flexibility to use custom environment variable names,
 * which is useful for different Heroku services (inference, embeddings, etc.)
 * that may use different environment variable conventions.
 *
 * Priority order:
 * 1. Explicitly passed values
 * 2. Environment variables (specified by envKeyName and envUrlName)
 * 3. Default API URL if not specified
 *
 * @param apiKey - Optional Heroku API Key
 * @param apiUrl - Optional Heroku API Base URL
 * @param apiEndpoint - The specific API endpoint path (e.g., "/v1/embeddings")
 * @param envKeyName - Name of environment variable for API key (default: "INFERENCE_KEY")
 * @param envUrlName - Name of environment variable for API URL (default: "INFERENCE_URL")
 * @returns The resolved API configuration
 * @throws {Error} If API key is not found in parameters or specified environment variable
 *
 * @example
 * ```typescript
 * // For embeddings with custom env vars
 * const config = getHerokuConfigOptionsWithEnvKeys(
 *   undefined,
 *   undefined,
 *   "/v1/embeddings",
 *   "EMBEDDING_KEY",
 *   "EMBEDDING_URL"
 * );
 *
 * // For custom service
 * const config = getHerokuConfigOptionsWithEnvKeys(
 *   "explicit-key",
 *   "https://custom.heroku.api.url",
 *   "/v1/custom",
 *   "CUSTOM_API_KEY",
 *   "CUSTOM_API_URL"
 * );
 * ```
 */
export declare function getHerokuConfigOptionsWithEnvKeys(apiKey?: string, apiUrl?: string, apiEndpoint?: string, envKeyName?: string, envUrlName?: string): HerokuConfigOptions;
/**
 * Custom error class for Heroku API errors.
 *
 * This error class provides structured error information for debugging and error handling,
 * including HTTP status codes and raw error responses from the Heroku API.
 *
 * @example
 * ```typescript
 * try {
 *   // API call that might fail
 *   await makeHerokuApiCall();
 * } catch (error) {
 *   if (error instanceof HerokuApiError) {
 *     console.error(`Heroku API Error ${error.status}: ${error.message}`);
 *     console.error("Raw response:", error.errorResponse);
 *   }
 * }
 * ```
 */
export declare class HerokuApiError extends Error {
    status?: number | undefined;
    errorResponse?: any | undefined;
    /**
     * Creates a new HerokuApiError instance.
     *
     * @param message - Human-readable error message
     * @param status - HTTP status code from the API response (optional)
     * @param errorResponse - Raw error response from the API for debugging (optional)
     */
    constructor(message: string, status?: number | undefined, errorResponse?: any | undefined);
}
/**
 * Converts LangChain BaseMessage instances to Heroku API message format.
 *
 * This function transforms LangChain's message abstractions into the specific
 * format expected by Heroku's chat completion API, handling different message
 * types and their associated metadata (tool calls, tool results, etc.).
 *
 * Supported message types:
 * - HumanMessage → user role
 * - AIMessage → assistant role (with tool_calls if present)
 * - SystemMessage → system role
 * - ToolMessage → tool role (with tool_call_id)
 * - FunctionMessage → tool role (with function name)
 *
 * @param messages - Array of LangChain BaseMessage instances
 * @returns Array of Heroku-formatted chat messages
 *
 * @example
 * ```typescript
 * import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
 *
 * const messages = [
 *   new SystemMessage("You are a helpful assistant."),
 *   new HumanMessage("What is the weather like?"),
 *   new AIMessage({
 *     content: "I'll check the weather for you.",
 *     tool_calls: [{
 *       id: "call_123",
 *       name: "get_weather",
 *       args: { location: "San Francisco" },
 *       type: "tool_call"
 *     }]
 *   })
 * ];
 *
 * const herokuMessages = langchainMessagesToHerokuMessages(messages);
 * ```
 */
export declare function langchainMessagesToHerokuMessages(messages: BaseMessage[]): HerokuChatMessage[];
/**
 * Converts LangChain StructuredTool instances to Heroku's function tool format.
 *
 * This function transforms LangChain tools into the JSON schema format expected
 * by Heroku's function calling API. It handles schema conversion, parameter
 * cleaning (removing $schema), and provides fallbacks for missing metadata.
 *
 * @param tools - Array of LangChain StructuredTool instances
 * @returns Array of Heroku-formatted function tool definitions
 *
 * @example
 * ```typescript
 * import { DynamicStructuredTool } from "@langchain/core/tools";
 * import { z } from "zod";
 *
 * const weatherTool = new DynamicStructuredTool({
 *   name: "get_weather",
 *   description: "Get current weather for a location",
 *   schema: z.object({
 *     location: z.string().describe("City name"),
 *     units: z.enum(["celsius", "fahrenheit"]).optional()
 *   }),
 *   func: async ({ location, units }) => {
 *     return `Weather in ${location}: 22°${units === "fahrenheit" ? "F" : "C"}`;
 *   }
 * });
 *
 * const herokuTools = langchainToolsToHerokuTools([weatherTool]);
 * ```
 */
export declare function langchainToolsToHerokuTools(tools: StructuredTool[]): HerokuFunctionTool[];
/**
 * Represents a parsed Server-Sent Event.
 *
 * This interface defines the structure of SSE events after parsing the raw stream data.
 * Server-Sent Events are used by Heroku's streaming APIs to send real-time updates.
 */
export interface ParsedSSEEvent {
    /** The event type (optional, from "event:" field) */
    event?: string;
    /** The event data (from "data:" field) */
    data: string;
    /** The event ID (optional, from "id:" field) */
    id?: string;
    /** Retry interval in milliseconds (optional, from "retry:" field) */
    retry?: number;
}
/**
 * Parses a ReadableStream of Uint8Array chunks as Server-Sent Events.
 *
 * This function processes SSE streams from Heroku APIs, handling the SSE protocol
 * specification including event fields, data accumulation, and proper stream cleanup.
 * It's designed to work with fetch response bodies and provides proper error handling.
 *
 * SSE Protocol Support:
 * - event: Sets the event type
 * - data: Accumulates event data (multiple data lines are joined with newlines)
 * - id: Sets the event ID
 * - retry: Sets client reconnection interval (parsed but not used internally)
 * - Comments (lines starting with ":") are ignored
 *
 * @param stream - The ReadableStream from a fetch response (response.body)
 * @param onDone - Optional callback when the stream is finished
 * @param onError - Optional callback for errors during stream processing
 * @yields Parsed SSE events as they are received
 *
 * @example
 * ```typescript
 * const response = await fetch("https://api.heroku.com/v1/stream");
 *
 * for await (const event of parseHerokuSSE(response.body!)) {
 *   if (event.event === "message") {
 *     const data = JSON.parse(event.data);
 *     console.log("Received:", data);
 *   } else if (event.event === "done") {
 *     console.log("Stream completed");
 *     break;
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * try {
 *   for await (const event of parseHerokuSSE(
 *     response.body!,
 *     () => console.log("Stream finished"),
 *     (error) => console.error("Stream error:", error)
 *   )) {
 *     // Process events
 *   }
 * } catch (error) {
 *   console.error("Fatal stream error:", error);
 * }
 * ```
 *
 * @throws {HerokuApiError} For stream processing errors or parsing failures
 */
export declare function parseHerokuSSE(stream: ReadableStream<Uint8Array>, onDone?: () => void, onError?: (error: any) => void): AsyncGenerator<ParsedSSEEvent>;
//# sourceMappingURL=common.d.ts.map