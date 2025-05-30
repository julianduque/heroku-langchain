import {
  BaseChatModel,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  BaseMessage,
  AIMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { ChatResult, ChatGeneration } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  HerokuMiaAgentFields,
  HerokuMiaAgentCallOptions,
  HerokuAgentStreamRequest,
  // Import Agent SSE event types
  HerokuAgentToolCallEvent,
  HerokuAgentToolErrorEvent,
  HerokuAgentAgentErrorEvent,
  LocalToolCallChunk, // Also import LocalToolCallChunk for tool.call handling
  // HerokuAgentSSEData, // Will be used for parsing stream
  // HerokuAgentToolDefinition // If needed for request
} from "./types";
import {
  getHerokuConfigOptions,
  langchainMessagesToHerokuMessages,
  HerokuApiError,
  parseHerokuSSE,
  // langchainToolsToHerokuTools, // If agent uses same tool format
} from "./common";

export class HerokuMiaAgent extends BaseChatModel<HerokuMiaAgentCallOptions> {
  protected model: string;
  protected temperature?: number;
  protected maxTokensPerRequest?: number;
  protected stop?: string[];
  protected topP?: number;
  protected tools?: any[];
  protected apiKey?: string;
  protected apiUrl?: string;
  protected maxRetries?: number;
  protected timeout?: number;
  protected streaming?: boolean; // For consistency, though agent might always stream or have specific stream endpoint
  protected streamUsage?: boolean; // Explicitly tell BaseChatModel to use _stream
  protected additionalKwargs?: Record<string, any>;

  static lc_name() {
    return "HerokuMiaAgent";
  }

  constructor(fields: HerokuMiaAgentFields) {
    super(fields);

    const modelFromEnv =
      typeof process !== "undefined" &&
      process.env &&
      process.env.INFERENCE_MODEL_ID;
    this.model = fields.model || modelFromEnv || "";
    if (!this.model) {
      throw new Error(
        "Heroku model ID not found. Please set it in the constructor, " +
          "or set the INFERENCE_MODEL_ID environment variable.",
      );
    }

    this.temperature = fields.temperature ?? 1.0;
    this.maxTokensPerRequest = fields.maxTokensPerRequest;
    this.stop = fields.stop;
    this.topP = fields.topP ?? 0.999;
    this.tools = fields.tools; // Assuming tools are passed in constructor

    this.apiKey = fields.apiKey;
    this.apiUrl = fields.apiUrl;
    this.maxRetries = fields.maxRetries ?? 2;
    this.timeout = fields.timeout;
    // Agent API is always streaming, so set this to true.
    this.streaming = true;
    // Set streamUsage to false so stream() calls _stream() directly to preserve heroku_agent_event
    this.streamUsage = false;
    this.additionalKwargs = (fields as any).additionalKwargs ?? {};
  }

  _llmType(): string {
    return "HerokuMiaAgent";
  }

  /**
   * Get the parameters used to invoke the agent.
   * This will need to be adapted for agent-specific parameters vs. chat completion.
   */
  invocationParams(options?: Partial<HerokuMiaAgentCallOptions>): Omit<
    HerokuMiaAgentFields,
    keyof BaseChatModelParams
  > & {
    [key: string]: any;
  } {
    const constructorParams = {
      model: this.model,
      temperature: this.temperature,
      max_tokens_per_inference_request: this.maxTokensPerRequest,
      stop: this.stop,
      top_p: this.topP,
      tools: this.tools,
      // ...this.additionalKwargs, // Spread constructor additionalKwargs
    };

    let runtimeParams: Partial<HerokuMiaAgentCallOptions> = {};
    if (options) {
      // Agent-specific runtime options like metadata or sessionId
      if (options.metadata) runtimeParams.metadata = options.metadata;
      if (options.sessionId) runtimeParams.sessionId = options.sessionId;

      // If BaseChatModelCallOptions like 'stop' are relevant for agents, handle them.
      // For now, assuming agent doesn't use 'stop' sequences like a raw LLM.
      // if (options.stop) runtimeParams.stop = options.stop;

      if (options.additionalKwargs) {
        // Merge, ensuring runtime additionalKwargs takes precedence
        runtimeParams = { ...runtimeParams, ...options.additionalKwargs };
      }
    }

    // Combine, with runtime options overriding constructor additionalKwargs if names clash
    return {
      ...this.additionalKwargs, // Start with constructor's additionalKwargs
      ...constructorParams, // Add core constructor params
      ...runtimeParams, // Override with runtime params (including runtime additionalKwargs)
    } as any;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const stream = this._stream(messages, options, runManager);

    let aggregatedContent = "";
    const toolCallChunks: LocalToolCallChunk[] = [];
    let finalAIMessageChunk: AIMessageChunk | undefined;
    let finish_reason: string | null = null;
    const additional_kwargs: Record<string, any> = {};

    for await (const chunk of stream) {
      if (chunk.content) {
        aggregatedContent += chunk.content;
      }
      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        for (const tcChunk of chunk.tool_call_chunks) {
          toolCallChunks.push(tcChunk as LocalToolCallChunk);
        }
      }
      if (chunk.additional_kwargs) {
        // Merge additional_kwargs from chunks
        Object.assign(additional_kwargs, chunk.additional_kwargs);
        if (
          chunk.additional_kwargs.finish_reason &&
          typeof chunk.additional_kwargs.finish_reason === "string"
        ) {
          finish_reason = chunk.additional_kwargs.finish_reason;
        }
      }
      finalAIMessageChunk = chunk;
    }

