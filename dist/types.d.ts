import { BaseChatModelCallOptions, BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { StructuredTool } from "@langchain/core/tools";
/**
 * Interface for the fields to instantiate HerokuMia.
 * Extends BaseChatModelParams and includes Heroku-specific parameters.
 */
export interface HerokuMiaFields extends BaseChatModelParams {
    /**
     * The model ID to use for completion (e.g., "claude-3-7-sonnet").
     * As specified in Heroku API documentation.
     * If not provided, defaults to process.env.INFERENCE_MODEL_ID.
     */
    model?: string;
    /**
     * Controls randomness. Lower values make responses more focused.
     * Parameter from Heroku API.
     * @default 1.0
     */
    temperature?: number;
    /**
     * Maximum tokens the model may generate.
     * Maps to max_tokens in Heroku API.
     */
    maxTokens?: number;
    /**
     * List of strings that stop generation.
     * Parameter from Heroku API.
     * @default null
     */
    stop?: string[];
    /**
     * Whether to stream responses. If true, invoke will still return a
     * complete response. Used by stream().
     * Heroku API parameter.
     * @default false
     */
    stream?: boolean;
    /**
     * Proportion of tokens to consider (cumulative probability).
     * Maps to top_p in Heroku API.
     * @default 0.999
     */
    topP?: number;
    /**
     * Heroku Inference API Key (INFERENCE_KEY).
     * If not provided, the library will check the environment variable INFERENCE_KEY.
     * Used for authentication.
     */
    apiKey?: string;
    /**
     * Heroku Inference API Base URL (INFERENCE_URL).
     * If not provided, checks env var INFERENCE_URL or uses a sensible Heroku default.
     * The endpoint path is /v1/chat/completions.
     */
    apiUrl?: string;
    /**
     * Maximum number of retries for failed requests.
     * Standard LangChain parameter for resilience.
     * @default 2
     */
    maxRetries?: number;
    /**
     * Timeout for API requests in milliseconds.
     * Standard LangChain parameter for request duration control.
     */
    timeout?: number;
    /**
     * Alias for stream for consistency. Sets default for internal
     * _generate method's streaming behavior.
     * @default false
     */
    streaming?: boolean;
    /**
     * Allows passing other Heroku-specific parameters not explicitly defined
     * (e.g., extended_thinking).
     * Provides flexibility for future Heroku API additions or less common parameters.
     * @default {}
     */
    additionalKwargs?: Record<string, any>;
}
/**
 * Interface for the options that can be passed at runtime to HerokuMia methods.
 * Extends BaseChatModelCallOptions and includes Heroku-specific tool parameters.
 */
export interface HerokuMiaCallOptions extends BaseChatModelCallOptions {
    /**
     * A list of tools the model may call.
     * LangChain StructuredTool definitions are converted to Heroku's function tool format.
     * See: https://devcenter.heroku.com/articles/heroku-inference-api-v1-chat-completions#tools-array-function-type-tools
     */
    tools?: StructuredTool[];
    /**
     * Controls how the model uses tools.
     * Can be "auto", "required", or an object specifying a particular function to call.
     * See: https://devcenter.heroku.com/articles/heroku-inference-api-v1-chat-completions#tool_choice-parameter
     */
    tool_choice?: "none" | "auto" | "required" | {
        type: "function";
        function: {
            name: string;
        };
    };
    /**
     * Allows passing other Heroku-specific parameters not explicitly defined
     * (e.g., extended_thinking) at runtime.
     */
    additionalKwargs?: Record<string, any>;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stop?: string[];
}
export type HerokuChatMessageRole = "system" | "user" | "assistant" | "tool";
/**
 * Represents a tool call made by the assistant, as per Heroku API.
 * Source: SPECS.md 2.5.3 & Heroku /v1/chat/completions doc (tool_calls array)
 */
export interface HerokuToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
/**
 * Content for a message with role "tool", as per Heroku API.
 * Source: SPECS.md 2.5.4 & Heroku /v1/chat/completions doc (message with role: "tool")
 */
export interface HerokuToolMessageContent {
    tool_call_id: string;
    content: string;
}
/**
 * Structure for a message in the Heroku API request/response.
 * Source: SPECS.md Table HerokuMia Request Mapping & Heroku /v1/chat/completions doc (messages array)
 */
export interface HerokuChatMessage {
    role: HerokuChatMessageRole;
    content: string | HerokuToolMessageContent[];
    name?: string;
    tool_calls?: HerokuToolCall[];
    tool_call_id?: string;
}
/**
 * JSON schema for the parameters of a function tool, as per Heroku API.
 * Source: SPECS.md 2.5.1 & Heroku /v1/chat/completions doc (tools array, function type)
 */
export interface HerokuFunctionToolParameters {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
}
/**
 * Definition for a "function" type tool in a Heroku API request.
 * Source: SPECS.md 2.5.1 & Heroku /v1/chat/completions doc (tools array)
 */
export interface HerokuFunctionTool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: HerokuFunctionToolParameters;
    };
}
/**
 * Request payload for Heroku /v1/chat/completions API.
 * Source: SPECS.md Table HerokuMia Request Mapping & Heroku /v1/chat/completions doc
 */
