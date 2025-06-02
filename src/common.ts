import {
  BaseMessage,
  AIMessage,
  ToolMessage,
  FunctionMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import type {
  HerokuChatMessage,
  HerokuFunctionTool,
  HerokuChatMessageRole,
  HerokuToolMessageContent,
} from "./types.js";

/**
 * Default Heroku Inference API base URL.
 * Used when no custom API URL is provided in configuration.
 */
export const DEFAULT_INFERENCE_URL = "https://us.inference.heroku.com";

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
export function getHerokuConfigOptions(
  apiKey?: string,
  apiUrl?: string,
  apiEndpoint?: string,
): HerokuConfigOptions {
  return getHerokuConfigOptionsWithEnvKeys(
    apiKey,
    apiUrl,
    apiEndpoint,
    "INFERENCE_KEY",
    "INFERENCE_URL",
  );
}

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
export function getHerokuConfigOptionsWithEnvKeys(
  apiKey?: string,
  apiUrl?: string,
  apiEndpoint?: string,
  envKeyName: string = "INFERENCE_KEY",
  envUrlName: string = "INFERENCE_URL",
): HerokuConfigOptions {
  const resolvedApiKey = apiKey ?? process.env[envKeyName];
  if (!resolvedApiKey) {
    throw new Error(
      `Heroku API key not found. Please set the ${envKeyName} environment variable or pass it to the constructor.`,
    );
  }

  const resolvedApiUrlBase =
    apiUrl ?? process.env[envUrlName] ?? DEFAULT_INFERENCE_URL;
  // Ensure no double slashes if apiEndpoint starts with one and resolvedApiUrlBase ends with one
  const finalApiUrl = `${resolvedApiUrlBase.replace(/\/$/, "")}${apiEndpoint ?? ""}`;

  return {
    apiKey: resolvedApiKey,
    apiUrl: finalApiUrl,
    apiEndpoint: apiEndpoint ?? "", // Store for potential future use if needed separately
  };
}

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
export class HerokuApiError extends Error {
  /**
   * Creates a new HerokuApiError instance.
   *
   * @param message - Human-readable error message
   * @param status - HTTP status code from the API response (optional)
   * @param errorResponse - Raw error response from the API for debugging (optional)
   */
  constructor(
    message: string,
    public status?: number,
    public errorResponse?: any,
  ) {
    super(message);
    this.name = "HerokuApiError";
    Object.setPrototypeOf(this, HerokuApiError.prototype);
  }
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
export function langchainMessagesToHerokuMessages(
  messages: BaseMessage[],
): HerokuChatMessage[] {
  return messages.map((message): HerokuChatMessage => {
    let role: HerokuChatMessageRole;
    let content: string | HerokuToolMessageContent[] = "";
    const additionalArgs: Record<string, any> = {};

    if (message instanceof HumanMessage) {
      role = "user";
      content = message.content as string;
    } else if (message instanceof AIMessage) {
      role = "assistant";
      const aiMessage = message as AIMessage;
      content = aiMessage.content as string;
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        additionalArgs.tool_calls = aiMessage.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments:
              typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args),
          },
        }));
      }
    } else if (message instanceof SystemMessage) {
      role = "system";
      content = message.content as string;
    } else if (message instanceof ToolMessage) {
      role = "tool";
      const toolMessage = message as ToolMessage;
      content = toolMessage.content as string;
      return {
        role,
        content,
        tool_call_id: toolMessage.tool_call_id,
      };
    } else if (message instanceof FunctionMessage) {
      role = "tool";
      const funcMessage = message as FunctionMessage;
      content = funcMessage.content as string;
      return {
        role,
        content,
        name: funcMessage.name,
      };
    } else {
      // This case should ideally not be reached if all message types are handled.
      // Consider throwing an error or logging a more specific warning.
      console.warn(
        `Unknown message instance type: ${message.constructor.name}`,
      );
      role = "user"; // Fallback role
      content = message.content as string; // Fallback content extraction
    }

    const herokuMessage: HerokuChatMessage = {
      role,
      content,
    };

    if (Object.keys(additionalArgs).length > 0) {
      Object.assign(herokuMessage, additionalArgs);
    }

    // For assistant messages, tool_calls is directly on the message object
    // For tool messages, tool_call_id is directly on the message object
    // System and User messages don't have these.
    // The `name` field in Heroku messages can be used for the function name in a tool_call (assistant) or
    // potentially for the function name if a FunctionMessage is passed (though ToolMessage is preferred).

    return herokuMessage;
  });
}

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
export function langchainToolsToHerokuTools(
  tools: StructuredTool[],
): HerokuFunctionTool[] {
  if (!tools || tools.length === 0) {
    return [];
  }
  return tools.map((tool) => {
    const openAIFunction = convertToOpenAIFunction(tool);
    let herokuParams: HerokuFunctionTool["function"]["parameters"];

    if (
      openAIFunction.parameters &&
      typeof openAIFunction.parameters === "object"
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { $schema, ...params } = openAIFunction.parameters as any;
      if (
        params &&
        typeof params === "object" &&
        params.type &&
        params.properties
      ) {
        herokuParams = params as HerokuFunctionTool["function"]["parameters"];
      } else {
        herokuParams = { type: "object", properties: {} };
      }
    } else {
      herokuParams = { type: "object", properties: {} };
    }

    // If convertToOpenAIFunction doesn't yield a name from the StructuredTool,
    // default to "extract". This is based on the error message showing that
    // LangChain Core's withStructuredOutput parser is looking for a tool call named "extract".
    const functionName = openAIFunction.name || "extract";

    const functionDescription =
      openAIFunction.description || "Extract structured data."; // Default description

    return {
      type: "function",
      function: {
        name: functionName,
        description: functionDescription,
        parameters: herokuParams,
      },
    };
  });
}

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
export async function* parseHerokuSSE(
  stream: ReadableStream<Uint8Array>,
  onDone?: () => void,
  onError?: (error: any) => void,
): AsyncGenerator<ParsedSSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let currentEventName: string | undefined = undefined;
  let currentDataLines: string[] = [];
  let currentId: string | undefined = undefined;
  // let currentRetry: number | undefined = undefined; // Retry is usually for client reconnection logic, not part of each event data.

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        if (currentDataLines.length > 0) {
          yield {
            event: currentEventName,
            data: currentDataLines.join("\n"),
            id: currentId,
            // retry: currentRetry, // Not typically yielded per event
          };
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let lineEndIndex;

      while ((lineEndIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.substring(0, lineEndIndex).replace(/\r$/, "");
        buffer = buffer.substring(lineEndIndex + 1);

        if (line.trim() === "") {
          if (currentDataLines.length > 0) {
            yield {
              event: currentEventName,
              data: currentDataLines.join("\n"),
              id: currentId,
              // retry: currentRetry,
            };
            currentEventName = undefined;
            currentDataLines = [];
            currentId = undefined;
            // currentRetry = undefined;
          }
          continue;
        }

        if (line.startsWith(":")) {
          // Comment line
          continue;
        }

        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) {
          // Invalid line without a colon (unless it's a field name with empty value, which is rare)
          continue;
        }

        const field = line.substring(0, colonIndex);
        let fieldValue = line.substring(colonIndex + 1);
        if (fieldValue.startsWith(" ")) {
          fieldValue = fieldValue.substring(1);
        }

        if (field === "event") {
          currentEventName = fieldValue;
        } else if (field === "data") {
          currentDataLines.push(fieldValue);
        } else if (field === "id") {
          currentId = fieldValue;
        } else if (field === "retry") {
          // This is a client instruction, not typically part of the event data itself.
          // const retryVal = parseInt(fieldValue, 10);
          // if (!isNaN(retryVal)) { currentRetry = retryVal; }
        }
      }
    }
  } catch (error: any) {
    if (onError) {
      onError(error);
    } else {
      console.error("Error reading or parsing SSE stream:", error);
      throw new HerokuApiError(
        "Failed to process SSE stream",
        undefined,
        error,
      );
    }
  } finally {
    if (stream.locked) {
      try {
        // Best effort to cancel if the reader is still active due to error or premature exit
        // Releasing the lock is important if the stream is to be used again (though usually not for fetch bodies)
        await reader.cancel(); // This will also implicitly release the lock
      } catch (cancelError) {
        // console.warn("Error cancelling SSE stream reader:", cancelError);
        // If cancelling fails, try to release lock directly if it's still somehow locked.
        // However, .cancel() should handle release. This is being cautious.
        try {
          reader.releaseLock();
        } catch (releaseLockError) {
          // console.warn("Error releasing lock on SSE stream reader:", releaseLockError);
        }
      }
    }
    if (onDone) {
      onDone();
    }
  }
}
