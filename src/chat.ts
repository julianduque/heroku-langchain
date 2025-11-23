import { BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import {
  BaseMessage,
  AIMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import {
  ChatResult,
  ChatGeneration,
  ChatGenerationChunk,
} from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { OutputParserException } from "@langchain/core/output_parsers";
import { Runnable, RunnableLambda } from "@langchain/core/runnables";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { SystemMessage } from "@langchain/core/messages";
import {
  ChatHerokuFields,
  ChatHerokuCallOptions,
  HerokuChatCompletionRequest,
  HerokuChatCompletionResponse,
  HerokuChatCompletionStreamResponse,
  HerokuFunctionTool,
  LocalToolCallChunk,
} from "./types.js";
import {
  getHerokuConfigOptions,
  langchainMessagesToHerokuMessages,
  langchainToolsToHerokuTools,
  HerokuApiError,
  parseHerokuSSE,
} from "./common.js";
import { HerokuModel } from "./model.js";

/**
 * Metadata about the implicit structured output tool ChatHeroku generates when
 * {@link ChatHeroku.withStructuredOutput} binds a schema.
 *
 * @public
 */
export interface StructuredOutputToolMetadata {
  /** Name of the synthetic tool that enforces the schema */
  name: string;
  /** Optional human-readable description of the structured output */
  description?: string;
  /** JSON schema that the model must satisfy */
  schema: Record<string, any>;
}

// Types for withStructuredOutput
/**
 * Configuration options for the structured output method.
 *
 * @public
 * @interface StructuredOutputMethodOptions
 * @template IncludeRaw - Whether to include raw response alongside parsed output
 */
export interface StructuredOutputMethodOptions {
  /** Optional name for the structured output function */
  name?: string;
  /** Optional description for the structured output function */
  description?: string;
  /** Method to use for structured output - either function calling or JSON mode */
  method?: "functionCalling" | "jsonMode" | "jsonSchema" | string;
  /** Whether to include the raw response alongside the parsed output */
  includeRaw?: boolean;
  /** Whether to enforce strict validation (passed through when supported) */
  strict?: boolean;
}

/**
 * Parameters for configuring structured output with schema and options.
 *
 * @public
 * @interface StructuredOutputMethodParams
 * @template RunOutput - The expected output type from the structured response
 * @template IncludeRaw - Whether to include raw response alongside parsed output
 */
export interface StructuredOutputMethodParams<
  RunOutput extends Record<string, any> = Record<string, any>,
> {
  /** The Zod schema or JSON schema object defining the expected output structure */
  schema: z.ZodType<RunOutput> | Record<string, any>;
  /** Optional name for the structured output function */
  name?: string;
  /** Optional description for the structured output function */
  description?: string;
  /** Method to use for structured output - either function calling or JSON mode */
  method?: "functionCalling" | "jsonMode" | "jsonSchema" | string;
  /** Whether to include the raw response alongside the parsed output */
  includeRaw?: boolean;
}

/**
 * **ChatHeroku** - Heroku Managed Inference API LangChain Integration
 *
 * A LangChain-compatible chat model that interfaces with Heroku's Managed Inference API (Mia).
 * This class provides access to various language models hosted on Heroku's infrastructure,
 * including support for function calling, structured outputs, and streaming responses that plug
 * directly into LangChain `createAgent`, LCEL chains, and LangGraph workflows.
 *
 * @example Basic invocation
 * ```typescript
 * // Source: examples/chat-basic.ts
 * import { ChatHeroku } from "heroku-langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 * const model = new ChatHeroku({ temperature: 0.5, maxTokens: 512 });
 *
 * const response = await model.invoke([
 *   new HumanMessage("Tell me about Heroku Inference in one paragraph.")
 * ]);
 * console.log(response.content);
 *
 * const stream = await model.stream([
 *   new HumanMessage("Stream a short haiku about zero-downtime deploys.")
 * ]);
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.content as string);
 * }
 * ```
 *
 * @example LangChain function calling
 * ```typescript
 * // Source: examples/create-agent-custom-tool.ts
 * import { tool } from "langchain";
 * import { z } from "zod";
 * import { HumanMessage } from "@langchain/core/messages";
 * import { ChatHeroku } from "heroku-langchain";
 *
 * const getWeather = tool(
 *   async ({ city }) => `Weather in ${city} is always sunny!`,
 *   {
 *     name: "get_weather",
 *     description: "Get weather for a given city.",
 *     schema: z.object({ city: z.string() })
 *   }
 * );
 *
 * const modelWithTools = new ChatHeroku({ temperature: 0 }).bindTools([getWeather]);
 * const result = await modelWithTools.invoke([
 *   new HumanMessage("Use get_weather to check Tokyo before answering.")
 * ]);
 * console.log(result.content);
 * ```
 *
 * @example Structured output with createAgent
 * ```typescript
 * // Source: examples/create-agent-structured-output.ts
 * import { createAgent, tool } from "langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 * import { InteropZodType } from "@langchain/core/utils/types";
 * import { z } from "zod";
 * import { ChatHeroku } from "heroku-langchain";
 *
 * const WeatherSchema = z.object({
 *   city: z.string(),
 *   temperatureCelsius: z.number(),
 *   condition: z.string()
 * }) as InteropZodType<typeof WeatherSchema>;
 *
 * const getWeather = tool(
 *   async ({ city }) => JSON.stringify({ city, temperatureCelsius: 25, condition: "Sunny" }),
 *   {
 *     name: "get_weather",
 *     description: "Get weather for a given city.",
 *     schema: z.object({ city: z.string() })
 *   }
 * );
 *
 * const agent = createAgent({
 *   model: new ChatHeroku({
 *     model: process.env.INFERENCE_MODEL_ID ?? "gpt-oss-120b",
 *     temperature: 0
 *   }),
 *   tools: [getWeather],
 *   responseFormat: WeatherSchema,
 *   systemPrompt: "You are a weather assistant. Always call get_weather."
 * });
 *
 * const result = await agent.invoke({
 *   messages: [new HumanMessage("What's the weather like in Tokyo today?")]
 * });
 * console.log(result.structuredResponse);
 * ```
 *
 * @example Streaming updates via createAgent
 * ```typescript
 * // Source: examples/create-agent-updates-stream.ts
 * import { createAgent } from "langchain";
 * import { ChatHeroku } from "heroku-langchain";
 *
 * // Reuse the `getWeather` tool defined above
 * const agent = createAgent({
 *   model: new ChatHeroku({
 *     model: process.env.INFERENCE_MODEL_ID ?? "gpt-oss-120b",
 *     temperature: 0
 *   }),
 *   tools: [getWeather]
 * });
 *
 * const stream = await agent.stream(
 *   { messages: [{ role: "user", content: "what is the weather in sf" }] },
 *   { streamMode: "updates" }
 * );
 *
 * for await (const chunk of stream) {
 *   const [step, content] = Object.entries(chunk)[0];
 *   console.log(`step: ${step}`);
 *   console.log(content);
 * }
 * ```
 *
 * @see {@link ChatHerokuFields} for constructor options
 * @see {@link ChatHerokuCallOptions} for runtime call options
 * @see [Heroku Managed Inference API Documentation](https://devcenter.heroku.com/articles/heroku-inference-api-v1-chat-completions)
 */
export class ChatHeroku extends HerokuModel<ChatHerokuCallOptions> {
  // Chat-specific parameters
  protected maxTokens?: number;
  private structuredOutputTool?: StructuredOutputToolMetadata;

  /**
   * Returns the LangChain identifier for this model class.
   * @returns The string "ChatHeroku"
   */
  static lc_name() {
    return "ChatHeroku";
  }

  getName(): string {
    return "ChatHeroku";
  }

  public override getLsParams(options: this["ParsedCallOptions"]) {
    const base = super.getLsParams(options);
    return { ...base, ls_provider: "Heroku" };
  }

  private applyResponseFormatModelAlias() {}

  private extractStructuredOutputMetadata(
    tools: (StructuredTool | Record<string, any>)[],
  ): StructuredOutputToolMetadata | undefined {
    for (const tool of tools) {
      if (this.isStructuredResponseTool(tool)) {
        return {
          name: tool.function.name,
          description: tool.function.description,
          schema: this.cleanJsonSchema(tool.function.parameters ?? {}),
        };
      }
    }
    return undefined;
  }

  private isStructuredResponseTool(
    tool: StructuredTool | Record<string, any>,
  ): tool is {
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters: Record<string, any>;
    };
  } {
    if (!tool || typeof tool !== "object") return false;
    if ("type" in tool && (tool as any).type === "function") {
      const fn = (tool as any).function;
      return (
        fn &&
        typeof fn.name === "string" &&
        fn.name.startsWith("extract-") &&
        typeof fn.parameters === "object"
      );
    }
    return false;
  }

  private cleanJsonSchema(schema: Record<string, any>): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $schema, ...rest } = schema ?? {};
    return rest;
  }

  private async maybeInjectStructuredToolResult(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    existingToolCalls:
      | {
          id: string;
          name: string;
          args: any;
          type: "tool_call";
        }[]
      | undefined,
    currentContent: string,
  ): Promise<{
    toolCalls: {
      id: string;
      name: string;
      args: any;
      type: "tool_call";
    }[];
    content: string;
  } | null> {
    if (!this.structuredOutputTool) return null;
    const alreadyStructured =
      existingToolCalls?.some(
        (call) => call.name === this.structuredOutputTool?.name,
      ) ?? false;
    if (alreadyStructured) return null;

    try {
      const extractor = this.withStructuredOutput({
        schema: this.structuredOutputTool.schema,
        name: this.structuredOutputTool.name,
        description:
          this.structuredOutputTool.description ??
          "Return the structured response using the provided schema.",
      });
      const extractionInput = [
        ...messages,
        new AIMessage({
          content: currentContent,
        }),
      ];
      let structuredResult = await extractor.invoke(
        extractionInput as any,
        {
          ...options,
        } as any,
      );
      if (typeof structuredResult === "string") {
        try {
          structuredResult = JSON.parse(structuredResult);
        } catch {
          // Keep as string if parsing fails
        }
      }
      const toolCall = {
        id: `structured_${Date.now().toString(36)}`,
        name: this.structuredOutputTool.name,
        args: structuredResult,
        type: "tool_call" as const,
      };
      return {
        toolCalls: [...(existingToolCalls ?? []), toolCall],
        content: `Returning structured response: ${JSON.stringify(structuredResult)}`,
      };
    } catch (error) {
      if (process.env.DEBUG_CHAT_HEROKU) {
        console.warn(
          "[ChatHeroku] Structured output fallback failed:",
          (error as Error).message,
        );
      }
      return null;
    }
  }

  /**
   * Creates a new ChatHeroku instance.
   *
   * @param fields - Optional configuration options for the Heroku Mia model
   * @throws {Error} When model ID is not provided and INFERENCE_MODEL_ID environment variable is not set
   *
   * @example
   * ```typescript
   * // Basic usage with defaults
   * const model = new ChatHeroku();
   *
   * // With custom configuration

   * const model = new ChatHeroku({
   *   model: "gpt-oss-120b",
   *   temperature: 0.7,
   *   maxTokens: 1000,
   *   apiKey: "your-api-key",
   *   apiUrl: "https://us.inference.heroku.com"
   * });
   * ```
   */
  constructor(fields?: ChatHerokuFields) {
    super(fields ?? {});
    this.maxTokens = fields?.maxTokens;
    this.applyResponseFormatModelAlias();
  }

  /**
   * Returns the LLM type identifier for this model.
   * @returns The string "ChatHeroku"
   */
  _llmType(): string {
    return "ChatHeroku";
  }

  /**
   * Bind tools to this chat model for function calling capabilities.
   *
   * This method creates a new instance of ChatHeroku with the specified tools pre-bound,
   * enabling the model to call functions during conversations. The tools will be
   * automatically included in all subsequent calls to the model.
   *
   * @param tools - A list of StructuredTool instances or tool definitions to bind to the model
   * @returns A new ChatHeroku instance with the tools bound and tool_choice set to "auto"
   *
   * @example
   * ```typescript
   * import { DynamicStructuredTool } from "@langchain/core/tools";
   * import { z } from "zod";
   *
   * const calculatorTool = new DynamicStructuredTool({
   *   name: "calculator",
   *   description: "Perform basic arithmetic operations",
   *   schema: z.object({
   *     operation: z.enum(["add", "subtract", "multiply", "divide"]),
   *     a: z.number(),
   *     b: z.number()
   *   }),
   *   func: async ({ operation, a, b }) => {
   *     switch (operation) {
   *       case "add": return `${a + b}`;
   *       case "subtract": return `${a - b}`;
   *       case "multiply": return `${a * b}`;
   *       case "divide": return `${a / b}`;
   *     }
   *   }
   * });
   *
   * const modelWithTools = model.bindTools([calculatorTool]);
   * const result = await modelWithTools.invoke([
   *   new HumanMessage("What is 15 * 7?")
   * ]);
   * ```
   */
  bindTools(
    tools: (StructuredTool | Record<string, any>)[],
    config?: Partial<ChatHerokuCallOptions>,
  ): ChatHeroku {
    if (process.env.DEBUG_CHAT_HEROKU) {
      console.log(
        "[ChatHeroku] bindTools received:",
        tools.map((tool) =>
          tool instanceof StructuredTool
            ? tool.name
            : ((tool as any)?.function?.name ?? "unknown"),
        ),
      );
      if (config && Object.keys(config).length > 0) {
        console.log(
          "[ChatHeroku] bindTools config:",
          JSON.stringify(config, null, 2),
        );
      }
    }
    const structuredOutputMetadata =
      this.extractStructuredOutputMetadata(tools);
    const herokuTools = langchainToolsToHerokuTools(tools);

    // Create a new ChatHeroku instance with the same configuration but with tools pre-bound
    const boundInstance = new ChatHeroku({
      model: this.getModelForRequest(),
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      stop: this.stop,
      topP: this.topP,
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      streaming: this.streaming,
      additionalKwargs: this.additionalKwargs,
    });
    boundInstance.structuredOutputTool = structuredOutputMetadata;

    // Override the invocationParams method to include the bound tools
    const originalInvocationParams =
      boundInstance.invocationParams.bind(boundInstance);
    const boundToolOptions = config ?? {};

    boundInstance.invocationParams = function (
      options?: Partial<ChatHerokuCallOptions>,
    ) {
      const mergedOptions = {
        ...boundToolOptions,
        ...options,
      } as Partial<ChatHerokuCallOptions>;

      const params = originalInvocationParams(mergedOptions);
      // Merge bound tools with any tools passed in options
      const combinedTools = [...(herokuTools || []), ...(params.tools || [])];
      return {
        ...params,
        tools: combinedTools.length > 0 ? combinedTools : undefined,
        tool_choice:
          params.tool_choice ??
          boundToolOptions.tool_choice ??
          (combinedTools.length > 0 ? "auto" : undefined),
      };
    };

    return boundInstance;
  }

  /**
   * Get the parameters used to invoke the model.
   *
   * This method combines constructor parameters with runtime options to create
   * the final request parameters for the Heroku API. Runtime options take
   * precedence over constructor parameters.
   *
   * @param options - Optional runtime parameters that override constructor defaults
   * @returns Combined parameters for the API request
   *
   * @internal
   */
  invocationParams(options?: Partial<ChatHerokuCallOptions>): Omit<
    ChatHerokuFields,
    keyof BaseChatModelParams
  > & {
    [key: string]: any;
  } {
    const constructorParams = {
      model: this.getModelForRequest(),
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stop: this.stop,
      stream: this.streaming,
      top_p: this.topP,
      ...this.additionalKwargs,
    };

    let runtimeParams: Partial<HerokuChatCompletionRequest> = {};
    if (options) {
      if (options.temperature !== undefined)
        runtimeParams.temperature = options.temperature;
      if (options.maxTokens !== undefined)
        runtimeParams.max_tokens = options.maxTokens;
      if (options.topP !== undefined) runtimeParams.top_p = options.topP;
      if (options.stop !== undefined) runtimeParams.stop = options.stop;
      if ((options as any).stream !== undefined)
        runtimeParams.stream = (options as any).stream;
      if (options.tools && options.tools.length > 0) {
        runtimeParams.tools = langchainToolsToHerokuTools(options.tools);

        // Debug logging for tool binding
        if (process.env.DEBUG_TOOLS) {
          console.log(
            "[ChatHeroku] Binding tools:",
            runtimeParams.tools.map((t: any) => t.function.name),
          );
        }
      }
      if (options.tool_choice !== undefined) {
        // Convert LangChain's "any" to Heroku's "required"
        // LangChain uses "any" to mean "must call a tool"
        // Heroku uses "required" for the same meaning
        let toolChoice = options.tool_choice;
        if (toolChoice === "any") {
          toolChoice = "required";
        }

        if (process.env.DEBUG_TOOLS) {
          console.log(
            "[ChatHeroku] Original tool_choice:",
            options.tool_choice,
            "-> Converted:",
            toolChoice,
          );
        }

        if (
          typeof toolChoice === "string" &&
          !["none", "auto", "required"].includes(toolChoice)
        ) {
          runtimeParams.tool_choice = {
            type: "function",
            function: { name: toolChoice },
          };
        } else {
          runtimeParams.tool_choice =
            toolChoice as HerokuChatCompletionRequest["tool_choice"];
        }
      }
      if (options.additionalKwargs) {
        runtimeParams = { ...runtimeParams, ...options.additionalKwargs };
      }
    }
    return { ...constructorParams, ...runtimeParams } as any;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    if (process.env.DEBUG_CHAT_HEROKU) {
      console.log(
        "[ChatHeroku] response_format:",
        JSON.stringify((options as any).response_format ?? null),
      );
    }
    // Handle native structured output via response_format parameter
    // This is used by LangChain's providerStrategy for agent structured output
    // NOTE: This is experimental and may not work reliably with all agent configurations
    const responseFormat = (options as any).response_format;
    if (
      responseFormat?.type === "json_schema" &&
      responseFormat?.json_schema?.schema
    ) {
      // Use withStructuredOutput to handle structured response
      const schema = responseFormat.json_schema.schema;
      const structuredModel = this.withStructuredOutput(schema, {
        name: responseFormat.json_schema.name || "extract",
        method: "functionCalling",
      });

      // Call the structured model
      const result = await structuredModel.invoke(messages, options as any);

      // Return the result in the expected format for native structured output
      // ProviderStrategy.parse() expects AIMessage.content to be a JSON string
      const aiMessage = new AIMessage({
        content: JSON.stringify(result),
        additional_kwargs: {},
      });

      return {
        generations: [
          {
            message: aiMessage,
            text: JSON.stringify(result),
          },
        ],
        llmOutput: {},
      };
    }

    // If streaming is requested, delegate to _stream and aggregate results.
    const wantsStreamingCallbacks =
      runManager?.handlers?.some((handler: any) => {
        const handlerName = handler?.constructor?.name ?? "";
        if (handlerName === "LangChainTracer") {
          return false;
        }
        return (
          typeof (handler as { handleLLMNewToken?: unknown })
            .handleLLMNewToken === "function"
        );
      }) ?? false;
    const constructorStreaming =
      typeof this.streaming === "boolean" ? this.streaming : undefined;
    const shouldStream =
      (options as any).stream ??
      (constructorStreaming ? true : undefined) ??
      wantsStreamingCallbacks;
    if (shouldStream) {
      let aggregatedContent = "";
      const toolCallChunks: LocalToolCallChunk[] = [];
      let finalFinishReason: string | null = null;
      const FALLBACK_TEXT = "I'll use the available tools to help you.";

      for await (const chunk of this._stream(messages, options, runManager)) {
        if (chunk.content) aggregatedContent += chunk.content;
        if (
          (chunk as any).tool_call_chunks &&
          (chunk as any).tool_call_chunks.length > 0
        ) {
          toolCallChunks.push(
            ...((chunk as any).tool_call_chunks as LocalToolCallChunk[]),
          );
        }
        if (
          chunk.additional_kwargs &&
          (chunk.additional_kwargs as any).finish_reason
        ) {
          finalFinishReason = (chunk.additional_kwargs as any)
            .finish_reason as string;
        }
      }

      // Assemble tool calls from chunks
      const aggregatedToolCalls: {
        id: string;
        name: string;
        args: any;
        type: "tool_call";
      }[] = [];
      if (toolCallChunks.length > 0) {
        const toolCallMap = new Map<
          string,
          { name?: string; argsSlices?: string[]; index?: number }
        >();
        toolCallChunks.forEach((chunk) => {
          const key = (chunk as any).id ?? `${(chunk as any).index}`;
          if (!key) return;
          let entry = toolCallMap.get(key);
          if (!entry) {
            entry = { argsSlices: [], index: (chunk as any).index };
            toolCallMap.set(key, entry);
          }
          if ((chunk as any).name) entry.name = (chunk as any).name;
          if ((chunk as any).args !== undefined)
            entry.argsSlices!.push((chunk as any).args as string);
        });
        toolCallMap.forEach((assembledTc, id) => {
          if (
            assembledTc.name &&
            assembledTc.argsSlices &&
            assembledTc.argsSlices.length > 0
          ) {
            const fullArgsString = assembledTc.argsSlices.join("");
            try {
              aggregatedToolCalls.push({
                id,
                name: assembledTc.name,
                args: JSON.parse(fullArgsString),
                type: "tool_call",
              });
            } catch {
              aggregatedToolCalls.push({
                id,
                name: assembledTc.name,
                args: fullArgsString,
                type: "tool_call",
              });
            }
          }
        });
      }

      const finalAdditionalKwargs: Record<string, any> = {};
      if (finalFinishReason) {
        finalAdditionalKwargs.finish_reason = finalFinishReason;
      }
      if (aggregatedToolCalls.length > 0) {
        finalAdditionalKwargs.tool_calls = aggregatedToolCalls;
      }

      const finalMessage = new AIMessage({
        content:
          aggregatedContent && aggregatedContent.length > 0
            ? aggregatedContent
            : toolCallChunks.length > 0
              ? FALLBACK_TEXT
              : "",
        tool_calls:
          aggregatedToolCalls.length > 0 ? aggregatedToolCalls : undefined,
        additional_kwargs: finalAdditionalKwargs,
      });
      const generation: ChatGeneration = {
        message: finalMessage,
        text:
          aggregatedContent && aggregatedContent.length > 0
            ? aggregatedContent
            : aggregatedToolCalls.length > 0
              ? FALLBACK_TEXT
              : "",
        generationInfo:
          Object.keys(finalAdditionalKwargs).length > 0
            ? finalAdditionalKwargs
            : undefined,
      } as ChatGeneration;
      return { generations: [generation], llmOutput: {} };
    }

    // Non-streaming: make a single completion request and return the result.
    const herokuConfig = getHerokuConfigOptions(
      this.apiKey,
      this.apiUrl,
      "/v1/chat/completions",
    );

    const params = this.invocationParams(options);
    const preparedMessages = this.injectStructuredOutputInstruction(
      messages,
      params.tools,
    );
    const herokuMessages = langchainMessagesToHerokuMessages(preparedMessages);

    const requestPayload: HerokuChatCompletionRequest = {
      model: params.model || this.getModelForRequest(),
      messages: herokuMessages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      stop: params.stop,
      stream: false,
      top_p: params.top_p,
      tools: params.tools,
      tool_choice: params.tool_choice,
      ...params.additionalKwargs,
    };

    this.cleanUndefined(requestPayload as any);

    const response = await this.postWithRetries(
      herokuConfig.apiUrl,
      herokuConfig.apiKey,
      requestPayload as any,
    );

    const herokuResponse: HerokuChatCompletionResponse = await response.json();
    const choice = herokuResponse.choices[0];

    let parsedToolCalls = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments),
      type: "tool_call" as const,
    }));

    const {
      role: _role,
      content: msgContent,
      tool_calls: _rawToolCalls,
      ...restOfMessage
    } = choice.message;

    let content = msgContent as string;
    if (parsedToolCalls && parsedToolCalls.length > 0 && content === "") {
      content = "I'll use the available tools to help you.";
    }

    const structuredFallback = await this.maybeInjectStructuredToolResult(
      messages,
      options,
      parsedToolCalls,
      content,
    );
    if (structuredFallback) {
      parsedToolCalls = structuredFallback.toolCalls;
      content = structuredFallback.content;
    }

    const generation: ChatGeneration = {
      message: new AIMessage({
        content: content,
        tool_calls: parsedToolCalls,
        additional_kwargs: restOfMessage,
      }),
      text: content,
      generationInfo: {
        finish_reason: choice.finish_reason,
        index: choice.index,
      },
    };

    const llmOutput = {
      tokenUsage: herokuResponse.usage,
      response: herokuResponse,
    };

    return { generations: [generation], llmOutput };
  }

  async *_stream(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<AIMessageChunk> {
    const herokuConfig = getHerokuConfigOptions(
      this.apiKey,
      this.apiUrl,
      "/v1/chat/completions",
    );
    // Ensure stream is true for this path, overriding constructor/defaults
    const params = this.invocationParams({
      ...options,
      stream: true,
    } as ChatHerokuCallOptions);
    const preparedMessages = this.injectStructuredOutputInstruction(
      messages,
      params.tools,
    );
    const herokuMessages = langchainMessagesToHerokuMessages(preparedMessages);

    let herokuToolChoice: HerokuChatCompletionRequest["tool_choice"];
    if (
      params.tool_choice &&
      typeof params.tool_choice === "string" &&
      !["none", "auto", "required"].includes(params.tool_choice)
    ) {
      herokuToolChoice = {
        type: "function",
        function: { name: params.tool_choice },
      };
    } else {
      herokuToolChoice =
        params.tool_choice as HerokuChatCompletionRequest["tool_choice"];
    }

    const requestPayload: HerokuChatCompletionRequest = {
      model: params.model || this.getModelForRequest(),
      messages: herokuMessages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      stop: params.stop,
      stream: true, // Explicitly true for _stream
      top_p: params.top_p,
      tools: params.tools,
      tool_choice: herokuToolChoice,
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
        "Failed to get a streaming body from Heroku API.",
        response.status,
      );
    }

    // Process the SSE stream
    let anyContentEmitted = false;
    let anyToolCallObserved = false;
    const FALLBACK_TEXT = "I'll use the available tools to help you.";
    for await (const parsedEvent of parseHerokuSSE(response.body)) {
      if (parsedEvent.event === "error") {
        throw new HerokuApiError(
          "Error in Heroku SSE stream",
          undefined,
          parsedEvent.data,
        );
      }
      if (parsedEvent.event === "done") {
        // Heroku specific: if 'done' event signals end, could break.
        // Otherwise, stream ends when parseHerokuSSE completes.
        break;
      }
      if (parsedEvent.data) {
        try {
          const streamChunk = JSON.parse(
            parsedEvent.data,
          ) as HerokuChatCompletionStreamResponse;
          if (streamChunk.choices && streamChunk.choices.length > 0) {
            const choice = streamChunk.choices[0];
            const delta = choice.delta;
            let currentChunkContent = "";
            let currentToolCallChunks: LocalToolCallChunk[] | undefined =
              undefined;

            if (delta.content) {
              currentChunkContent = delta.content;
              anyContentEmitted =
                anyContentEmitted || currentChunkContent.length > 0;
              if (currentChunkContent.length > 0) {
                await runManager?.handleLLMNewToken(currentChunkContent);
              }
            }

            if (delta.tool_calls && delta.tool_calls.length > 0) {
              currentToolCallChunks = delta.tool_calls.map(
                (tcChunk, tcChunkIndex) => ({
                  name: tcChunk.function?.name,
                  args: tcChunk.function?.arguments,
                  id: tcChunk.id,
                  index: (tcChunk as any).index ?? tcChunkIndex,
                  type: "tool_call_chunk" as const,
                }),
              );
              if (currentToolCallChunks.length > 0) anyToolCallObserved = true;
            }

            const { tool_calls: _deltaToolCalls, ...remainingDelta } = delta;
            const messageChunk = new AIMessageChunk({
              content: currentChunkContent || "",
              tool_call_chunks: currentToolCallChunks as any,
              additional_kwargs: { ...remainingDelta },
            });
            yield messageChunk;
          }
        } catch (e: any) {
          runManager?.handleLLMError(e);
          throw new HerokuApiError(
            "Failed to parse Heroku SSE data chunk",
            undefined,
            { data: parsedEvent.data, error: e.message },
          );
        }
      }
    }

    // If no textual content was emitted but tool calls were observed, emit a synthetic message
    if (!anyContentEmitted && anyToolCallObserved) {
      yield new AIMessageChunk({ content: FALLBACK_TEXT });
    }
  }

  /**
   * LangChain streaming hook. Wraps `_stream` to produce ChatGenerationChunk items
   * so BaseChatModel.stream() uses the streaming path instead of falling back to invoke().
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    for await (const chunk of this._stream(messages, options, runManager)) {
      const chunkText = typeof chunk.content === "string" ? chunk.content : "";
      yield new ChatGenerationChunk({
        message: chunk,
        text: chunkText,
        generationInfo: {
          ...chunk.additional_kwargs,
          tool_calls: (chunk as any).tool_calls,
          tool_results: (chunk.additional_kwargs as any)?.tool_results,
        },
      });
    }
  }

  /**
   * Create a version of this chat model that returns structured output.
   *
   * This method enables the model to return responses that conform to a specific schema,
   * using function calling under the hood. The model is instructed to call a special
   * "extraction" function with the structured data as arguments.
   *
   * @template RunOutput - The type of the structured output
   * @param outputSchema - The schema for the structured output (Zod schema or JSON schema)
   * @param config - Configuration options for structured output
   * @returns A new runnable that returns structured output
   *
   * @example
   * ```typescript
   * import { z } from "zod";
   *
   * // Define the schema for extracted data
   * const personSchema = z.object({
   *   name: z.string().describe("The person's full name"),
   *   age: z.number().describe("The person's age in years"),
   *   occupation: z.string().describe("The person's job or profession"),
   *   skills: z.array(z.string()).describe("List of skills or expertise")
   * });
   *
   * // Create a model that returns structured output
   * const extractionModel = model.withStructuredOutput(personSchema, {
   *   name: "extract_person_info",
   *   description: "Extract structured information about a person"
   * });
   *
   * // Use the model
   * const result = await extractionModel.invoke([
   *   new HumanMessage("Sarah Johnson is a 28-year-old data scientist who specializes in machine learning, Python, and statistical analysis.")
   * ]);
   *
   * console.log(result);
   * // Output: {
   * //   name: "Sarah Johnson",
   * //   age: 28,
   * //   occupation: "data scientist",
   * //   skills: ["machine learning", "Python", "statistical analysis"]
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // With includeRaw option to get both raw and parsed responses
   * const extractionModelWithRaw = model.withStructuredOutput(personSchema, {
   *   includeRaw: true
   * });
   *
   * const result = await extractionModelWithRaw.invoke([
   *   new HumanMessage("John is a 35-year-old teacher.")
   * ]);
   *
   * console.log(result.parsed); // { name: "John", age: 35, occupation: "teacher", skills: [] }
   * console.log(result.raw);    // Original AIMessage with tool calls
   * ```
   *
   * @throws {Error} When method is set to "jsonMode" (not supported)
   */
  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      | Record<string, any>
      | StructuredOutputMethodParams<RunOutput>,
    config?: StructuredOutputMethodOptions,
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    // Handle the case where outputSchema is a StructuredOutputMethodParams object
    let schema: z.ZodType<RunOutput> | Record<string, any>;
    let name: string | undefined;
    let description: string | undefined;
    let method: StructuredOutputMethodOptions["method"];
    let includeRaw: boolean | undefined;

    if (this.isStructuredOutputMethodParams(outputSchema)) {
      schema = outputSchema.schema;
      name = outputSchema.name;
      description = outputSchema.description;
      method = outputSchema.method;
      includeRaw = outputSchema.includeRaw;
    } else {
      schema = outputSchema;
      name = config?.name;
      description = config?.description;
      method = config?.method;
      includeRaw = config?.includeRaw;
    }

    // Default values
    const functionName = name ?? "extract";
    method = method ?? "functionCalling";

    if (method === "jsonMode") {
      throw new Error(
        "ChatHeroku does not support 'jsonMode'. Use 'functionCalling' instead.",
      );
    }

    // Unified: Build parameters and tool once from Zod or JSON schema
    let parametersJson: Record<string, any>;
    let zodSchemaForValidation: z.ZodType<RunOutput> | undefined;
    if (this.isZodSchema(schema)) {
      const zodSchema = schema as z.ZodType<RunOutput>;
      const asJsonSchema = toJsonSchema(zodSchema as any);
      const { $schema: _ignored, ...clean } = asJsonSchema as Record<
        string,
        any
      >;
      parametersJson = clean;
      zodSchemaForValidation = zodSchema;
    } else {
      const { $schema: _ignored, ...clean } = schema as Record<string, any>;
      parametersJson = clean;
    }

    const tool = {
      type: "function" as const,
      function: {
        name: functionName,
        description:
          description ??
          (parametersJson.description as string | undefined) ??
          "A tool to convert data to a specific structured output conforming to the provided schema.",
        parameters: parametersJson,
      },
    };

    // Create a new ChatHeroku instance with the same configuration but with tools pre-bound
    const llm = new ChatHeroku({
      model: this.getModelForRequest(),
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      stop: this.stop,
      topP: this.topP,
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      streaming: this.streaming,
      additionalKwargs: this.additionalKwargs,
    });

    // Override the invocationParams method to include the bound tools and force tool choice
    const originalInvocationParams = llm.invocationParams.bind(llm);
    llm.invocationParams = function (options?: Partial<ChatHerokuCallOptions>) {
      const params = originalInvocationParams(options);
      // Directly pass the tool schema instead of using langchainToolsToHerokuTools
      // since we're not dealing with actual StructuredTool instances
      return {
        ...params,
        tools: [tool],
        tool_choice: {
          type: "function",
          function: { name: functionName },
        },
      };
    };

    const buildParserError = (
      message: string,
      error?: unknown,
      llmOutput?: string,
    ): OutputParserException => {
      const parserError = new OutputParserException(message);
      if (error !== undefined) {
        (parserError as any).cause = error;
      }
      if (llmOutput !== undefined) {
        (parserError as any).llmOutput = llmOutput;
      }
      return parserError;
    };

    const parseToolCallResult = async (
      llmResult: BaseMessage,
    ): Promise<RunOutput> => {
      if (!(llmResult instanceof AIMessage)) {
        throw buildParserError(
          `Expected an AIMessage with a tool call named "${functionName}".`,
          undefined,
          typeof llmResult.content === "string"
            ? llmResult.content
            : JSON.stringify(llmResult.content),
        );
      }

      const toolCalls = llmResult.tool_calls ?? [];
      const matchingToolCall =
        toolCalls.find((tc) => tc.name === functionName) || toolCalls[0];

      if (!matchingToolCall) {
        throw buildParserError(
          `No tool call named "${functionName}" was returned.`,
          undefined,
          typeof llmResult.content === "string"
            ? llmResult.content
            : JSON.stringify(llmResult.content),
        );
      }

      const argsValue =
        (matchingToolCall as any).args ??
        (matchingToolCall as any).function?.arguments;

      if (argsValue === undefined) {
        throw buildParserError(
          `Tool call "${functionName}" did not include arguments.`,
          undefined,
          JSON.stringify(matchingToolCall),
        );
      }

      let parsedArgs: any;
      try {
        parsedArgs =
          typeof argsValue === "string" ? JSON.parse(argsValue) : argsValue;
      } catch (err: any) {
        throw buildParserError(
          `Failed to parse tool arguments for "${functionName}" as JSON.`,
          err,
          typeof argsValue === "string" ? argsValue : JSON.stringify(argsValue),
        );
      }

      if (zodSchemaForValidation) {
        try {
          parsedArgs = await zodSchemaForValidation.parseAsync(parsedArgs);
        } catch (err: any) {
          throw buildParserError(
            `Failed to parse structured tool output for "${functionName}".`,
            err,
            JSON.stringify(parsedArgs),
          );
        }
      }

      return parsedArgs as RunOutput;
    };

    const schemaForPrompt = (() => {
      try {
        return JSON.stringify(parametersJson, null, 2);
      } catch (_err) {
        return undefined;
      }
    })();

    const instructionText = [
      `You must provide the result by calling the function "${functionName}" and nothing else.`,
      schemaForPrompt
        ? `The arguments MUST strictly match this JSON schema:\n${schemaForPrompt}`
        : `The arguments MUST strictly match the provided JSON schema.`,
      "Only use the field names and data types allowed by the schema. Do not invent alternatives or nested structures that are not explicitly permitted.",
      "Return solely the tool call with fully specified arguments and no extra commentary.",
    ].join("\n");

    // Prepend an instruction system message to strongly nudge function calling
    const instruction = new SystemMessage(instructionText);

    const prependInstruction = RunnableLambda.from(
      async (input: BaseLanguageModelInput) => {
        if (Array.isArray(input)) {
          return [instruction, ...input];
        }
        return input;
      },
    );

    const extractMessage = (value: unknown): string | undefined => {
      if (typeof value === "string") return value;
      if (
        typeof value === "object" &&
        value !== null &&
        "message" in value &&
        typeof (value as any).message === "string"
      ) {
        return (value as any).message as string;
      }
      return undefined;
    };

    const formatParserError = (error: unknown): string => {
      const parts = [
        `The previous attempt to call \"${functionName}\" failed JSON schema validation.`,
      ];
      if (error instanceof OutputParserException) {
        const causeMessage = extractMessage(
          (error as { cause?: unknown }).cause,
        );
        if (causeMessage) {
          parts.push(`Validation details: ${causeMessage}`);
        } else if (Array.isArray((error as any).errors)) {
          parts.push(
            `Validation details: ${JSON.stringify((error as any).errors)}`,
          );
        }
        if (typeof error.llmOutput === "string" && error.llmOutput.length > 0) {
          parts.push(
            `Here is the invalid JSON you produced previously:\n${error.llmOutput}`,
          );
        }
      } else {
        const genericMessage = extractMessage(error);
        if (genericMessage) {
          parts.push(`Validation details: ${genericMessage}`);
        }
      }
      parts.push(
        `Re-create the \"${functionName}\" function call with arguments that satisfy the schema exactly. Only respond with the corrected function call arguments.`,
      );
      return parts.join("\n");
    };

    const maxParserRetries = 2;

    const invokeWithInstruction = async (
      originalInput: BaseLanguageModelInput,
      config?: any,
    ) => {
      const prepared = await prependInstruction.invoke(originalInput, config);
      return llm.invoke(prepared, config);
    };

    const runStructured = RunnableLambda.from(
      async (input: BaseLanguageModelInput, config?: any) => {
        let attempts = 0;
        let workingInput: BaseLanguageModelInput = input;
        let lastError: any;

        while (attempts <= maxParserRetries) {
          const llmResult = await invokeWithInstruction(workingInput, config);
          try {
            const parsed = await parseToolCallResult(llmResult);
            return parsed;
          } catch (err: any) {
            lastError = err;
            if (attempts === maxParserRetries) {
              throw err;
            }
            if (Array.isArray(workingInput)) {
              const correction = formatParserError(err);
              workingInput = [...workingInput, new SystemMessage(correction)];
              attempts += 1;
              continue;
            }
            throw err;
          }
        }

        throw lastError;
      },
    );

    if (!includeRaw) {
      return runStructured;
    }

    const runStructuredWithRaw = RunnableLambda.from(
      async (input: BaseLanguageModelInput, config?: any) => {
        let attempts = 0;
        let workingInput: BaseLanguageModelInput = input;
        while (attempts <= maxParserRetries) {
          const llmResult = await invokeWithInstruction(workingInput, config);
          try {
            const parsed = await parseToolCallResult(llmResult);
            return { raw: llmResult, parsed };
          } catch (err: any) {
            if (attempts === maxParserRetries) {
              return { raw: llmResult, parsed: null as any };
            }
            if (Array.isArray(workingInput)) {
              const correction = formatParserError(err);
              workingInput = [...workingInput, new SystemMessage(correction)];
              attempts += 1;
              continue;
            }
            return { raw: llmResult, parsed: null as any };
          }
        }

        return { raw: null as any, parsed: null as any };
      },
    );

    return runStructuredWithRaw;
  }

  /**
   * Helper method to check if input is a Zod schema
   */
  private isZodSchema(input: unknown): input is z.ZodTypeAny {
    if (typeof input !== "object" || input === null) {
      return false;
    }
    return typeof (input as { parse?: unknown }).parse === "function";
  }

  /**
   * Helper method to check if input is StructuredOutputMethodParams
   */
  private isStructuredOutputMethodParams(
    input: any,
  ): input is StructuredOutputMethodParams<any> {
    return input !== undefined && typeof input.schema === "object";
  }

  private injectStructuredOutputInstruction(
    messages: BaseMessage[],
    tools?: HerokuFunctionTool[],
  ): BaseMessage[] {
    if (!tools || tools.length === 0) {
      return messages;
    }

    const structuredTool = tools.find((tool) => {
      const name = tool?.function?.name ?? "";
      const description = tool?.function?.description ?? "";
      return (
        (typeof name === "string" && name.startsWith("extract-")) ||
        description.toLowerCase().includes("structured output")
      );
    });

    if (!structuredTool) {
      return messages;
    }

    const existingInstruction = messages.some(
      (message) =>
        message.getType?.() === "system" &&
        typeof message.content === "string" &&
        message.content.includes(`"${structuredTool.function.name}"`),
    );

    if (existingInstruction) {
      return messages;
    }

    const schemaForPrompt = (() => {
      try {
        return JSON.stringify(structuredTool.function.parameters, null, 2);
      } catch {
        return undefined;
      }
    })();

    const instructionText = [
      `You must provide the final structured result by calling the function "${structuredTool.function.name}" and nothing else.`,
      schemaForPrompt
        ? `The arguments MUST strictly match this JSON schema:\n${schemaForPrompt}`
        : "The arguments MUST strictly match the provided JSON schema.",
      "Only respond with that function call once you have all required information.",
    ].join("\n");

    return [new SystemMessage(instructionText), ...messages];
  }
}
