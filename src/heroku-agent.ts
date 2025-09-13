import { BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import {
  BaseMessage,
  AIMessage,
  AIMessageChunk,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatResult, ChatGeneration } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  HerokuAgentFields,
  HerokuAgentCallOptions,
  HerokuAgentStreamRequest,
  HerokuAgentToolErrorEvent,
  HerokuAgentAgentErrorEvent,
} from "./types.js";
import {
  getHerokuConfigOptions,
  langchainMessagesToHerokuMessages,
  HerokuApiError,
  parseHerokuSSE,
} from "./common.js";
import { HerokuModel } from "./model.js";

/**
 * **HerokuAgent** - Heroku Managed Inference Agent Integration
 *
 * A LangChain-compatible chat model that interfaces with Heroku's Managed Inference Agent API.
 * This class provides access to intelligent agents that can execute tools and perform complex
 * multi-step reasoning tasks. Agents have access to Heroku-specific tools like app management,
 * database operations, and can integrate with external services via MCP (Model Context Protocol).
 *
 * Unlike the basic ChatHeroku model, agents are designed for autonomous task execution with
 * built-in tool calling capabilities and advanced reasoning patterns.
 *
 * @example
 * ```typescript
 * import { HerokuAgent } from "heroku-langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 *
 * // Basic agent usage
 * const agent = new HerokuAgent({
 *   model: "gpt-oss-120b",
 *   temperature: 0.3,
 *   tools: [
 *     {
 *       type: "heroku_tool",
 *       name: "dyno_run_command  ",
 *       runtime_params: {
 *         target_app_name: "my-app",
 *         tool_params: {
 *            cmd: "date",
 *            description: "Gets the current date and time on the server.",
 *            parameters: { type: "object", properties: {} },
 *          },
 *        },
 *       }
 *   ],
 *   apiKey: process.env.INFERENCE_KEY,
 *   apiUrl: process.env.INFERENCE_URL
 * });
 *
 * const response = await agent.invoke([
 *   new HumanMessage("Deploy my Node.js application to Heroku")
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // Agent with MCP tools
 * const agentWithMCP = new HerokuAgent({
 *   model: "gpt-oss-120b",
 *   tools: [
 *     {
 *       type: "mcp",
 *       name: "mcp/read_file",
 *       description: "Read file contents via MCP"
 *     },
 *     {
 *       type: "heroku_tool",
 *       name: "scale_dyno",
 *       runtime_params: {
 *         target_app_name: "production-app"
 *       }
 *     }
 *   ]
 * });
 *
 * const result = await agentWithMCP.invoke([
 *   new HumanMessage("Read my package.json and scale the app based on the dependencies")
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // Streaming agent responses to see tool execution in real-time
 * const stream = await agent.stream([
 *   new HumanMessage("Check the status of all my Heroku apps and restart any that are down")
 * ]);
 *
 * for await (const chunk of stream) {
 *   if (chunk.response_metadata?.tool_calls) {
 *     console.log("Agent is executing:", chunk.response_metadata.tool_calls);
 *   }
 *   if (chunk.content) {
 *     process.stdout.write(chunk.content);
 *   }
 * }
 * ```
 *
 * @see {@link HerokuAgentFields} for constructor options
 * @see {@link HerokuAgentCallOptions} for runtime call options
 * @see [Heroku Agent API Documentation](https://devcenter.heroku.com/articles/heroku-inference-api-v1-agents-heroku)
 */
export class HerokuAgent extends HerokuModel<HerokuAgentCallOptions> {
  protected maxTokensPerRequest?: number;
  protected tools?: any[];
  protected streamUsage?: boolean; // Explicitly tell BaseChatModel to use _stream

  /**
   * Returns the LangChain identifier for this agent class.
   * @returns The string "HerokuAgent"
   */
  static lc_name() {
    return "HerokuAgent";
  }

  /**
   * Creates a new HerokuAgent instance.
   *
   * @param fields - Optional configuration options for the Heroku Mia Agent
   * @throws {Error} When model ID is not provided and INFERENCE_MODEL_ID environment variable is not set
   *
   * @example
   * ```typescript
   * // Basic usage with defaults
   * const agent = new HerokuAgent();
   *
   * // With custom configuration
   * const agent = new HerokuAgent({
   *   model: "gpt-oss-120b",
   *   temperature: 0.3,
   *   maxTokensPerRequest: 2000,
   *   tools: [
   *     {
   *       type: "heroku_tool",
   *       name: "dyno_run_command",
   *       runtime_params: {
   *         target_app_name: "my-app",
   *         tool_params: {
   *            cmd: "date",
   *            description: "Gets the current date and time on the server.",
   *            parameters: { type: "object", properties: {} },
   *          },
   *        },
   *       }
   *     }
   *   ],
   *   apiKey: "your-api-key",
   *   apiUrl: "https://us.inference.heroku.com"
   * });
   * ```
   */
  constructor(fields?: HerokuAgentFields) {
    super(fields ?? {});
    this.maxTokensPerRequest = fields?.maxTokensPerRequest;
    this.tools = fields?.tools;
    // Agent API is always streaming, so set this to true.
    this.streaming = true;
    // Set streamUsage to false so stream() calls _stream() directly to preserve heroku_agent_event
    this.streamUsage = false;
  }

  /**
   * Returns the LLM type identifier for this agent.
   * @returns The string "HerokuAgent"
   */
  _llmType(): string {
    return "HerokuAgent";
  }