export interface HerokuChatCompletionRequest {
    model: string;
    messages: HerokuChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stop?: string[];
    stream?: boolean;
    top_p?: number;
    tools?: HerokuFunctionTool[];
    tool_choice?: "none" | "auto" | "required" | {
        type: "function";
        function: {
            name: string;
        };
    };
    extended_thinking?: boolean;
    [key: string]: any;
}
/**
 * A single choice in the Heroku chat completion response.
 * Source: Heroku /v1/chat/completions doc (choices array in response)
 */
export interface HerokuChatCompletionChoice {
    index: number;
    message: HerokuChatMessage;
    finish_reason: string;
}
/**
 * Token usage statistics from the Heroku API response.
 * Source: Heroku /v1/chat/completions doc (usage object in response)
 */
export interface HerokuChatCompletionUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
/**
 * Non-streaming response payload from Heroku /v1/chat/completions API.
 * Source: Heroku /v1/chat/completions doc
 */
export interface HerokuChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: HerokuChatCompletionChoice[];
    usage: HerokuChatCompletionUsage;
    system_fingerprint?: string;
}
/**
 * The delta part of a streaming choice, containing incremental updates.
 * Source: Based on common SSE patterns for LLMs (e.g., OpenAI) & SPECS.md 2.4.2
 * Needs verification against actual Heroku stream format.
 */
export interface HerokuChatCompletionStreamChoiceDelta {
    role?: HerokuChatMessageRole;
    content?: string | null;
    tool_calls?: Partial<HerokuToolCall>[];
}
/**
 * A single choice in a streaming chat completion chunk from Heroku.
 * Source: Based on common SSE patterns & SPECS.md 2.4.2
 */
export interface HerokuChatCompletionStreamChoice {
    index: number;
    delta: HerokuChatCompletionStreamChoiceDelta;
    finish_reason: string | null;
}
/**
 * Streaming response chunk payload from Heroku /v1/chat/completions API (SSE message data).
 * Source: Based on common SSE patterns & SPECS.md 2.4.2
 * Needs verification against actual Heroku stream format.
 */
export interface HerokuChatCompletionStreamResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: HerokuChatCompletionStreamChoice[];
}
/**
 * Represents a chunk of a tool call, e.g., as part of a stream.
 * This is a local definition to ensure compatibility if not available
 * or if there are version mismatches with the installed @langchain/core.
 */
export interface LocalToolCallChunk {
    name?: string;
    args?: string;
    id?: string;
    index?: number;
    type: "tool_call_chunk";
}
/**
 * Interface for the fields to instantiate HerokuMiaAgent.
 * Extends BaseChatModelParams and includes Heroku-specific agent parameters.
 * Based on SPECS.md Table: HerokuMiaAgentFields Constructor Parameters (Section 3.2.2)
 */
