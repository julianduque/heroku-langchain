"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HerokuMia = void 0;
const chat_models_1 = require("@langchain/core/language_models/chat_models");
const messages_1 = require("@langchain/core/messages");
const zod_to_json_schema_1 = require("zod-to-json-schema");
const openai_tools_1 = require("@langchain/core/output_parsers/openai_tools");
const runnables_1 = require("@langchain/core/runnables");
const common_1 = require("./common");
/**
 * **HerokuMia** - Heroku Managed Inference API LangChain Integration
 *
 * A LangChain-compatible chat model that interfaces with Heroku's Managed Inference API (Mia).
 * This class provides access to various language models hosted on Heroku's infrastructure,
 * including support for function calling, structured outputs, and streaming responses.
 *
 * @example
 * ```typescript
 * import { HerokuMia } from "heroku-langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 *
 * // Basic usage
 * const model = new HerokuMia({
 *   model: "claude-3-7-sonnet",
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
 * @see {@link HerokuMiaFields} for constructor options
 * @see {@link HerokuMiaCallOptions} for runtime call options
 * @see [Heroku Managed Inference API Documentation](https://devcenter.heroku.com/articles/heroku-inference-api-v1-chat-completions)
 */
class HerokuMia extends chat_models_1.BaseChatModel {
    // Fields to store constructor parameters
    model;
    temperature;
    maxTokens;
    stop;
    topP;
    apiKey;
    apiUrl;
    maxRetries;
    timeout;
    streaming;
    additionalKwargs;
    /**
     * Returns the LangChain identifier for this model class.
     * @returns The string "HerokuMia"
     */
    static lc_name() {
        return "HerokuMia";
    }
    /**
     * Creates a new HerokuMia instance.
     *
     * @param fields - Optional configuration options for the Heroku Mia model
     * @throws {Error} When model ID is not provided and INFERENCE_MODEL_ID environment variable is not set
     *
     * @example
     * ```typescript
     * // Basic usage with defaults
     * const model = new HerokuMia();
     *
     * // With custom configuration
     * const model = new HerokuMia({
     *   model: "claude-3-7-sonnet",
     *   temperature: 0.7,
     *   maxTokens: 1000,
     *   apiKey: "your-api-key",
     *   apiUrl: "https://us.inference.heroku.com"
     * });
     * ```
     */
    constructor(fields) {
        super(fields ?? {});
        const modelFromEnv = typeof process !== "undefined" &&
            process.env &&
            process.env.INFERENCE_MODEL_ID;
        this.model = fields?.model || modelFromEnv || "";
        if (!this.model) {
            throw new Error("Heroku model ID not found. Please set it in the constructor, " +
                "or set the INFERENCE_MODEL_ID environment variable.");
        }
        this.temperature = fields?.temperature ?? 1.0;
        this.maxTokens = fields?.maxTokens;
        this.stop = fields?.stop;
        this.topP = fields?.topP ?? 0.999;
        this.apiKey = fields?.apiKey;
        this.apiUrl = fields?.apiUrl;
        this.maxRetries = fields?.maxRetries ?? 2;
        this.timeout = fields?.timeout;
        this.streaming = fields?.streaming ?? fields?.stream ?? false;
        this.additionalKwargs = fields?.additionalKwargs ?? {};
    }
    /**
     * Returns the LLM type identifier for this model.
     * @returns The string "HerokuMia"
     */
    _llmType() {
        return "HerokuMia";
    }
    /**
     * Bind tools to this chat model for function calling capabilities.
     *
     * This method creates a new instance of HerokuMia with the specified tools pre-bound,
     * enabling the model to call functions during conversations. The tools will be
     * automatically included in all subsequent calls to the model.
     *
     * @param tools - A list of StructuredTool instances or tool definitions to bind to the model
     * @returns A new HerokuMia instance with the tools bound and tool_choice set to "auto"
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
    bindTools(tools) {
        const herokuTools = (0, common_1.langchainToolsToHerokuTools)(tools);
        // Create a new HerokuMia instance with the same configuration but with tools pre-bound
        const boundInstance = new HerokuMia({
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
        const originalInvocationParams = boundInstance.invocationParams.bind(boundInstance);
        boundInstance.invocationParams = function (options) {
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
    invocationParams(options) {
        const constructorParams = {
            model: this.model,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            stop: this.stop,
            stream: this.streaming,
            top_p: this.topP,
            ...this.additionalKwargs,
        };
        let runtimeParams = {};
        if (options) {
            if (options.temperature !== undefined)
                runtimeParams.temperature = options.temperature;
            if (options.maxTokens !== undefined)
                runtimeParams.max_tokens = options.maxTokens;
            if (options.topP !== undefined)
                runtimeParams.top_p = options.topP;
            if (options.stop !== undefined)
                runtimeParams.stop = options.stop;
            if (options.stream !== undefined)
                runtimeParams.stream = options.stream;
            if (options.tools && options.tools.length > 0) {
                runtimeParams.tools = (0, common_1.langchainToolsToHerokuTools)(options.tools);
            }
            if (options.tool_choice !== undefined) {
                if (typeof options.tool_choice === "string" &&
                    !["none", "auto", "required"].includes(options.tool_choice)) {
                    runtimeParams.tool_choice = {
                        type: "function",
                        function: { name: options.tool_choice },
                    };
                }
                else {
                    runtimeParams.tool_choice =
                        options.tool_choice;
                }
            }
            if (options.additionalKwargs) {
                runtimeParams = { ...runtimeParams, ...options.additionalKwargs };
            }
        }
        return { ...constructorParams, ...runtimeParams };
    }
    async _generate(messages, options, runManager) {
        const herokuConfig = (0, common_1.getHerokuConfigOptions)(this.apiKey, this.apiUrl, "/v1/chat/completions");
        const herokuMessages = (0, common_1.langchainMessagesToHerokuMessages)(messages);
        const params = this.invocationParams(options);
        const requestPayload = {
            model: params.model || this.model,
            messages: herokuMessages,
            temperature: params.temperature,
            max_tokens: params.max_tokens,
            stop: params.stop,
            stream: options.stream ?? this.streaming,
            top_p: params.top_p,
            tools: params.tools,
            tool_choice: params.tool_choice,
            ...params.additionalKwargs,
        };
        Object.keys(requestPayload).forEach((key) => requestPayload[key] === undefined &&
            delete requestPayload[key]);
        let response = undefined;
        let attempt = 0;
        const maxRetries = this.maxRetries ?? 2;
        let lastError;
        let successfulResponse = false;
        while (attempt <= maxRetries) {
            try {
                const abortController = new AbortController();
                let timeoutId;
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
                if (timeoutId)
                    clearTimeout(timeoutId);
                response = currentResponse; // Assign to the outer scope variable
                if (response.ok) {
                    successfulResponse = true;
                    break; // Successful response, exit loop
                }
                if (response.status >= 400 && response.status < 500) {
                    const errorData = await response
                        .json()
                        .catch(() => ({ message: response.statusText }));
                    lastError = new common_1.HerokuApiError(`Heroku API request failed with status ${response.status}: ${errorData.message || response.statusText}`, response.status, errorData);
                    break; // Non-retryable client error, exit loop
                }
                lastError = new common_1.HerokuApiError(`Heroku API request failed with status ${response.status}: ${response.statusText}`, response.status);
            }
            catch (error) {
                lastError = error; // Capture network errors or aborts
            }
            attempt++;
            if (attempt <= maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
        }
        if (!successfulResponse || !response) {
            if (lastError instanceof common_1.HerokuApiError)
                throw lastError;
            if (lastError)
                throw new common_1.HerokuApiError(// Wrap non-HerokuApiError
                `Failed to connect to Heroku API after ${maxRetries + 1} attempts: ${lastError.message}`, response?.status, // status might be undefined if response is undefined
                lastError);
            // Fallback if no specific error was captured but response is not successful
            throw new common_1.HerokuApiError("Heroku API request failed after all retries.", response?.status);
        }
        // At this point, response is defined and response.ok is true.
        if (requestPayload.stream) {
            let aggregatedContent = "";
            const toolCallChunks = []; // Use LocalToolCallChunk
            let finalFinishReason = null;
            // let finalUsage: HerokuChatCompletionUsage | undefined = undefined; // If Heroku sends usage in stream
            const allAIMessageChunks = []; // To store individual AIMessageChunks
            try {
                for await (const parsedEvent of (0, common_1.parseHerokuSSE)(response.body)) {
                    if (parsedEvent.event === "error") {
                        // Hypothetical error event from stream
                        throw new common_1.HerokuApiError("Error received in SSE stream", undefined, parsedEvent.data);
                    }
                    // Heroku /v1/chat/completions streams event: message, data: JSON object
                    // and a final event: done, data: {"status": "completed"} (or similar)
                    // We primarily care about event: message for content/tool_calls
                    if (parsedEvent.event === "done") {
                        // Potentially parse final data if it contains usage or status
                        // For now, we just break or let the stream end naturally.
                        // console.log("SSE stream 'done' event received:", parsedEvent.data);
                        break;
                    }
                    if (parsedEvent.data) {
                        try {
                            const streamChunk = JSON.parse(parsedEvent.data);
                            if (streamChunk.choices && streamChunk.choices.length > 0) {
                                const choice = streamChunk.choices[0];
                                const delta = choice.delta;
                                let currentChunkContent = "";
                                let currentToolCallChunks = undefined; // Use LocalToolCallChunk
                                if (delta.content) {
                                    aggregatedContent += delta.content;
                                    currentChunkContent = delta.content;
                                    runManager?.handleLLMNewToken(delta.content);
                                }
                                if (delta.tool_calls && delta.tool_calls.length > 0) {
                                    currentToolCallChunks = delta.tool_calls.map((tcChunk, tcChunkIndex) => {
                                        return {
                                            name: tcChunk.function?.name,
                                            args: tcChunk.function?.arguments,
                                            id: tcChunk.id,
                                            index: tcChunk.index ?? tcChunkIndex,
                                            type: "tool_call_chunk",
                                        };
                                    });
                                    toolCallChunks.push(...currentToolCallChunks);
                                }
                                const { tool_calls: _deltaToolCalls, ...remainingDelta } = delta;
                                allAIMessageChunks.push(new messages_1.AIMessageChunk({
                                    content: currentChunkContent || "",
                                    tool_call_chunks: currentToolCallChunks,
                                    additional_kwargs: { ...remainingDelta },
                                }));
                                if (choice.finish_reason) {
                                    finalFinishReason = choice.finish_reason;
                                }
                            }
                        }
                        catch (e) {
                            runManager?.handleLLMError(e);
                            throw new common_1.HerokuApiError("Failed to parse SSE data chunk", undefined, { data: parsedEvent.data, error: e.message });
                        }
                    }
                }
            }
            catch (streamError) {
                runManager?.handleLLMError(streamError);
                throw streamError;
            }
            // After the loop, construct the final ChatGeneration from aggregated data
            const aggregatedToolCalls = [];
            if (toolCallChunks.length > 0) {
                const toolCallMap = new Map();
                toolCallChunks.forEach((chunk) => {
                    if (!chunk.id)
                        return;
                    let entry = toolCallMap.get(chunk.id);
                    if (!entry) {
                        entry = { argsSlices: [], index: chunk.index };
                        toolCallMap.set(chunk.id, entry);
                    }
                    if (chunk.name)
                        entry.name = chunk.name;
                    if (chunk.args !== undefined)
                        entry.argsSlices?.push(chunk.args);
                });
                toolCallMap.forEach((assembledTc, id) => {
                    if (assembledTc.name &&
                        assembledTc.argsSlices &&
                        assembledTc.argsSlices.length > 0) {
                        const fullArgsString = assembledTc.argsSlices.join("");
                        try {
                            aggregatedToolCalls.push({
                                id,
                                name: assembledTc.name,
                                args: JSON.parse(fullArgsString),
                                type: "tool_call",
                            });
                        }
                        catch (e) {
                            console.warn(`[HerokuMia] Failed to parse tool call arguments for id ${id}: ${fullArgsString}`, e);
                            aggregatedToolCalls.push({
                                id,
                                name: assembledTc.name,
                                args: fullArgsString, // Keep as string if parsing failed
                                type: "tool_call",
                            });
                        }
                    }
                });
            }
            const finalMessage = new messages_1.AIMessage({
                content: aggregatedContent,
                tool_calls: aggregatedToolCalls.length > 0 ? aggregatedToolCalls : undefined,
                // tool_call_chunks are not typically part of a final AIMessage, they are for streaming.
                // If any other specific kwargs from the last chunk or overall stream are needed, add them here.
                additional_kwargs: { finish_reason: finalFinishReason },
            });
            const generation = {
                message: finalMessage,
                text: aggregatedContent,
                generationInfo: {
                    finish_reason: finalFinishReason,
                },
            };
            return {
                generations: [generation],
                llmOutput: {
                // tokenUsage might be available from a final SSE event if Heroku sends it
                },
            };
        }
        else {
            // Non-streaming response handling
            const herokuResponse = await response.json();
            const choice = herokuResponse.choices[0];
            const parsedToolCalls = choice.message.tool_calls?.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments), // Heroku sends arguments as JSON string
                type: "tool_call",
            }));
            // Destructure choice.message to separate standard fields from true additional_kwargs
            const { role: _role, // Already handled by AIMessage type
            content: msgContent, tool_calls: _rawToolCalls, // Already parsed into parsedToolCalls
            ...restOfMessage // These are the true additional_kwargs
             } = choice.message;
            const generation = {
                message: new messages_1.AIMessage({
                    content: msgContent || "",
                    tool_calls: parsedToolCalls,
                    additional_kwargs: restOfMessage, // Use only the remaining fields
                }),
                text: msgContent || "",
                generationInfo: {
                    finish_reason: choice.finish_reason,
                    index: choice.index,
                    // If restOfMessage contained other relevant top-level choice fields, they could be added here too
                    // e.g., if Heroku adds something like 'system_fingerprint' at the choice.message level
                },
            };
            const llmOutput = {
                tokenUsage: herokuResponse.usage,
                response: herokuResponse, // Include raw response
            };
            return { generations: [generation], llmOutput };
        }
    }
    async *_stream(messages, options, runManager) {
        const herokuConfig = (0, common_1.getHerokuConfigOptions)(this.apiKey, this.apiUrl, "/v1/chat/completions");
        const herokuMessages = (0, common_1.langchainMessagesToHerokuMessages)(messages);
        // Ensure stream is true for this path, overriding constructor/defaults
        const params = this.invocationParams({
            ...options,
            stream: true,
        });
        let herokuToolChoice;
        if (params.tool_choice &&
            typeof params.tool_choice === "string" &&
            !["none", "auto", "required"].includes(params.tool_choice)) {
            herokuToolChoice = {
                type: "function",
                function: { name: params.tool_choice },
            };
        }
        else {
            herokuToolChoice =
                params.tool_choice;
        }
        const requestPayload = {
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
        Object.keys(requestPayload).forEach((key) => requestPayload[key] === undefined &&
            delete requestPayload[key]);
        let response = undefined;
        let attempt = 0;
        const maxRetries = this.maxRetries ?? 2;
        let lastError;
        let successfulResponse = false;
        // Simplified retry for _stream. More complex retry is in _generate for invoke.
        while (attempt <= maxRetries) {
            try {
                const abortController = new AbortController();
                if (this.timeout)
                    setTimeout(() => abortController.abort(), this.timeout);
                const currentResponse = await fetch(herokuConfig.apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${herokuConfig.apiKey}`,
                    },
                    body: JSON.stringify(requestPayload),
                    signal: abortController.signal,
                });
                response = currentResponse;
                if (response.ok) {
                    successfulResponse = true;
                    break;
                }
                if (response.status >= 400 && response.status < 500) {
                    const errorData = await response
                        .json()
                        .catch(() => ({ message: response.statusText }));
                    lastError = new common_1.HerokuApiError(`Heroku API request failed: ${errorData.message || response.statusText}`, response.status, errorData);
                    break;
                }
                lastError = new common_1.HerokuApiError(`Heroku API request failed with status ${response.status}`, response.status);
            }
            catch (error) {
                lastError = error;
            }
            attempt++;
            if (attempt <= maxRetries)
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
        if (!successfulResponse || !response || !response.body) {
            if (lastError)
                throw lastError;
            throw new common_1.HerokuApiError("Failed to connect or get a streaming body from Heroku API.", response?.status);
        }
        // Process the SSE stream
        for await (const parsedEvent of (0, common_1.parseHerokuSSE)(response.body)) {
            if (parsedEvent.event === "error") {
                throw new common_1.HerokuApiError("Error in Heroku SSE stream", undefined, parsedEvent.data);
            }
            if (parsedEvent.event === "done") {
                // Heroku specific: if 'done' event signals end, could break.
                // Otherwise, stream ends when parseHerokuSSE completes.
                break;
            }
            if (parsedEvent.data) {
                try {
                    const streamChunk = JSON.parse(parsedEvent.data);
                    if (streamChunk.choices && streamChunk.choices.length > 0) {
                        const choice = streamChunk.choices[0];
                        const delta = choice.delta;
                        let currentChunkContent = "";
                        let currentToolCallChunks = undefined;
                        if (delta.content) {
                            currentChunkContent = delta.content;
                        }
                        if (delta.tool_calls && delta.tool_calls.length > 0) {
                            currentToolCallChunks = delta.tool_calls.map((tcChunk, tcChunkIndex) => ({
                                name: tcChunk.function?.name,
                                args: tcChunk.function?.arguments,
                                id: tcChunk.id,
                                index: tcChunk.index ?? tcChunkIndex,
                                type: "tool_call_chunk",
                            }));
                        }
                        const { tool_calls: _deltaToolCalls, ...remainingDelta } = delta;
                        const messageChunk = new messages_1.AIMessageChunk({
                            content: currentChunkContent || "",
                            tool_call_chunks: currentToolCallChunks,
                            additional_kwargs: { ...remainingDelta },
                        });
                        yield messageChunk;
                        if (choice.finish_reason) {
                            // Create a dummy ChatGeneration to pass finish_reason correctly
                            const dummyGeneration = {
                                message: new messages_1.AIMessageChunk({ content: "" }), // Content can be empty for this purpose
                                text: "",
                                generationInfo: { finish_reason: choice.finish_reason },
                            };
                            runManager?.handleLLMEnd({ generations: [[dummyGeneration]] });
                        }
                    }
                }
                catch (e) {
                    runManager?.handleLLMError(e);
                    throw new common_1.HerokuApiError("Failed to parse Heroku SSE data chunk", undefined, { data: parsedEvent.data, error: e.message });
                }
            }
        }
    }
    withStructuredOutput(outputSchema, config) {
        // Handle the case where outputSchema is a StructuredOutputMethodParams object
        let schema;
        let name;
        let description;
        let method;
        let includeRaw;
        if (this.isStructuredOutputMethodParams(outputSchema)) {
            schema = outputSchema.schema;
            name = outputSchema.name;
            description = outputSchema.description;
            method = outputSchema.method;
            includeRaw = outputSchema.includeRaw;
        }
        else {
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
            throw new Error("HerokuMia does not support 'jsonMode'. Use 'functionCalling' instead.");
        }
        let llm;
        let outputParser;
        if (this.isZodSchema(schema)) {
            // Convert Zod schema to JSON schema
            const asJsonSchema = (0, zod_to_json_schema_1.zodToJsonSchema)(schema);
            // Remove $schema field as Heroku API doesn't accept it
            const { $schema: _$schema, ...cleanParameters } = asJsonSchema;
            // Create the tool definition
            const tool = {
                type: "function",
                function: {
                    name: functionName,
                    description: description ??
                        asJsonSchema.description ??
                        "A function available to call.",
                    parameters: cleanParameters,
                },
            };
            // Create a new HerokuMia instance with the same configuration but with tools pre-bound
            llm = new HerokuMia({
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
            llm.invocationParams = function (options) {
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
            // Create output parser
            outputParser = new openai_tools_1.JsonOutputKeyToolsParser({
                returnSingle: true,
                keyName: functionName,
                zodSchema: schema,
            });
        }
        else {
            // Handle JSON schema
            const tool = {
                type: "function",
                function: {
                    name: functionName,
                    description: description ??
                        schema.description ??
                        "A function available to call.",
                    parameters: schema,
                },
            };
            // Create a new HerokuMia instance with the same configuration but with tools pre-bound
            llm = new HerokuMia({
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
            llm.invocationParams = function (options) {
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
            // Create output parser
            outputParser = new openai_tools_1.JsonOutputKeyToolsParser({
                returnSingle: true,
                keyName: functionName,
            });
        }
        if (!includeRaw) {
            return llm.pipe(outputParser);
        }
        // Handle includeRaw case
        const parserAssign = runnables_1.RunnablePassthrough.assign({
            parsed: (input, config) => outputParser.invoke(input.raw, config),
        });
        const parserNone = runnables_1.RunnablePassthrough.assign({
            parsed: () => null,
        });
        const parsedWithFallback = parserAssign.withFallbacks({
            fallbacks: [parserNone],
        });
        return runnables_1.RunnableSequence.from([
            {
                raw: llm,
            },
            parsedWithFallback,
        ]);
    }
    /**
     * Helper method to check if input is a Zod schema
     */
    isZodSchema(input) {
        return typeof input?.parse === "function";
    }
    /**
     * Helper method to check if input is StructuredOutputMethodParams
     */
    isStructuredOutputMethodParams(input) {
        return input !== undefined && typeof input.schema === "object";
    }
}
exports.HerokuMia = HerokuMia;
//# sourceMappingURL=heroku-mia.js.map