  /**
   * Get the parameters used to invoke the agent.
   *
   * This method combines constructor parameters with runtime options to create
   * the final request parameters for the Heroku Agent API. Runtime options take
   * precedence over constructor parameters.
   *
   * @param options - Optional runtime parameters that override constructor defaults
   * @returns Combined parameters for the agent API request
   *
   * @internal
   */
  invocationParams(options?: Partial<HerokuAgentCallOptions>): Omit<
    HerokuAgentFields,
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

    let runtimeParams: Partial<HerokuAgentCallOptions> = {};
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
    } as HerokuAgentCallOptions);

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
    this.cleanUndefined(requestPayload as any);
    const response = await this.postWithRetries(
      herokuConfig.apiUrl,
      herokuConfig.apiKey,
      requestPayload as any,
    );
    if (!response.body) {
      throw new HerokuApiError(
        "Failed to get a streaming body from Heroku Agent API.",
        response.status,
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
                      // For mcp tools, match by name (which includes the full mcp path)
                      if (
                        (tool.type === "heroku_tool" || tool.type === "mcp") &&
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
                        (tool.type === "heroku_tool" || tool.type === "mcp") &&
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

  /**
   * Bind agent tools (heroku_tool or mcp) to this instance.
   */
  bindTools(tools: any[]): HerokuAgent {
    const boundInstance = new HerokuAgent({
      model: this.model,
      temperature: this.temperature,
      maxTokensPerRequest: this.maxTokensPerRequest,
      stop: this.stop,
      topP: this.topP,
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      tools: [...(this.tools ?? []), ...(tools ?? [])],
      additionalKwargs: this.additionalKwargs,
    });
    return boundInstance;
  }

  /**
   * Create a version of this agent that returns structured output by instructing
   * the model to produce JSON matching the schema (jsonMode-style).
   */
  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>,
    IncludeRaw extends boolean = false,
  >(
    schemaOrParams:
      | z.ZodType<RunOutput>
      | Record<string, any>
      | {
          schema: z.ZodType<RunOutput> | Record<string, any>;
          name?: string;
          description?: string;
          method?: "jsonMode" | "functionCalling";
          includeRaw?: IncludeRaw;
        },
    maybeOptions?: {
      name?: string;
      description?: string;
      method?: "jsonMode" | "functionCalling";
      includeRaw?: IncludeRaw;
    },
  ) {
    const isStructuredParams = (
      input: any,
    ): input is {
      schema: any;
      name?: string;
      description?: string;
      method?: string;
      includeRaw?: boolean;
    } =>
      input !== undefined &&
      typeof input === "object" &&
      !!(input as any).schema;

    let schema: z.ZodType<RunOutput> | Record<string, any>;
    let name = "extraction";
    let description: string | undefined;
    let method: "jsonMode" | "functionCalling" | undefined;
    const includeRaw =
      (maybeOptions as any)?.includeRaw ??
      (isStructuredParams(schemaOrParams)
        ? (schemaOrParams as any).includeRaw
        : false);

    if (isStructuredParams(schemaOrParams)) {
      schema = (schemaOrParams as any).schema;
      name = (schemaOrParams as any).name ?? name;
      description = (schemaOrParams as any).description;
      method = (schemaOrParams as any).method;
    } else {
      schema = schemaOrParams as any;
      name = (maybeOptions as any)?.name ?? name;
      description = (maybeOptions as any)?.description;
      method = (maybeOptions as any)?.method;
    }

    if (method && method !== "jsonMode") {
      throw new Error(
        "HerokuAgent only supports 'jsonMode' for structured output.",
      );
    }

    const isZodSchema = (input: any): input is z.ZodType<any> =>
      typeof input?.parse === "function";
    let zodSchema: z.ZodType<RunOutput> | undefined = undefined;
    let jsonSchema: Record<string, any> | undefined = undefined;
    if (isZodSchema(schema)) {
      zodSchema = schema as any;
      const asJson = zodToJsonSchema(schema as any, {
        $refStrategy: "none",
      }) as Record<string, any>;
      const { $schema: _ignored, ...clean } = asJson;
      jsonSchema = clean;
    } else {
      const { $schema: _ignored, ...clean } = schema as Record<string, any>;
      jsonSchema = clean;
    }

    const instruction = new SystemMessage(
      `You must reply with ONLY a valid JSON object that strictly conforms to this schema named "${name}":\n${JSON.stringify(jsonSchema, null, 2)}\n` +
        (description ? `Description: ${description}\n` : "") +
        `Do not include any extra commentary. If a field is optional but relevant, include it.`,
    );

    const prependInstruction = RunnableLambda.from(async (input: any) => {
      if (Array.isArray(input)) return [instruction, ...input];
      return input;
    });

    const parseJson = RunnableLambda.from(async (msg: any) => {
      const content = (msg?.content ??
        (typeof msg === "string" ? msg : "")) as string;
      const parsed = JSON.parse(content);
      if (zodSchema) {
        return zodSchema.parse(parsed);
      }
      return parsed as RunOutput;
    });

    if (!includeRaw) {
      return prependInstruction.pipe(this).pipe(parseJson);
    }

    const parserAssign = RunnablePassthrough.assign({
      parsed: (input: any) => parseJson.invoke(input.raw),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null as any,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });

    return RunnableSequence.from([
      { raw: prependInstruction.pipe(this) },
      parsedWithFallback,
    ]) as any;
  }
}