export interface HerokuMiaAgentFields extends BaseChatModelParams {
    /**
     * The model ID to use for the agent.
     * If not provided, defaults to process.env.INFERENCE_MODEL_ID.
     */
    model?: string;
    /** Controls randomness of the agent's LLM responses. @default 1.0 */
    temperature?: number;
    /** Max tokens per underlying inference request made by the agent. */
    maxTokensPerRequest?: number;
    /** List of strings that stop generation for the agent's LLM. @default null */
    stop?: string[];
    /** Proportion of tokens to consider for the agent's LLM. @default 0.999 */
    topP?: number;
    /** List of heroku_tool or mcp tools the agent is allowed to use. */
    tools?: HerokuAgentToolDefinition[];
    /** Heroku API Key. Reads from env HEROKU_API_KEY if not provided. */
    apiKey?: string;
    /** Heroku API Base URL. Defaults to inference.heroku.com. */
    apiUrl?: string;
    /** Max retries for API calls @default 2 */
    maxRetries?: number;
    /** Timeout for API calls in ms */
    timeout?: number;
    /** Allows passing any other Heroku-specific agent parameters not explicitly defined. @default {} */
    additionalKwargs?: Record<string, any>;
}
/**
 * Interface for the options that can be passed at runtime to HerokuMiaAgent methods.
 * Extends BaseChatModelCallOptions and includes Heroku-specific agent parameters.
 * Based on SPECS.md Table: HerokuMiaAgentCallOptions Constructor Parameters (Section 3.2.2)
 */
export interface HerokuMiaAgentCallOptions extends BaseChatModelCallOptions {
    metadata?: Record<string, any>;
    sessionId?: string;
    additionalKwargs?: Record<string, any>;
}
/**
 * Defines the structure for tools used by HerokuMiaAgent.
 * Based on SPECS.md Section 3.5.1.
 */
export interface HerokuAgentToolDefinition {
    type: "heroku_tool" | "mcp";
    name: string;
    description?: string;
    runtime_params?: {
        target_app_name: string;
        dyno_size?: string;
        ttl_seconds?: number;
        max_calls?: number;
        tool_params?: Record<string, any>;
    };
}
/**
 * Base request payload for Heroku Agent API interactions.
 */
interface HerokuAgentBaseRequest {
    messages: HerokuChatMessage[];
    model?: string;
    temperature?: number;
    max_tokens_per_inference_request?: number;
    stop?: string[];
    top_p?: number;
    tools?: HerokuAgentToolDefinition[];
    metadata?: Record<string, any>;
    session_id?: string;
}
/**
 * Request payload for POST /v1/agents/heroku/{agentId}/invoke
 * (Assuming it's similar to chat completions, but may differ)
 */
export interface HerokuAgentInvokeRequest extends HerokuAgentBaseRequest {
}
/**
 * Request payload for POST /v1/agents/heroku/{agentId}/stream
 */
export interface HerokuAgentStreamRequest extends HerokuAgentBaseRequest {
}
export interface HerokuAgentInvokeResponse {
    message?: HerokuChatMessage;
    tool_results?: any[];
    session_id?: string;
    error?: any;
}
/** SSE Event: `message.delta` (Equivalent to `chat.completion` content delta) */
export interface HerokuAgentMessageDeltaEvent {
    event: "message.delta";
    data: {
        delta: string;
    };
}
/** SSE Event: `tool.call` (Server signals it's about to call a tool) */
export interface HerokuAgentToolCallEvent {
    event: "tool.call";
    data: {
        id: string;
        name: string;
        input: string;
    };
}
/** SSE Event: `tool.completion` (Server provides result of a tool call) */
export interface HerokuAgentToolCompletionEvent {
    event: "tool.completion";
    data: {
        id: string;
        name: string;
        output: string;
    };
}
/** SSE Event: `tool.error` (Server signals an error during tool execution) */
export interface HerokuAgentToolErrorEvent {
    event: "tool.error";
    data: {
        id?: string;
        name?: string;
        error: string;
    };
}
/** SSE Event: `agent.error` (General agent processing error) */
export interface HerokuAgentAgentErrorEvent {
    event: "agent.error";
    data: {
        message: string;
    };
}
/** SSE Event: `stream.end` (Signals the end of the agent stream) */
export interface HerokuAgentStreamEndEvent {
    event: "stream.end";
    data: {
        final_message?: HerokuChatMessage;
    };
}
/** Union type for all possible Heroku Agent SSE data payloads (after JSON parsing `data` field of ParsedSSEEvent) */
export type HerokuAgentSSEData = HerokuAgentMessageDeltaEvent["data"] | HerokuAgentToolCallEvent["data"] | HerokuAgentToolCompletionEvent["data"] | HerokuAgentToolErrorEvent["data"] | HerokuAgentAgentErrorEvent["data"] | HerokuAgentStreamEndEvent["data"];
export {};
