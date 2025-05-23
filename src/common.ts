import {
  BaseMessage,
  AIMessage,
  ToolMessage,
  FunctionMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import {
  HerokuChatMessage,
  HerokuChatMessageRole,
  HerokuToolMessageContent,
} from "./types";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { HerokuFunctionTool } from "./types";

export const DEFAULT_INFERENCE_URL = "https://us.inference.heroku.com";

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
export function getHerokuConfigOptions(
  apiKey?: string,
  apiUrl?: string,
  apiEndpoint?: string,
): HerokuConfigOptions {
  const resolvedApiKey = apiKey ?? process.env.INFERENCE_KEY;
  if (!resolvedApiKey) {
    throw new Error(
      "Heroku API key not found. Please set the INFERENCE_KEY environment variable or pass it to the constructor.",
    );
  }

  const resolvedApiUrlBase =
    apiUrl ?? process.env.INFERENCE_URL ?? DEFAULT_INFERENCE_URL;
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
 */
export class HerokuApiError extends Error {
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

// Placeholder for message transformation utility
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
 * Heroku's function tool format is similar to OpenAI's.
 * @param tools Array of StructuredTool instances.
 * @returns Array of HerokuFunctionTool definitions.
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
