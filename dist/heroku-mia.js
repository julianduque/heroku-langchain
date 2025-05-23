import { BaseChatModel, } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, } from "@langchain/core/messages";
import { getHerokuConfigOptions, langchainMessagesToHerokuMessages, langchainToolsToHerokuTools, HerokuApiError, } from "./common";
import { parseHerokuSSE } from "./common";
export class HerokuMia extends BaseChatModel {
    // Fields to store constructor parameters
    model;
    temperature;
    maxTokens;
    stop;
    topP;
    herokuApiKey;
    herokuApiUrl;
    maxRetries;
    timeout;
    streaming;
    additionalKwargs;
    static lc_name() {
        return "HerokuMia";
    }
    constructor(fields) {
        super(fields);
        const modelFromEnv = typeof process !== "undefined" &&
            process.env &&
            process.env.INFERENCE_MODEL_ID;
        this.model = fields.model || modelFromEnv || ""; // Keep default as empty string to handle error below
        if (!this.model) {
            throw new Error("Heroku model ID not found. Please set it in the constructor, " +
                "or set the INFERENCE_MODEL_ID environment variable.");
        }
        this.temperature = fields.temperature ?? 1.0;
        this.maxTokens = fields.maxTokens;
        this.stop = fields.stop;
        this.topP = fields.topP ?? 0.999;
        this.herokuApiKey = fields.herokuApiKey;
        this.herokuApiUrl = fields.herokuApiUrl;
        this.maxRetries = fields.maxRetries ?? 2;
        this.timeout = fields.timeout;
        this.streaming = fields.streaming ?? fields.stream ?? false;
        this.additionalKwargs = fields.additionalKwargs ?? {};
        // TODO: Add API key and URL validation/defaulting from ENV vars
    }
    _llmType() {
        return "heroku-mia";
    }
    /**
     * Bind tools to this chat model.
     * @param tools A list of tools to bind to the model.
     * @returns A new instance of this chat model with the tools bound.
     */
    bindTools(tools) {
        const herokuTools = langchainToolsToHerokuTools(tools); // Cast as StructuredTool[] for now
        return this.bind({
            tools: herokuTools, // Pass the Heroku-formatted tools
            tool_choice: "auto", // Or other specific tool_choice if needed by default
        });
    }
    /**
     * Get the parameters used to invoke the model.
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
                runtimeParams.tools = langchainToolsToHerokuTools(options.tools);
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
        const herokuConfig = getHerokuConfigOptions(this.herokuApiKey, this.herokuApiUrl, "/v1/chat/completions");
        const herokuMessages = langchainMessagesToHerokuMessages(messages);
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
                    lastError = new HerokuApiError(`Heroku API request failed with status ${response.status}: ${errorData.message || response.statusText}`, response.status, errorData);
                    break; // Non-retryable client error, exit loop
                }
                lastError = new HerokuApiError(`Heroku API request failed with status ${response.status}: ${response.statusText}`, response.status);
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
            if (lastError instanceof HerokuApiError)
                throw lastError;
            if (lastError)
                throw new HerokuApiError(// Wrap non-HerokuApiError
                `Failed to connect to Heroku API after ${maxRetries + 1} attempts: ${lastError.message}`, response?.status, // status might be undefined if response is undefined
                lastError);
            // Fallback if no specific error was captured but response is not successful
            throw new HerokuApiError("Heroku API request failed after all retries.", response?.status);
        }
        // At this point, response is defined and response.ok is true.
        if (requestPayload.stream) {
            let aggregatedContent = "";
            const toolCallChunks = []; // Use LocalToolCallChunk
            let finalFinishReason = null;
            // let finalUsage: HerokuChatCompletionUsage | undefined = undefined; // If Heroku sends usage in stream
            const allAIMessageChunks = []; // To store individual AIMessageChunks
            try {
                for await (const parsedEvent of parseHerokuSSE(response.body)) {
                    if (parsedEvent.event === "error") {
                        // Hypothetical error event from stream
                        throw new HerokuApiError("Error received in SSE stream", undefined, parsedEvent.data);
                    }
                    // Heroku /v1/chat/completions streams event: message, data: JSON object
                    // and a final event: done, data: {"status": "completed"} (or similar)
                    // We primarily care about event: message for content/tool_calls
                    if (parsedEvent.event === "done") {
                        // Potentially parse final data if it contains usage or status
                        // For now, we just break or let the stream end naturally.
                        console.log("SSE stream 'done' event received:", parsedEvent.data);
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
                                        // tcChunk is Partial<HerokuToolCall>
                                        // LangChain's ToolCallChunk expects an index to group parts of the same tool call.
                                        // If Heroku provides an `index` within its tcChunk, use it.
                                        // Otherwise, use the index from the array map if multiple tool_calls are in one delta.
                                        // The SPECS.md does not specify `index` on HerokuToolCall in streaming delta.
                                        // We will rely on the tcChunkIndex from the map for now or if Heroku adds it later.
                                        return {
                                            name: tcChunk.function?.name,
                                            args: tcChunk.function?.arguments,
                                            id: tcChunk.id,
                                            index: tcChunk.index ?? tcChunkIndex, // Prefer Heroku's index if present, else map index
                                            type: "tool_call_chunk", // Keep as const for type field
                                        };
                                    });
                                    toolCallChunks.push(...currentToolCallChunks);
                                }
                                const { tool_calls: _deltaToolCalls, ...remainingDelta } = delta; // Exclude tool_calls from delta for additional_kwargs
                                allAIMessageChunks.push(new AIMessageChunk({
                                    content: currentChunkContent || "",
                                    tool_call_chunks: currentToolCallChunks, // Cast to any if AIMessageChunk expects official ToolCallChunk[]
                                    additional_kwargs: { ...remainingDelta }, // Store remaining delta fields
                                }));
                                if (choice.finish_reason) {
                                    finalFinishReason = choice.finish_reason;
                                }
                            }
                        }
                        catch (e) {
                            console.error("Error parsing SSE data chunk:", e, "Raw data:", parsedEvent.data);
                            // Decide if this error is fatal for the stream
                            throw new HerokuApiError("Failed to parse SSE data chunk", undefined, { data: parsedEvent.data, error: e.message });
                        }
                    }
                }
            }
            catch (streamError) {
                // Catch errors from parseHerokuSSE or from processing inside the loop
                console.error("Error processing Heroku SSE stream:", streamError);
                throw streamError; // Re-throw to be caught by the outer try/catch or handled by caller
            }
            // After the loop, construct the final ChatGeneration from aggregated data
            const finalMessageChunk = new AIMessageChunk({
                content: aggregatedContent,
                tool_calls: [], // Full tool_calls are constructed from tool_call_chunks by AIMessage
                tool_call_chunks: toolCallChunks.length > 0 ? toolCallChunks : undefined, // Cast to any for AIMessageChunk
                // additional_kwargs can be used if needed
            });
            const generation = {
                message: finalMessageChunk, // LangChain will handle merging chunks internally if this is used in a chain
                text: aggregatedContent, // The full text content
                generationInfo: {
                    finish_reason: finalFinishReason,
                    // Potentially add aggregated usage data if available
                },
            };
            return {
                generations: [generation],
                llmOutput: {
                /* tokenUsage: finalUsage */
                },
            };
        }
        else {
            // Non-streaming response handling
            const herokuResponse = await response.json();
            const choice = herokuResponse.choices[0];
            const toolCalls = choice.message.tool_calls?.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments), // Heroku sends arguments as JSON string
                type: "tool_call", // Ensure literal type for LangChain ToolCall
            }));
            const generation = {
                message: new AIMessage({
                    content: choice.message.content || "",
                    tool_calls: toolCalls,
                    additional_kwargs: { ...choice.message },
                }),
                text: choice.message.content || "",
                generationInfo: {
                    ...(choice.message.role && { role: choice.message.role }), // Add role if present
                    ...(choice.message.name && { name: choice.message.name }), // Add name if present
                    finish_reason: choice.finish_reason, // Explicitly use choice's finish_reason
                    index: choice.index,
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
        const herokuConfig = getHerokuConfigOptions(this.herokuApiKey, this.herokuApiUrl, "/v1/chat/completions");
        const herokuMessages = langchainMessagesToHerokuMessages(messages);
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
                    lastError = new HerokuApiError(`Heroku API request failed: ${errorData.message || response.statusText}`, response.status, errorData);
                    break;
                }
                lastError = new HerokuApiError(`Heroku API request failed with status ${response.status}`, response.status);
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
            throw new HerokuApiError("Failed to connect or get a streaming body from Heroku API.", response?.status);
        }
        // Process the SSE stream
        for await (const parsedEvent of parseHerokuSSE(response.body)) {
            if (parsedEvent.event === "error") {
                throw new HerokuApiError("Error in Heroku SSE stream", undefined, parsedEvent.data);
            }
            if (parsedEvent.event === "done") {
                // Heroku specific: if 'done' event signals end, could break.
                // Otherwise, stream ends when parseHerokuSSE completes.
                runManager?.handleLLMEnd({ generations: [] }); // Pass empty generations
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
                            runManager?.handleLLMNewToken(delta.content);
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
                        const messageChunk = new AIMessageChunk({
                            content: currentChunkContent || "",
                            tool_call_chunks: currentToolCallChunks,
                            additional_kwargs: { ...remainingDelta },
                        });
                        yield messageChunk;
                        if (choice.finish_reason) {
                            // Create a dummy ChatGeneration to pass finish_reason correctly
                            const dummyGeneration = {
                                message: new AIMessageChunk({ content: "" }), // Content can be empty for this purpose
                                text: "",
                                generationInfo: { finish_reason: choice.finish_reason },
                            };
                            runManager?.handleLLMEnd({ generations: [[dummyGeneration]] });
                        }
                    }
                }
                catch (e) {
                    runManager?.handleLLMError(e);
                    throw new HerokuApiError("Failed to parse Heroku SSE data chunk", undefined, { data: parsedEvent.data, error: e.message });
                }
            }
        }
    }
}
//# sourceMappingURL=heroku-mia.js.map