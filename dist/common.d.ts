import { BaseMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import type { HerokuChatMessage, HerokuFunctionTool } from "./types.js";
export declare const DEFAULT_INFERENCE_URL = "https://us.inference.heroku.com";
export interface HerokuConfigOptions {
    apiKey: string;
    apiUrl: string;
    apiEndpoint: string;
}
/**
 * Resolves the Heroku API key and URL.
 * Priority:
 * 1. Explicitly passed values.
 * 2. Environment variables (INFERENCE_KEY, INFERENCE_URL).
 * 3. Default API URL if not specified.
 *
 * @param apiKey Optional Heroku API Key.
 * @param apiUrl Optional Heroku API Base URL.
 * @param apiEndpoint The specific API endpoint path (e.g., "/v1/chat/completions").
 * @returns The resolved API key and final API URL.
 * @throws Error if API key is not found.
 */
export declare function getHerokuConfigOptions(apiKey?: string, apiUrl?: string, apiEndpoint?: string): HerokuConfigOptions;
/**
 * Custom error class for Heroku API errors.
 */
export declare class HerokuApiError extends Error {
    status?: number | undefined;
    errorResponse?: any | undefined;
    constructor(message: string, status?: number | undefined, errorResponse?: any | undefined);
}
export declare function langchainMessagesToHerokuMessages(messages: BaseMessage[]): HerokuChatMessage[];
/**
 * Converts LangChain StructuredTool instances to Heroku's function tool format.
 * Heroku's function tool format is similar to OpenAI's.
 * @param tools Array of StructuredTool instances.
 * @returns Array of HerokuFunctionTool definitions.
 */
export declare function langchainToolsToHerokuTools(tools: StructuredTool[]): HerokuFunctionTool[];
/**
 * Represents a parsed Server-Sent Event.
 */
export interface ParsedSSEEvent {
    event?: string;
    data: string;
    id?: string;
    retry?: number;
}
/**
 * Parses a ReadableStream of Uint8Array chunks as Server-Sent Events.
 * Yields parsed event objects.
 *
 * @param stream The ReadableStream from a fetch response (response.body).
 * @param onDone Optional callback when the stream is finished.
 * @param onError Optional callback for errors during stream processing.
 */
export declare function parseHerokuSSE(stream: ReadableStream<Uint8Array>, onDone?: () => void, onError?: (error: any) => void): AsyncGenerator<ParsedSSEEvent>;
