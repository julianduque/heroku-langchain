import { BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import {
  BaseMessage,
  AIMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { ChatResult, ChatGeneration } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
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

// Types for withStructuredOutput
/**
 * Configuration options for the structured output method.
 *
 * @public
 * @interface StructuredOutputMethodOptions
 * @template IncludeRaw - Whether to include raw response alongside parsed output
 */
export interface StructuredOutputMethodOptions<
  IncludeRaw extends boolean = false,
> {
  /** Optional name for the structured output function */
  name?: string;
  /** Optional description for the structured output function */
  description?: string;
  /** Method to use for structured output - either function calling or JSON mode */
  method?: "functionCalling" | "jsonMode";
  /** Whether to include the raw response alongside the parsed output */
  includeRaw?: IncludeRaw;
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
  IncludeRaw extends boolean = false,
> {
  /** The Zod schema or JSON schema object defining the expected output structure */
  schema: z.ZodType<RunOutput> | Record<string, any>;
  /** Optional name for the structured output function */
  name?: string;
  /** Optional description for the structured output function */
  description?: string;
  /** Method to use for structured output - either function calling or JSON mode */
  method?: "functionCalling" | "jsonMode";
  /** Whether to include the raw response alongside the parsed output */
  includeRaw?: IncludeRaw;
}

/**
 * **ChatHeroku** - Heroku Managed Inference API LangChain Integration
 *
 * A LangChain-compatible chat model that interfaces with Heroku's Managed Inference API (Mia).
 * This class provides access to various language models hosted on Heroku's infrastructure,
 * including support for function calling, structured outputs, and streaming responses.
 *
 * @example
 * ```typescript
 * import { ChatHeroku } from "heroku-langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 *
 * // Basic usage

 * const model = new ChatHeroku({
 *   model: "gpt-oss-120b",
 *   temperature: 0.7,
 *   apiKey: process.env.INFERENCE_KEY,
 *   apiUrl: process.env.INFERENCE_URL
 * });
 *
 * const response = await model.invoke([
 *   new HumanMessage("Explain quantum computing in simple terms")
 * ]);
 * console.log(response.content);
 * ```
 *
 * @example
 * ```typescript
 * // With function calling
 * import { DynamicStructuredTool } from "@langchain/core/tools";
 * import { z } from "zod";
 *
 * const weatherTool = new DynamicStructuredTool({
 *   name: "get_weather",
 *   description: "Get current weather for a location",
 *   schema: z.object({
 *     location: z.string().describe("City name")
 *   }),
 *   func: async ({ location }) => `Weather in ${location}: Sunny, 22°C`
 * });
 *
 * const modelWithTools = model.bindTools([weatherTool]);
 * const result = await modelWithTools.invoke([
 *   new HumanMessage("What's the weather in Paris?")
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // With structured output
 * const extractionSchema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 *   occupation: z.string()
 * });
 *
 * const structuredModel = model.withStructuredOutput(extractionSchema);
 * const extracted = await structuredModel.invoke([
 *   new HumanMessage("John is a 30-year-old software engineer")
 * ]);
 * console.log(extracted); // { name: "John", age: 30, occupation: "software engineer" }
 * ```
 *
 * @example
 * ```typescript
 * // Streaming responses
 * const stream = await model.stream([
 *   new HumanMessage("Write a story about a robot")
 * ]);
 *
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.content);
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

  /**
   * Returns the LangChain identifier for this model class.
   * @returns The string "ChatHeroku"
   */
  static lc_name() {
    return "ChatHeroku";
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
  bindTools(tools: (StructuredTool | Record<string, any>)[]): ChatHeroku {
    const herokuTools = langchainToolsToHerokuTools(tools as StructuredTool[]);

    // Create a new ChatHeroku instance with the same configuration but with tools pre-bound
    const boundInstance = new ChatHeroku({
      model: this.model,
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

    // Override the invocationParams method to include the bound tools
    const originalInvocationParams =
      boundInstance.invocationParams.bind(boundInstance);
    boundInstance.invocationParams = function (
      options?: Partial<ChatHerokuCallOptions>,
    ) {
      const params = originalInvocationParams(options);
      // Merge bound tools with any tools passed in options
      const combinedTools = [...(herokuTools || []), ...(params.tools || [])];
      return {
        ...params,
        tools: combinedTools.length > 0 ? combinedTools : undefined,
        tool_choice: params.tool_choice || "auto",
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
      model: this.model,
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
        runtimeParams.tools = langchainToolsToHerokuTools(
          options.tools as StructuredTool[],
        );
      }
      if (options.tool_choice !== undefined) {
        if (
          typeof options.tool_choice === "string" &&
          !["none", "auto", "required"].includes(options.tool_choice)
        ) {
          runtimeParams.tool_choice = {
            type: "function",
            function: { name: options.tool_choice },
          };
        } else {
          runtimeParams.tool_choice =
            options.tool_choice as HerokuChatCompletionRequest["tool_choice"];
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
    // If streaming is requested, delegate to _stream and aggregate results.
    const shouldStream = (options as any).stream ?? this.streaming;
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

      const finalMessage = new AIMessage({
        content:
          aggregatedContent && aggregatedContent.length > 0
            ? aggregatedContent
            : toolCallChunks.length > 0
              ? FALLBACK_TEXT
              : "",
        tool_calls:
          aggregatedToolCalls.length > 0 ? aggregatedToolCalls : undefined,
        additional_kwargs: finalFinishReason
          ? { finish_reason: finalFinishReason }
          : {},
      });
      const generation: ChatGeneration = {
        message: finalMessage,
        text:
          aggregatedContent && aggregatedContent.length > 0
            ? aggregatedContent
            : aggregatedToolCalls.length > 0
              ? FALLBACK_TEXT
              : "",
        generationInfo: finalFinishReason
          ? { finish_reason: finalFinishReason }
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

    const herokuMessages = langchainMessagesToHerokuMessages(messages);
    const params = this.invocationParams(options);

    const requestPayload: HerokuChatCompletionRequest = {
      model: params.model || this.model,
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

    const parsedToolCalls = choice.message.tool_calls?.map((tc) => ({
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
    const herokuMessages = langchainMessagesToHerokuMessages(messages);
    // Ensure stream is true for this path, overriding constructor/defaults
    const params = this.invocationParams({
      ...options,
      stream: true,
    } as ChatHerokuCallOptions);

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
      model: params.model || this.model,
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

            if (choice.finish_reason) {
              // Create a dummy ChatGeneration to pass finish_reason correctly
              const dummyGeneration: ChatGeneration = {
                message: new AIMessageChunk({ content: "" }), // Content can be empty for this purpose
                text: "",
                generationInfo: { finish_reason: choice.finish_reason },
              };
              runManager?.handleLLMEnd({ generations: [[dummyGeneration]] });
            }
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
    outputSchema: z.ZodType<RunOutput> | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>,
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema: z.ZodType<RunOutput> | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>,
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      | Record<string, any>
      | StructuredOutputMethodParams<RunOutput, boolean>,
    config?: StructuredOutputMethodOptions<boolean>,
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
    let method: "functionCalling" | "jsonMode" | undefined;
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
      const asJsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" });
      const { $schema: _ignored, ...clean } = asJsonSchema as Record<
        string,
        any
      >;
      parametersJson = clean;
      zodSchemaForValidation = schema as z.ZodType<RunOutput>;
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
      model: this.model,
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

    // Create output parser (validate with zod when available)
    const outputParser = new JsonOutputKeyToolsParser<RunOutput>({
      returnSingle: true,
      keyName: functionName,
      ...(zodSchemaForValidation ? { zodSchema: zodSchemaForValidation } : {}),
    });

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
            const parsed = await outputParser.invoke(llmResult, config);
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
        let lastError: any;
        while (attempts <= maxParserRetries) {
          const llmResult = await invokeWithInstruction(workingInput, config);
          try {
            const parsed = await outputParser.invoke(llmResult, config);
            return { raw: llmResult, parsed };
          } catch (err: any) {
            lastError = err;
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

    return runStructuredWithRaw as any;
  }

  /**
   * Helper method to check if input is a Zod schema
   */
  private isZodSchema(input: any): input is z.ZodType<any> {
    return typeof input?.parse === "function";
  }

  /**
   * Helper method to check if input is StructuredOutputMethodParams
   */
  private isStructuredOutputMethodParams(
    input: any,
  ): input is StructuredOutputMethodParams<any, any> {
    return input !== undefined && typeof input.schema === "object";
  }
}