    // Manually construct tool_calls from aggregated tool_call_chunks
    // This requires careful merging if chunks for the same tool call are split.
    // For simplicity, assuming chunks are somewhat complete or can be grouped by id.
    const aggregatedToolCalls: {
      id: string;
      name: string;
      args: any;
      type: "tool_call";
    }[] = [];
    const toolCallMap = new Map<
      string,
      { name?: string; args?: string; id?: string }
    >();

    toolCallChunks.forEach((chunk) => {
      if (!chunk.id) return; // Skip chunks without an id
      let entry = toolCallMap.get(chunk.id);
      if (!entry) {
        entry = { id: chunk.id };
        toolCallMap.set(chunk.id, entry);
      }
      if (chunk.name) entry.name = chunk.name;
      if (chunk.args) {
        entry.args = (entry.args || "") + chunk.args; // Concatenate args, assuming they are parts of a JSON string
      }
    });

    toolCallMap.forEach((assembledTc) => {
      if (assembledTc.id && assembledTc.name && assembledTc.args) {
        try {
          aggregatedToolCalls.push({
            id: assembledTc.id,
            name: assembledTc.name,
            args: JSON.parse(assembledTc.args), // Parse the assembled JSON string args
            type: "tool_call" as const,
          });
        } catch (e) {
          console.warn(
            `Failed to parse tool call arguments for id ${assembledTc.id}: ${assembledTc.args}`,
            e,
          );
          // Optionally, add it with raw args or skip
          aggregatedToolCalls.push({
            id: assembledTc.id,
            name: assembledTc.name,
            args: assembledTc.args, // Keep as string if parsing failed
            type: "tool_call" as const,
          });
        }
      }
    });

    // Also check for tool calls in additional_kwargs (Heroku Agent pattern)
    // If we have tool_call_id, tool_name, and tool_result, synthesize a tool call
    if (additional_kwargs.tool_call_id && additional_kwargs.tool_name) {
      // Check if we already have this tool call from chunks
      const existingToolCall = aggregatedToolCalls.find(
        (tc) => tc.id === additional_kwargs.tool_call_id,
      );
      if (!existingToolCall) {
        aggregatedToolCalls.push({
          id: additional_kwargs.tool_call_id,
          name: additional_kwargs.tool_name,
          args: {}, // We don't have the original args, so use empty object
          type: "tool_call" as const,
        });
      }
    }

    const message = new AIMessage({
      content: aggregatedContent,
      tool_calls:
        aggregatedToolCalls.length > 0 ? aggregatedToolCalls : undefined,
      additional_kwargs: additional_kwargs,
    });

    const generation: ChatGeneration = {
      message,
      text: aggregatedContent, // For compatibility, though message.content is preferred
      generationInfo: {
        finish_reason:
          finish_reason ||
          (finalAIMessageChunk?.additional_kwargs?.finish_reason as string) ||
          "stop",
        // Include tool information for tracing
        tool_calls:
          aggregatedToolCalls.length > 0 ? aggregatedToolCalls : undefined,
        tool_results: additional_kwargs.tool_result
          ? {
              tool_call_id: additional_kwargs.tool_call_id,
              tool_name: additional_kwargs.tool_name,
              result: additional_kwargs.tool_result,
            }
          : undefined,
      },
    };

