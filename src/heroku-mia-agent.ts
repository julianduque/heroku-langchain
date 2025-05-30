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
  HerokuAgentToolErrorEvent,
  HerokuAgentAgentErrorEvent,
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
    let finalAIMessageChunk: AIMessageChunk | undefined;
    let finish_reason: string | null = null;
    const additional_kwargs: Record<string, any> = {};
    let tool_calls: any[] = [];
    let tool_results: any = undefined;

    for await (const chunk of stream) {
      if (chunk.content) {
        aggregatedContent += chunk.content;
      }

      // Merge additional_kwargs from chunks
      if (chunk.additional_kwargs) {
        Object.assign(additional_kwargs, chunk.additional_kwargs);
        if (
          chunk.additional_kwargs.finish_reason &&
          typeof chunk.additional_kwargs.finish_reason === "string"
        ) {
          finish_reason = chunk.additional_kwargs.finish_reason;
        }
      }

      // Extract tool calls and results from response_metadata (this is where Heroku puts them)
      if (chunk.response_metadata) {
        if (chunk.response_metadata.tool_calls) {
          tool_calls = chunk.response_metadata.tool_calls;
        }
        if (chunk.response_metadata.tool_results) {
          tool_results = chunk.response_metadata.tool_results;
        }
      }

      finalAIMessageChunk = chunk;
    }

    const message = new AIMessage({
      content: aggregatedContent,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
      additional_kwargs: additional_kwargs,
    });

    const generation: ChatGeneration = {
      message,
      text: aggregatedContent,
      generationInfo: {
        finish_reason:
          finish_reason ||
          (finalAIMessageChunk?.additional_kwargs?.finish_reason as string) ||
          "stop",
        // Include tool information for tracing
        tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
        tool_results: tool_results,
      },
    };

    return {
      generations: [generation],
      llmOutput: {
        // Add usage info if available
        usage: additional_kwargs.usage,
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
          if (parsedEvent.data?.includes("[DONE]")) {
            return;
          }
          runManager?.handleLLMError(
            new HerokuApiError(
              "Invalid JSON in agent stream event",
              undefined,
              { event: parsedEvent.event, data: parsedEvent.data },
            ),
          );
          continue;
        }

        // Determine the Heroku event type from the 'object' field in the data
        const herokuEventType = eventDataJSON.object;

        // Skip events without a proper object type
        if (!herokuEventType) {
          continue;
        }

        switch (herokuEventType) {
          case "chat.completion": // Non-streaming chat completion
          case "chat.completion.chunk": // Streaming chat completion chunk
            if (eventDataJSON.choices && eventDataJSON.choices.length > 0) {
              const choice = eventDataJSON.choices[0];
              const delta = choice.delta || choice.message;
              let content = "";

              if (delta.content) {
                content = delta.content as string;
                runManager?.handleLLMNewToken(content);
              }

              // Build response metadata for tool calls if present
              const response_metadata: Record<string, any> = {
                finish_reason: choice.finish_reason,
                usage: eventDataJSON.usage,
              };

              // Check for tool calls in delta and add to response metadata
              if (delta.tool_calls && delta.tool_calls.length > 0) {
                response_metadata.tool_calls = delta.tool_calls.map(
                  (tc: any) => {
                    // Find the original tool definition to include runtime_params
                    const originalTool = this.tools?.find((tool: any) => {
                      // For heroku_tool, match by name
                      if (
                        tool.type === "heroku_tool" &&
                        tool.name === tc.function?.name
                      ) {
                        return true;
                      }
                      // For mcp tools, match by name (which includes the full mcp path)
                      if (
                        tool.type === "mcp" &&
                        tool.name === tc.function?.name
                      ) {
                        return true;
                      }
                      return false;
                    });

                    const toolCallInfo: any = {
                      id: tc.id,
                      name: tc.function?.name,
                      args: tc.function?.arguments
                        ? JSON.parse(tc.function.arguments)
                        : {},
                      type: "tool_call",
                    };

                    // Include original tool definition for better tracing
                    if (originalTool) {
                      toolCallInfo.original_tool_definition = originalTool;
                      // Specifically include runtime_params for heroku_tool types
                      if (
                        originalTool.type === "heroku_tool" &&
                        originalTool.runtime_params
                      ) {
                        toolCallInfo.runtime_params =
                          originalTool.runtime_params;
                        // For heroku_tool, populate args with runtime_params for LangSmith display
                        if (Object.keys(toolCallInfo.args).length === 0) {
                          toolCallInfo.args = {
                            target_app_name:
                              originalTool.runtime_params.target_app_name,
                            ...originalTool.runtime_params.tool_params,
                          };
                        }
                      }
                    }

                    return toolCallInfo;
                  },
                );

                // Notify callback manager about tool calls for tracing
                for (const toolCall of delta.tool_calls) {
                  if (runManager && toolCall.function?.name) {
                    // Find the original tool for enhanced logging
                    const originalTool = this.tools?.find((tool: any) => {
                      if (
                        tool.type === "heroku_tool" &&
                        tool.name === toolCall.function?.name
                      ) {
                        return true;
                      }
                      if (
                        tool.type === "mcp" &&
                        tool.name === toolCall.function?.name
                      ) {
                        return true;
                      }
                      return false;
                    });

                    let logMessage = `\n[Tool Call: ${toolCall.function.name}]`;
                    if (
                      originalTool?.type === "heroku_tool" &&
                      originalTool.runtime_params
                    ) {
                      logMessage += `\n  Runtime Params: ${JSON.stringify(originalTool.runtime_params, null, 2)}`;
                    }
                    if (originalTool?.type === "mcp") {
                      logMessage += `\n  Type: MCP Tool`;
                    }
                    logMessage += `\n`;

                    await runManager.handleLLMNewToken(logMessage);
                  }
                }
              }

              yield new AIMessageChunk({
                content: content,
                additional_kwargs: {
                  finish_reason: choice.finish_reason,
                  usage: eventDataJSON.usage,
                },
                response_metadata,
              });
            }
            break;

          case "tool.completion": // Tool execution result
            const toolCompletionData = eventDataJSON.choices?.[0]?.message;

            if (toolCompletionData) {
              // Find the original tool definition for enhanced logging
              const originalTool = this.tools?.find((tool: any) => {
                if (
                  tool.type === "heroku_tool" &&
                  tool.name === toolCompletionData.name
                ) {
                  return true;
                }
                if (
                  tool.type === "mcp" &&
                  tool.name === toolCompletionData.name
                ) {
                  return true;
                }
                return false;
              });

              // Notify callback manager about tool result for tracing
              if (
                runManager &&
                toolCompletionData.name &&
                toolCompletionData.content
              ) {
                let logMessage = `\n[Tool Result: ${toolCompletionData.name}]`;
                if (
                  originalTool?.type === "heroku_tool" &&
                  originalTool.runtime_params
                ) {
                  logMessage += `\n  Runtime Params: ${JSON.stringify(originalTool.runtime_params, null, 2)}`;
                }
                logMessage += `\n  Result: ${toolCompletionData.content}\n`;

                await runManager.handleLLMNewToken(logMessage);
              }

              const response_metadata: Record<string, any> = {
                tool_results: {
                  tool_call_id: toolCompletionData.tool_call_id,
                  tool_name: toolCompletionData.name,
                  result: toolCompletionData.content,
                },
              };

              // Include original tool definition in response metadata
              if (originalTool) {
                response_metadata.tool_results.original_tool_definition =
                  originalTool;
                if (
                  originalTool.type === "heroku_tool" &&
                  originalTool.runtime_params
                ) {
                  response_metadata.tool_results.runtime_params =
                    originalTool.runtime_params;
                }
              }

              yield new AIMessageChunk({
                content: "",
                additional_kwargs: {
                  tool_call_id: toolCompletionData.tool_call_id,
                  tool_name: toolCompletionData.name,
                  tool_result: toolCompletionData.content,
                },
                response_metadata,
              });
            }
            break;

          case "tool.error": // Tool execution error
            const toolErrorData =
              eventDataJSON as HerokuAgentToolErrorEvent["data"];

            // Find the original tool definition for enhanced error context
            const originalErrorTool = this.tools?.find((tool: any) => {
              if (
                tool.type === "heroku_tool" &&
                tool.name === toolErrorData.name
              ) {
                return true;
              }
              if (tool.type === "mcp" && tool.name === toolErrorData.name) {
                return true;
              }
              return false;
            });

            let errorMessage = `Tool '${toolErrorData.name || toolErrorData.id}' failed: ${toolErrorData.error}`;
            if (
              originalErrorTool?.type === "heroku_tool" &&
              originalErrorTool.runtime_params
            ) {
              errorMessage += `\n  Runtime Params: ${JSON.stringify(originalErrorTool.runtime_params, null, 2)}`;
            }

            runManager?.handleLLMError(new Error(errorMessage));

            const errorAdditionalKwargs: Record<string, any> = {
              tool_error: toolErrorData.error,
              tool_id: toolErrorData.id,
              tool_name: toolErrorData.name,
            };

            // Include original tool definition in error context
            if (originalErrorTool) {
              errorAdditionalKwargs.original_tool_definition =
                originalErrorTool;
              if (
                originalErrorTool.type === "heroku_tool" &&
                originalErrorTool.runtime_params
              ) {
                errorAdditionalKwargs.runtime_params =
                  originalErrorTool.runtime_params;
              }
            }

            yield new AIMessageChunk({
              content: "",
              additional_kwargs: errorAdditionalKwargs,
            });
            break;

          case "agent.error": // Agent error
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

          default:
            console.warn(
              `Unknown Heroku Agent event object type: ${herokuEventType}`,
              eventDataJSON,
            );
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