    return {
      generations: [generation],
      llmOutput: {
        // Token usage is typically not available from a stream until the very end,
        // and might not be provided by Heroku Agent API in a way that can be easily aggregated here.
        // Set to empty or try to extract if available from a specific event in additional_kwargs.
      },
    };
  }

  async *_stream(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<AIMessageChunk> {
    const agentApiEndpoint = "/v1/agents/heroku";

    const herokuConfig = getHerokuConfigOptions(
      this.apiKey,
      this.apiUrl,
      agentApiEndpoint,
    );

    const herokuMessages = langchainMessagesToHerokuMessages(messages);
    const params = this.invocationParams({
      ...options,
      stream: true,
    } as HerokuMiaAgentCallOptions);

    const requestPayload: HerokuAgentStreamRequest = {
      messages: herokuMessages,
      model: params.model,
      temperature: params.temperature,
      max_tokens_per_inference_request: params.max_tokens_per_inference_request,
      stop: params.stop,
      top_p: params.top_p,
      tools: params.tools,
      metadata: params.metadata,
      session_id: params.sessionId,
      ...params.additionalKwargs,
    };
    Object.keys(requestPayload).forEach(
      (key) =>
        (requestPayload as any)[key] === undefined &&
        delete (requestPayload as any)[key],
    );

    let response: Response | undefined = undefined;
    let attempt = 0;
    const maxRetries = this.maxRetries ?? 2;
    let lastError: Error | undefined;
    let successfulResponse = false;

    while (attempt <= maxRetries) {
      try {
        const abortController = new AbortController();
        let timeoutId: NodeJS.Timeout | undefined;
        if (this.timeout) {
          timeoutId = setTimeout(() => abortController.abort(), this.timeout);
        }

        const currentResponse = await fetch(herokuConfig.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${herokuConfig.apiKey}`,
          },
          body: JSON.stringify(requestPayload),
          signal: abortController.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);
        response = currentResponse;

        if (response.ok) {
          successfulResponse = true;
          break;
        }
        if (response.status >= 400 && response.status < 500) {
          const errorData = await response
            .json()
            .catch(() => ({ message: response!.statusText }));
          lastError = new HerokuApiError(
            `Heroku Agent API stream request failed: ${errorData.message || response.statusText}`,
            response.status,
            errorData,
          );
          break;
        }
        lastError = new HerokuApiError(
          `Heroku Agent API stream request failed with status ${response.status}`,
          response.status,
        );
      } catch (error: any) {
        lastError = error;
      }
      attempt++;
      if (attempt <= maxRetries)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }

    if (!successfulResponse || !response || !response.body) {
      if (lastError) throw lastError;
      throw new HerokuApiError(
        "Failed to connect or get a streaming body from Heroku Agent API.",
        response?.status,
      );
    }

    // Buffer for tool call arguments that might be split across multiple message.delta events
    // This is a more complex scenario if Heroku streams tool call args progressively within message.delta
    // For now, assume tool.call gives full args, and message.delta is separate.
    // let currentToolCallArgBuffer: { [id: string]: string } = {};

    try {
      for await (const parsedEvent of parseHerokuSSE(response.body)) {
        // Handle [DONE] signal if it comes as plain text data
        if (parsedEvent.data === "[DONE]") {
          return; // End the generator - BaseChatModel will handle LLM end
        }

        let eventDataJSON: any;
        try {
          eventDataJSON = parsedEvent.data ? JSON.parse(parsedEvent.data) : {};
        } catch (e) {
          // If data is not JSON (e.g. a plain [DONE] signal already handled, or unexpected text)
          // console.warn("Skipping non-JSON SSE data:", parsedEvent.data, e);
          if (parsedEvent.data?.includes("[DONE]")) {
            // Double check for [DONE] that might not be exact match
            return;
          }
          runManager?.handleLLMError(
            new HerokuApiError(
              "Invalid JSON in agent stream event",
              undefined,
              { event: parsedEvent.event, data: parsedEvent.data },
            ),
          );
          continue; // Skip this malformed event
        }

        // Determine the Heroku event type from the 'object' field in the data
        const herokuEventType = eventDataJSON.object; // e.g., "chat.completion", "tool.completion", "chat.completion.chunk"

        // Skip events without a proper object type
        if (!herokuEventType) {
          continue;
        }

        switch (herokuEventType) {
          case "chat.completion": // Non-streaming chat completion (can appear in agent stream)
          case "chat.completion.chunk": // Streaming chat completion chunk (contains delta)
            if (eventDataJSON.choices && eventDataJSON.choices.length > 0) {
              const choice = eventDataJSON.choices[0];
              // If it's a chunk, delta should be present. If it's a full message, message obj is present.
              const delta = choice.delta || choice.message; // Adapt based on actual structure
              let content = "";
              let toolCallChunks: LocalToolCallChunk[] | undefined = undefined;

              if (delta.content) {
                content = delta.content as string;
                runManager?.handleLLMNewToken(content);
              }

              if (delta.tool_calls && delta.tool_calls.length > 0) {
                toolCallChunks = delta.tool_calls.map(
                  (tc: any, index: number) => ({
                    id: tc.id,
                    name: tc.function?.name,
                    args: tc.function?.arguments, // Heroku sends arguments as string
                    type: "tool_call_chunk" as const,
                    index: tc.index ?? index,
                  }),
                );

                // Notify callback manager about tool calls for tracing
                for (const toolCall of delta.tool_calls) {
                  if (runManager && toolCall.function?.name) {
                    await runManager.handleLLMNewToken(
                      `\n[Tool Call: ${toolCall.function.name}]\n`,
                    );
                  }
                }
              }

              yield new AIMessageChunk({
                content: content,
                tool_call_chunks: toolCallChunks,
                additional_kwargs: {
                  finish_reason: choice.finish_reason,
                  usage: eventDataJSON.usage, // Include usage if present
                },
              });
            }
            break;

          // Case for tool.call from SPECS.md: event: "tool.call", data: {id, name, input}
          // This seems to be different from what the terminal output shows for "tool.completion"
          // The terminal output shows object: "tool.completion" for tool results.
          // We need to clarify if Heroku sends a "tool.call" *before* "tool.completion"
          // For now, matching SPECS.md structure for tool.call, assuming it might come with event name "tool.call"
          // The `parsedEvent.event` from `parseHerokuSSE` might be the key here rather than `eventDataJSON.object` for these.

          // Let's use parsedEvent.event for distinct non-JSON-object named events from SPECS:
          case "tool.call": // If event name itself is tool.call as per SPECS for agent-initiated tool call phase
            const toolCallData =
              eventDataJSON as HerokuAgentToolCallEvent["data"]; // Assuming eventDataJSON is the `data` part
            const toolCallChunk: LocalToolCallChunk = {
              id: toolCallData.id,
              name: toolCallData.name,
              args: toolCallData.input,
              type: "tool_call_chunk" as const,
              index: 0,
            };
            yield new AIMessageChunk({
              content: "",
              tool_call_chunks: [toolCallChunk],
              additional_kwargs: {},
            });
            break;

          case "tool.completion": // As seen in terminal output: object: "tool.completion"
            const toolCompletionData = eventDataJSON.choices?.[0]?.message;

            if (toolCompletionData) {
              // Notify callback manager about tool result for tracing
              if (
                runManager &&
                toolCompletionData.name &&
                toolCompletionData.content
              ) {
                await runManager.handleLLMNewToken(
                  `\n[Tool Result: ${toolCompletionData.name}] ${toolCompletionData.content}\n`,
                );
              }

              yield new AIMessageChunk({
                content: "",
                additional_kwargs: {
                  tool_call_id: toolCompletionData.tool_call_id,
                  tool_name: toolCompletionData.name,
                  tool_result: toolCompletionData.content,
                },
              });
            }
            break;

          case "tool.error": // As per SPECS
            const toolErrorData =
              eventDataJSON as HerokuAgentToolErrorEvent["data"];
            runManager?.handleLLMError(
              new Error(
                `Tool '${toolErrorData.name || toolErrorData.id}' failed: ${toolErrorData.error}`,
              ),
            );
            yield new AIMessageChunk({
              content: "",
              additional_kwargs: {
                tool_error: toolErrorData.error,
                tool_id: toolErrorData.id,
                tool_name: toolErrorData.name,
              },
            });
            break;

          case "agent.error": // As per SPECS
            const agentErrorData =
              eventDataJSON as HerokuAgentAgentErrorEvent["data"];
            runManager?.handleLLMError(
              new Error(`Agent error: ${agentErrorData.message}`),
            );
            throw new HerokuApiError(
              `Agent error: ${agentErrorData.message}`,
              undefined,
              agentErrorData,
            );

          // stream.end event handling according to SPECS.md
          // This might be a specific event name or part of the [DONE] signal handling.
          // For now, relying on [DONE] check at the beginning of the loop.
          // If Heroku sends a named event "stream.end" with JSON data:
          // case "stream.end":
          //   const streamEndData = eventDataJSON as HerokuAgentStreamEndEvent["data"];
          //   if (streamEndData.final_message && streamEndData.final_message.content) {
          //     yield new AIMessageChunk({ content: streamEndData.final_message.content as string });
          //     runManager?.handleLLMNewToken(streamEndData.final_message.content as string);
          //   }
          //   runManager?.handleLLMEnd({ generations: [] });
          //   return; // End the generator

          default:
            // This is where "Unknown Heroku Agent SSE event type: message" was coming from
            // because herokuEventType was 'message' from parsedEvent.event.
            // Now herokuEventType is from eventDataJSON.object, so this should catch truly unknown objects.
            console.warn(
              `Unknown Heroku Agent event object type: ${herokuEventType}`,
              eventDataJSON,
            );
            yield new AIMessageChunk({
              content: "",
              additional_kwargs: {
                unknown_event_type: herokuEventType,
                event_data: eventDataJSON,
              },
            });
            break;
        }
      }
    } catch (streamError: any) {
      if (runManager) {
        await runManager.handleLLMError(streamError);
      }
      throw streamError;
    }
  }
}
