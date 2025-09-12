# **SPECS.md: @langchain/heroku**

## **1\. Introduction**

This document provides the technical specifications for the @langchain/heroku library. This TypeScript library is designed to facilitate the integration of LangChainJS with Heroku's Managed Inference and Agents (MIA) services.

### **1.1. Purpose of the Library**

The primary objective of the @langchain/heroku library is to offer LangChainJS developers a streamlined and idiomatic way to access Heroku's artificial intelligence capabilities. These capabilities include leveraging Large Language Models (LLMs) through the Heroku Managed Inference API and interacting with tool-using agents via the Heroku Managed Agents API.1

This library will abstract the underlying Heroku API interactions, presenting them through familiar LangChain paradigms such as the Runnable interface and the BaseChatModel class. This approach ensures that developers can readily incorporate Heroku's AI services into their existing LangChain applications and complex workflows, including those built with LangChain Expression Language (LCEL) and LangGraph. By bridging the LangChain framework with Heroku's managed AI infrastructure, the library aims to lower the adoption threshold for LangChain developers seeking to utilize Heroku's AI offerings. The availability of Heroku's inference services, including models like gpt-oss-120b, Cohere, and Stable-Image-Ultra 1, combined with LangChain's development strengths, creates a powerful synergy.

### **1.2. Core Features**

The library will deliver two main sets of features, corresponding to the distinct services offered by Heroku's Managed Inference and Agents.

#### **1.2.1. Heroku Managed Inference (/v1/chat/completions) Integration**

A core component will be the HerokuMia class, designed to be analogous to the @langchain/openai library's ChatOpenAI class. This class will enable interaction with LLMs such as gpt-oss-120b hosted on Heroku's Managed Inference platform.2 It will support standard chat model operations, including single invocations (invoke), streaming responses (stream), and batch processing (batch). A key feature will be the support for Heroku's function type tools, which allow the LLM to request the execution of functions defined and managed on the client-side.3

#### **1.2.2. Heroku Managed Agents (/v1/agents/heroku) Integration**

To interface with Heroku's agentic systems, the library will provide a HerokuMiaAgent class or a similarly purposed Runnable component. This will allow interaction with the /v1/agents/heroku endpoint, which supports more autonomous agent behaviors.4 This integration will include support for Heroku's server-side executed tools, specifically heroku_tool (e.g., dyno_run_command, postgres_get_schema 5) and Model Context Protocol (mcp) tools.6 The library will manage the Server-Sent Events (SSE) response format characteristic of the /v1/agents/heroku endpoint, which can interleave chat completions from the LLM with results from tool executions performed by Heroku.4

### **1.3. Key Design Principles**

The development of @langchain/heroku will adhere to the following design principles:

- **Familiarity:** The library's structure and API will closely mirror those of established LangChain integrations like @langchain/openai.8 This consistency aims to provide a minimal learning curve for developers already proficient with LangChain.
- **LangChain Native:** Deep integration with core LangChain interfaces, notably BaseChatModel 9 and Runnable 10, is paramount. This ensures seamless compatibility with LangChain Expression Language (LCEL) and LangGraph, allowing components from this library to be easily composed into larger AI systems.
- **Type Safety:** TypeScript will be utilized throughout the library to provide robust type checking, enhance code quality, and improve the overall developer experience.
- **Clear Abstraction:** The library will encapsulate the complexities of direct Heroku API calls, offering a clean, intuitive, and high-level interface to the developer.

The distinct nature of Heroku's two primary AI API endpoints—/v1/chat/completions for direct LLM interactions with client-side tool execution 3, and /v1/agents/heroku for agentic interactions with server-side tool execution 4—guides the decision to structure the library around two main classes: HerokuMia and HerokuMiaAgent. This separation ensures clarity in functionality and accurately reflects the different interaction patterns and tool-handling mechanisms of the Heroku services. While they will share underlying authentication and some configuration aspects, their core operational logic and tool management will be distinct.

### **1.4. Dependencies**

The library will rely on the following core dependencies:

- **Core:** @langchain/core for fundamental LangChain types and interfaces such as BaseChatModel, Runnable, message types (e.g., HumanMessage, AIMessage), and callback managers.
- **TypeScript:** For the development language and type system.
- **HTTP Client (Potentially):** A lightweight HTTP client library or the native Node.js fetch API will be used for making requests to the Heroku API endpoints.
- **SSE Parsing (Potentially):** A library for parsing Server-Sent Events or a minimal custom implementation may be required if native capabilities are insufficient, particularly for handling the streaming responses from Heroku.

## **2\. Core Component: HerokuMia (for Chat Completions)**

The HerokuMia class will serve as the primary interface for interacting with Heroku's Managed Inference API, specifically the /v1/chat/completions endpoint. This component is designed for direct chat-based interactions with Large Language Models hosted on Heroku.

### **2.1. Overview and Purpose**

HerokuMia enables developers to utilize Heroku-hosted LLMs in a manner analogous to how ChatOpenAI is used for OpenAI models within the LangChain ecosystem. It supports essential chat model functionalities: single, non-streaming invocations; real-time streaming of responses; and batch processing of multiple chat inputs. Furthermore, HerokuMia will facilitate the use of function tools, a mechanism where the LLM can describe a function it needs executed, and the client application is responsible for running that function and returning the result.3

#### **2.1.1. Example Usage:**

```typescript
import { HerokuMia } from "@langchain/heroku";
import { HumanMessage } from "@langchain/core/messages";
const llm = new HerokuMia({
  // apiKey: "your\_inference\_key", // Can be set via env HEROKU\_API\_KEY
  // apiUrl: "your\_inference\_url", // Can be set via env HEROKU\_API\_URL
  model: "gpt-oss-120b", // Model ID as per Heroku documentation \[3\]
  temperature: 0.5, // Controls randomness \[3\]
  maxTokens: 1024, // Max tokens for generation, maps to 'max\_tokens' \[3\]
});

const response = await llm.invoke([
  new HumanMessage("Hello Mia, tell me about Heroku Inference."),
]);
console.log(response.content);

// Example with streaming
const stream = await llm.stream([
  new HumanMessage("Explain streaming in 50 words."),
]);
for await (const chunk of stream) {
  console.log(chunk.content);
}
```

### **2.2. Class Definition**

#### **2.2.1. Inheritance**

The HerokuMia class will extend BaseChatModel from @langchain/core:  
export class HerokuMia extends BaseChatModel\<HerokuMiaCallOptions, AIMessageChunk\>  
This inheritance structure aligns with the pattern established by ChatOpenAI 8 and ensures that HerokuMia is compatible with LangChain's core chat model functionalities and can be used as a standard building block in LangChain applications.9 The AIMessageChunk type parameter signifies its capability to handle streaming responses by emitting chunks of an AI message.

#### **2.2.2. Constructor Parameters**

The constructor for HerokuMia will accept an optional fields object of type HerokuMiaFields. This interface will extend BaseChatModelParams (from @langchain/core) and include configurations specific to the Heroku Managed Inference API. The separation of constructor fields from runtime call options is a standard LangChain pattern 8, allowing for model-wide defaults to be set at instantiation while permitting per-call overrides for specific parameters. This design provides flexibility, for instance, by allowing a default temperature to be set for the model, which can then be adjusted for individual invocations requiring different levels of creativity.

**Table: HerokuMiaFields Constructor Parameters**

| Parameter        | Type                  | Description                                                                                           | Heroku API Equivalent | Default Value                        | Required | Notes                                                                                                                      |
| :--------------- | :-------------------- | :---------------------------------------------------------------------------------------------------- | :-------------------- | :----------------------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------- |
| model            | string                | The model ID to use for completion (e.g., "gpt-oss-120b").                                       | model                 | (None, must be provided)             | Yes      | As specified in Heroku API documentation.3                                                                                 |
| temperature      | number (0.0 to 1.0)   | Controls randomness. Lower values make responses more focused.                                        | temperature           | 1.0 3                                | No       | Parameter from Heroku API.3                                                                                                |
| maxTokens        | number                | Maximum tokens the model may generate.                                                                | max_tokens            | Varies by model 3                    | No       | Maps to max_tokens in Heroku API.3 LangChain commonly uses maxTokens.                                                      |
| stop             | string                | List of strings that stop generation.                                                                 | stop                  | null 3                               | No       | Parameter from Heroku API.3                                                                                                |
| stream           | boolean               | Whether to stream responses. If true, invoke will still return a complete response. Used by stream(). | stream                | false 3                              | No       | Heroku API parameter.3 This field sets a default; actual streaming is primarily determined by calling the stream() method. |
| topP             | number (0.0 to 1.0)   | Proportion of tokens to consider (cumulative probability).                                            | top_p                 | 0.999 3                              | No       | Maps to top_p in Heroku API.3 LangChain commonly uses topP.                                                                |
| apiKey           | string                | Heroku Inference API Key (INFERENCE_KEY).                                                             | Authorization Header  | process.env.INFERENCE_KEY            | No       | If not provided, the library will check the environment variable. Used for authentication.3                                |
| apiUrl           | string                | Heroku Inference API Base URL (INFERENCE_URL).                                                        | (Request URL)         | process.env.INFERENCE_URL or default | No       | If not provided, checks env var or uses a sensible Heroku default. The endpoint path is /v1/chat/completions.2             |
| maxRetries       | number                | Maximum number of retries for failed requests.                                                        | N/A (Client-side)     | 2 8                                  | No       | Standard LangChain parameter for resilience.                                                                               |
| timeout          | number (milliseconds) | Timeout for API requests.                                                                             | N/A (Client-side)     | (LangChain common default) 8         | No       | Standard LangChain parameter for request duration control.                                                                 |
| streaming        | boolean               | Alias for stream for consistency. Sets default for internal \_generate method's streaming behavior.   | stream                | false                                | No       |                                                                                                                            |
| additionalKwargs | Record\<string, any\> | Allows passing other Heroku-specific parameters not explicitly defined (e.g., extended_thinking 3).   | (Varies)              | {}                                   | No       | Provides flexibility for future Heroku API additions or less common parameters.                                            |

#### **2.2.3. HerokuMiaCallOptions Interface**

export interface HerokuMiaCallOptions extends BaseChatModelCallOptions

This interface will define the options that can be passed at runtime to methods like invoke, stream, and batch. These options can override the default values set in the constructor (e.g., temperature, maxTokens, topP, stop). Critically, HerokuMiaCallOptions will include tools for defining client-side functions the model can call, and tool_choice to control how the model uses these tools, aligning with the Heroku API specifications.3

### **2.3. Core Methods (implementing/overriding BaseChatModel and Runnable interfaces)**

The HerokuMia class will implement standard methods from the BaseChatModel and Runnable interfaces to ensure seamless integration within the LangChain ecosystem.10

#### **2.3.1. invoke(input: BaseLanguageModelInput, options?: Partial\<HerokuMiaCallOptions\>): Promise\<AIMessageChunk\>**

This method implements the Runnable interface's invoke function. It processes a single input (e.g., a list of messages or a prompt string) and returns a single AIMessageChunk representing the model's complete response. Internally, this method will call the \_generate method and format its output. Even if streaming is enabled by default in the constructor or via options.stream, invoke is expected to aggregate the full response.

##### **2.3.2. stream(input: BaseLanguageModelInput, options?: Partial\<HerokuMiaCallOptions\>): Promise\<IterableReadableStream\<AIMessageChunk\>\>**

This method, also part of the Runnable interface, is the primary way to handle streaming responses. When called, it will make a request to the Heroku API with stream: true in the payload.3 The method will then parse the incoming Server-Sent Events (SSE) from Heroku, yielding AIMessageChunk objects as they are received. Each chunk may contain a delta of the message content or updates to tool call information. The Heroku API for /v1/chat/completions suggests that when stream: true, responses are delivered as SSE, with each event: message containing a JSON payload, and a final event: done with data:.3 The stream method must correctly parse these events and transform them into AIMessageChunk instances, accumulating content and tool calls appropriately as they arrive across multiple chunks.

##### **2.3.3. batch(inputs: BaseLanguageModelInput, options?: Partial\<HerokuMiaCallOptions\> | Partial\<HerokuMiaCallOptions\>, batchOptions?: RunnableBatchOptions): Promise\<(AIMessageChunk | Error)\>**

This Runnable interface method is designed for processing multiple inputs. The default implementation in BaseChatModel typically calls invoke for each input. This behavior can be overridden if the Heroku API offers a more efficient batch processing endpoint. As the Heroku /v1/chat/completions API documentation 3 does not explicitly describe a batch input mode, the initial implementation will likely rely on concurrent invoke calls, respecting the maxConcurrency setting from RunnableConfig if provided.

##### **2.3.4. Internal: \_generate(messages: BaseMessage, options: this\["ParsedCallOptions"\], runManager?: CallbackManagerForLLMRun): Promise\<ChatResult\>**

This is the core abstract method from BaseChatModel that HerokuMia must implement.9 It receives an array of BaseMessage objects (converted from the BaseLanguageModelInput) and parsed call options. Its responsibilities include:

1. Formatting the LangChain messages and options into the JSON request body expected by the Heroku /v1/chat/completions API (see Section 2.4.1).
2. Executing the HTTP POST request to Heroku, including the necessary Authorization header.
3. If streaming is active (based on options.stream or the constructor's streaming default):
   - Iterating over the SSE stream from Heroku.
   - Accumulating content and tool call information from the delta chunks received in each SSE message.
   - Invoking runManager?.handleLLMNewToken() for each token or chunk to support LangChain callbacks.
4. Parsing the complete API response (for non-streaming calls) or the aggregated data from a streaming call (see Section 2.4.2).
5. Returning a ChatResult object. This object encapsulates the generated ChatMessage (typically an AIMessage) and LLMOutput (which includes metadata like token usage statistics and the finish reason).

##### **2.3.5. Internal: \_llmType(): string**

This method, required by BaseChatModel 9, returns a string identifier for the language model type, such as "heroku-mia".

##### **2.3.6. Other relevant BaseChatModel methods**

- getNumTokens(text: string): Promise\<number\>: This method could potentially be implemented if Heroku provides a dedicated token counting mechanism or if a client-side tokenizer compatible with the Heroku models (e.g., for gpt-oss-120b) is available and integrated. Alternatively, it might rely on the usage data returned in API responses or provide a rough estimation.
- invocationParams(options?: Partial\<HerokuMiaCallOptions\>): any: As defined in BaseChatModel 9, this method should return the parameters that will be used to invoke the model. This is valuable for logging, debugging, and ensuring transparency in model calls.

### **2.4. API Integration: /v1/chat/completions** 3

This section details the mapping between LangChain's inputs/options and the Heroku /v1/chat/completions API, as well as how responses are parsed.

#### **2.4.1. Request Formatting**

The accurate translation of LangChain's abstract inputs and options into the concrete JSON payload expected by the Heroku API is critical for correct operation. The following table outlines this mapping:

**Table: HerokuMia Request Mapping**

| LangChain Input/Option                           | Heroku API Parameter      | Transformation Logic                                                                                                                                                                                                                                                          | Source(s)                             |
| :----------------------------------------------- | :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| messages: BaseMessage                            | messages (array)          | Each BaseMessage is converted: HumanMessage to {role: "user", content: string}; AIMessage to {role: "assistant", content: string, tool_calls?:...}; SystemMessage to {role: "system", content: string}; ToolMessage to {role: "tool", tool_call_id: string, content: string}. | 3 (messages array of objects section) |
| this.model / options.model                       | model (string)            | Directly passed.                                                                                                                                                                                                                                                              | 3 (Required Parameters)               |
| this.temperature / options.temperature           | temperature (float)       | Directly passed.                                                                                                                                                                                                                                                              | 3 (Optional Parameters)               |
| this.maxTokens / options.maxTokens               | max_tokens (integer)      | Directly passed.                                                                                                                                                                                                                                                              | 3 (Optional Parameters)               |
| this.stop / options.stop                         | stop (array)              | Directly passed.                                                                                                                                                                                                                                                              | 3 (Optional Parameters)               |
| this.streaming / options.stream                  | stream (boolean)          | Directly passed.                                                                                                                                                                                                                                                              | 3 (Optional Parameters)               |
| this.topP / options.topP                         | top_p (float)             | Directly passed.                                                                                                                                                                                                                                                              | 3 (Optional Parameters)               |
| options.tools                                    | tools (array)             | LangChain StructuredTool definitions are converted to Heroku's function tool format (see Section 2.5.1).                                                                                                                                                                      | 3 (tools array, function type tools)  |
| options.tool_choice                              | tool_choice (enum/object) | Directly passed. LangChain's representation of forced tool choice will be mapped to Heroku's tool_choice object structure if necessary.                                                                                                                                       | 3 (tool_choice parameter)             |
| this.additionalKwargs / options.additionalKwargs | (Varies)                  | Merged into the request body, allowing pass-through for parameters like extended_thinking.                                                                                                                                                                                    | 3 (e.g., extended_thinking)           |

#### **2.4.2. Response Parsing**

- **Standard (non-streaming) response to AIMessageChunk / ChatResult:** The JSON response from Heroku 3 is parsed. The content and any tool_calls from choices.message are used to construct an AIMessage. Token usage statistics (prompt_tokens, completion_tokens, total_tokens) from the usage field are extracted and included in the LLMOutput. The finish_reason is mapped, and other metadata like id, model, and system_fingerprint are stored, typically in LLMOutput or AIMessage.additional_kwargs.
- **Streaming response (SSE) to IterableReadableStream\<AIMessageChunk\>:** Each SSE message event is expected to contain a JSON payload representing a "chunk" of the completion. While 3 details the non-streaming response, it confirms that stream: true enables SSE. If Heroku's streaming format mirrors common conventions (like OpenAI's), the delta field within the chunk's choices would provide incremental updates to AIMessageChunk.content or AIMessageChunk.tool_call_chunks. The finish_reason from the last relevant chunk would be used. Token usage information might only be available in the final chunk of the stream or not at all during streaming; it should be aggregated if possible. The precise structure of these streaming chunks from Heroku's /v1/chat/completions endpoint needs to be verified during implementation, as it's not explicitly detailed in 3, unlike the agent endpoint.4 An OpenAI-compatible delta format for content and tool calls within choices.delta is a reasonable assumption, but flexibility for adaptation is necessary.

### **2.5. Function Calling Support (Heroku function type tools)** 3

HerokuMia will support the function calling capability of the Heroku /v1/chat/completions API, allowing the LLM to request the execution of client-defined functions.

#### **2.5.1. Defining Tools**

Users will define tools using LangChain's standard mechanisms, such as StructuredTool from @langchain/core/tools or by creating tools from Zod schemas.11 The @langchain/heroku library must then convert these LangChain-native tool definitions into the specific JSON format expected by Heroku's tools array when type: "function" is specified.3 This conversion involves mapping the tool's name, description, and its input parameters (as a JSON schema). The convertToOpenAIFunction utility from @langchain/core 13, or similar logic found in @langchain/openai, can be adapted for this purpose, given the similarity between Heroku's function tool schema and OpenAI's. This reuse of existing LangChain utilities is preferable for consistency and development efficiency.

#### **2.5.2. Passing Tools in Requests**

Once converted, the tool definitions are included in the tools array of the JSON request body sent to the /v1/chat/completions endpoint.3 The tool_choice parameter (e.g., values like "auto", "required", or an object specifying a particular function to call) will also be supported and passed through HerokuMiaCallOptions, as described in the Heroku API documentation.3

#### **2.5.3. Handling tool_calls in Assistant Responses**

If the LLM determines that one or more tools should be invoked to fulfill the user's request, the Heroku API response will include a tool_calls array within the assistant message.3 Each object in this array typically contains a unique id for the call, type: "function", and a function object detailing the name of the function to be called and its arguments (as a JSON-formatted string). HerokuMia will parse these tool_calls and include them in the returned AIMessage (or AIMessageChunk for streaming responses), usually within the message.tool_calls property, which is a standard field in LangChain's AIMessage.

#### **2.5.4. Formatting tool messages for subsequent requests**

After the client application executes the function(s) requested by the LLM, the results must be communicated back to the model in a subsequent API request. This is achieved by constructing BaseMessage instances of type ToolMessage. Each ToolMessage must contain the content (the output of the tool execution, typically as a string) and the tool_call_id that corresponds to the original tool_call request from the assistant.3 This request-response cycle involving tool calls and results is a standard pattern in LangChain for implementing tool-using agents and chains.

### **2.6. Error Handling Specific to /v1/chat/completions**

The library will implement robust error handling for interactions with the /v1/chat/completions endpoint. This includes:

- Properly handling HTTP status codes indicating client errors (4xx) or server errors (5xx) from the Heroku API.
- Parsing structured error responses from Heroku, if provided in JSON format, and translating them into appropriate LangChain-specific exceptions (e.g., LLMOutputParseException, RateLimitError, or a custom HerokuApiError).
- Implementing a retry mechanism, governed by the maxRetries constructor parameter, for transient network issues or specific retryable API errors.

## **3\. Core Component: HerokuMiaAgent (for Agents)**

The HerokuMiaAgent class (or a dedicated Runnable composition if a direct BaseChatModel extension proves unsuitable) is designed to interface with Heroku's Managed Agents API, specifically the /v1/agents/heroku endpoint. This endpoint enables more complex agentic interactions where Heroku's backend can autonomously invoke predefined heroku_tool and mcp tools over multiple steps.

### **3.1. Overview and Purpose**

HerokuMiaAgent allows developers to harness Heroku's agentic functionalities. Unlike HerokuMia where tool execution is client-managed, /v1/agents/heroku supports server-side tool execution by Heroku itself.4 The library component must handle the specific request structure for this endpoint and, crucially, process the unique streaming Server-Sent Events (SSE) response format. This SSE stream can interleave messages from the LLM (chat completions) with notifications and results of tools executed by Heroku.4

The design of this component presents a unique challenge compared to typical chat model integrations. The "agent loop" (LLM response \-\> Tool Invocation \-\> Tool Result \-\> LLM response) is partially managed by Heroku. The LangChain library's role is to represent this complex, multi-event flow. While the aim is to align HerokuMiaAgent with the BaseChatModel interface for consistency (e.g., by having invoke or stream methods), the nature of the /v1/agents/heroku API means that a single user input can trigger a sequence of events from Heroku. These events (LLM text, tool calls made by the Heroku agent, and tool results executed by Heroku) must be surfaced to the LangChain user in a coherent manner. If mapping this rich SSE stream directly to AIMessageChunk proves too restrictive for all LangChain use cases, HerokuMiaAgent might be implemented as a custom RunnableGenerator that yields more distinctly typed events. However, the initial approach will be to adapt it to the BaseChatModel pattern, potentially by encoding different event types from Heroku within the AIMessageChunk structure, for example, using additional_kwargs.

#### **3.1.1. Example Usage:**

```typescript

import { HerokuMiaAgent } from "@langchain/heroku";
import { HumanMessage } from "@langchain/core/messages";

const agentExecutor \= new HerokuMiaAgent({
    // apiKey: "your\_inference\_key",
    // apiUrl: "your\_inference\_url",
    model: "gpt-oss-120b", // Or other agent-compatible model
    tools:  [
      {
        type: "heroku_tool",
        name: "dyno_run_command",
            runtime_params: {
                target_app_name: "my-heroku-app-name",
                tool_params: {
                    cmd: "date",
                    description: "Gets the current date and time on the server.",
                    // 'parameters' for dyno_run_command defines inputs for the command itself
                    parameters: { type: "object", properties: {} }
                }
            }
        }
    \]
});

// The stream will yield AIMessageChunk objects.
// These chunks can represent different parts of the agent's turn:
// \- Chunks with 'content' represent the LLM's textual response.
// \- Chunks may have 'additional\_kwargs.tool\_calls' if the agent decides to call a tool.
// \- Chunks may have 'additional\_kwargs.tool\_results' (conceptual) when Heroku streams back a tool execution result.
const stream = await agentExecutor.stream([
    new HumanMessage("What time is it on the app server?")
]);

for await (const chunk of stream) {
    if (chunk.content) {
        process.stdout.write(chunk.content);
    }
    // Check for tool calls made by the agent (from an assistant message within a chat.completion event)
    if (chunk.additional_kwargs?.tool_calls) {
        console.log("\\nAgent wants to call tools:", chunk.additional_kwargs.tool_calls);
    }
    // Check for tool results from Heroku (derived from a tool.completion event)
    // The exact structure of 'tool\_results' needs careful design during implementation.
    if (chunk.additional_kwargs?.tool_results) {
        console.log("\\nHeroku executed tool, result:", chunk.additional_kwargs.tool_results);
    }
}
```

The tool_results field within additional_kwargs is a conceptual representation. The actual implementation will depend on how tool.completion events from the Heroku API 4 are effectively mapped to AIMessageChunk objects.

### **3.2. Class Definition**

#### **3.2.1. Inheritance**

Tentatively, HerokuMiaAgent will extend BaseChatModel:  
export class HerokuMiaAgent extends BaseChatModel\<HerokuMiaAgentCallOptions, AIMessageChunk\>  
This aligns with the goal of consistency with other LangChain chat models. However, as noted in Section 3.1, if the multi-event SSE stream from /v1/agents/heroku cannot be mapped meaningfully to AIMessageChunk for all LangChain use cases (especially within LCEL and LangGraph), an alternative implementation as a custom Runnable (e.g., RunnableGenerator\<BaseLanguageModelInput, AgentEvent\>) might be considered. The primary effort will be to make the BaseChatModel inheritance work effectively.

#### **3.2.2. Constructor Parameters**

The constructor will accept an optional fields object of type HerokuMiaAgentFields. This interface will include parameters specific to the /v1/agents/heroku API endpoint, such as agent-level configuration and definitions for server-side tools.

**Table: HerokuMiaAgentFields Constructor Parameters**

| Parameter           | Type                      | Description                                                                                          | Heroku API Equivalent            | Default Value                        | Required | Notes                                                                                 |
| :------------------ | :------------------------ | :--------------------------------------------------------------------------------------------------- | :------------------------------- | :----------------------------------- | :------- | :------------------------------------------------------------------------------------ |
| model               | string                    | The model ID to use for the agent.                                                                   | model                            | (None, must be provided)             | Yes      | As specified in Heroku API documentation.4                                            |
| temperature         | number (0.0 to 1.0)       | Controls randomness of the agent's LLM responses.                                                    | temperature                      | 1.0 4                                | No       | Parameter from Heroku API.4                                                           |
| maxTokensPerRequest | number                    | Max tokens per underlying inference request made by the agent.                                       | max_tokens_per_inference_request | Varies by model 4                    | No       | Maps to max_tokens_per_inference_request in Heroku API.4                              |
| stop                | string                    | List of strings that stop generation for the agent's LLM.                                            | stop                             | null 4                               | No       | Parameter from Heroku API.4                                                           |
| topP                | number (0.0 to 1.0)       | Proportion of tokens to consider for the agent's LLM.                                                | top_p                            | 0.999 4                              | No       | Maps to top_p in Heroku API.4                                                         |
| tools               | HerokuAgentToolDefinition | List of heroku_tool or mcp tools the agent is allowed to use (see Section 3.5.1).                    | tools                            | null 4                               | No       | Tool definitions specific to the agent endpoint.4 Structure defined in Section 3.5.1. |
| apiKey              | string                    | Heroku Inference API Key (INFERENCE_KEY).                                                            | Authorization Header             | process.env.INFERENCE_KEY            | No       | Shared with HerokuMia.                                                                |
| apiUrl              | string                    | Heroku Inference API Base URL (INFERENCE_URL).                                                       | (Request URL)                    | process.env.INFERENCE_URL or default | No       | Endpoint path for agents is /v1/agents/heroku.2                                       |
| maxRetries          | number                    | Max retries for the initial request to the agent endpoint.                                           | N/A (Client-side)                | 2                                    | No       | Standard LangChain parameter for resilience.                                          |
| timeout             | number (milliseconds)     | Timeout for the initial request. Note: The SSE stream itself can be long-lived.                      | N/A (Client-side)                |                                      | No       | Controls timeout for establishing the connection.                                     |
| additionalKwargs    | Record\<string, any\>     | Allows passing any other Heroku-specific agent parameters not explicitly defined in the constructor. | (Varies)                         | {}                                   | No       | For future-proofing or less common parameters.                                        |

#### **3.2.3. HerokuMiaAgentCallOptions Interface**

export interface HerokuMiaAgentCallOptions extends BaseChatModelCallOptions

This interface will define options passable at runtime. It may include overrides for constructor parameters like temperature. Unlike HerokuMiaCallOptions, it might not require tools or tool_choice fields, as the tools for the /v1/agents/heroku endpoint are typically defined as part of the initial request payload and are persistent for that agent session.4

### **3.3. Core Methods**

#### **3.3.1. invoke(input: BaseLanguageModelInput, options?: Partial\<HerokuMiaAgentCallOptions\>): Promise\<AIMessageChunk\>**

If HerokuMiaAgent is implemented as a BaseChatModel, the invoke method would initiate a request to /v1/agents/heroku and then consume the entire SSE stream. It would need to aggregate all chat.completion (LLM responses/thoughts) and tool.completion (Heroku-executed tool results) events into a final, coherent AIMessageChunk or ChatResult. This aggregation is complex because a single "invoke" can correspond to multiple turns of LLM reasoning and tool usage managed by the Heroku backend. The resulting AIMessageChunk would likely concatenate all textual content from the LLM and summarize the tool interactions within its additional_kwargs.

#### **3.3.2. stream(input: BaseLanguageModelInput, options?: Partial\<HerokuMiaAgentCallOptions\>): Promise\<IterableReadableStream\<AIMessageChunk\>\>**

This method is likely the more natural and primary way to interact with the /v1/agents/heroku endpoint due to its inherently streaming nature. It will make the API request and then yield AIMessageChunk objects as they are derived from the SSE stream.

Handling Streaming Responses (SSE from /v1/agents/heroku) 4:  
The method will establish a connection to the SSE stream from the /v1/agents/heroku endpoint. It will then process events as follows:

- **Processing event: message with object: "chat.completion":**
  - The JSON payload of the event is parsed.4
  - The message field within choices, which has role: "assistant", contains either LLM-generated textual content or tool_calls if the Heroku-managed agent decides to use a tool.
  - An AIMessageChunk is yielded. This chunk will contain the content delta (if any) or the tool_calls information. Tool calls are typically mapped to AIMessageChunk.tool_call_chunks or stored in AIMessageChunk.additional_kwargs.tool_calls.
  - The finish_reason (e.g., "tool_calls" indicating the agent is now invoking a tool, or "stop" indicating the agent has finished its turn) is an important piece of information from this event.
- **Processing event: message with object: "tool.completion":**
  - The JSON payload is parsed.4
  - The message field within choices, which has role: "tool", contains the content (the output from the tool executed by Heroku) and the tool_call_id it corresponds to.
  - An AIMessageChunk is yielded to represent this tool result. Since AIMessageChunk is primarily for assistant messages, this chunk might have empty or null content but convey the tool result details through its additional_kwargs. For example: additional_kwargs: { tool_results: \[{ tool_call_id: string, content: string, name: string }\] }. The design of this mapping is crucial for usability in LCEL and LangGraph.
- **Processing event: done:**
  - This event, with data:, signifies the end of the Heroku agent's interaction for that particular user request. The SSE stream should be closed.

The primary challenge in this stream method is to map these distinctly different SSE event types (chat.completion and tool.completion) into a unified stream of AIMessageChunk objects that LangChain tools and developers can work with effectively. A tool.completion event represents a tool's output, akin to a ToolMessage in LangChain, not an AI's direct utterance. Storing this information within AIMessageChunk.additional_kwargs is the most straightforward approach if strict adherence to AIMessageChunk as the output type is maintained. This makes client-side parsing of additional_kwargs important for applications that need to react to tool results.

### **3.4. API Integration: /v1/agents/heroku** 4

This section details the mapping of LangChain inputs to the Heroku /v1/agents/heroku API request format.

#### **3.4.1. Request Formatting**

The transformation of LangChain inputs into the JSON payload for the /v1/agents/heroku API must be precise, especially for the tools array, which has a different structure and meaning than in the /v1/chat/completions API.

**Table: HerokuMiaAgent Request Mapping**

| LangChain Input/Option                                  | Heroku API Parameter                       | Transformation Logic                                                                                                                                                                                                                                                                                                    | Source(s)                             |
| :------------------------------------------------------ | :----------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| messages: BaseMessage                                   | messages (array)                           | Each BaseMessage (typically UserMessage, SystemMessage, or initial AssistantMessage) is converted to Heroku's message object format. ToolMessage instances from the client are generally not applicable here, as Heroku manages tool execution and feeds results back via its own tool role messages in the SSE stream. | 4 (messages array of objects section) |
| this.model / options.model                              | model (string)                             | Directly passed.                                                                                                                                                                                                                                                                                                        | 4 (Required Parameters)               |
| this.maxTokensPerRequest / options.maxTokensPerRequest  | max_tokens_per_inference_request (integer) | Directly passed.                                                                                                                                                                                                                                                                                                        | 4 (Optional Parameters)               |
| this.stop / options.stop                                | stop (array)                               | Directly passed.                                                                                                                                                                                                                                                                                                        | 4 (Optional Parameters)               |
| this.temperature / options.temperature                  | temperature (float)                        | Directly passed.                                                                                                                                                                                                                                                                                                        | 4 (Optional Parameters)               |
| this.tools / options.tools (if tools can be overridden) | tools (array)                              | HerokuAgentToolDefinition objects (see Section 3.5.1) are formatted according to Heroku's agent tool schema and passed.                                                                                                                                                                                                 | 4 (tools Array of Objects)            |
| this.topP / options.topP                                | top_p (float)                              | Directly passed.                                                                                                                                                                                                                                                                                                        | 4 (Optional Parameters)               |
| this.additionalKwargs / options.additionalKwargs        | (Varies)                                   | Merged into the request body.                                                                                                                                                                                                                                                                                           |                                       |

#### **3.4.2. Response Parsing and State Management for Multi-Step Flows**

As detailed in Section 3.3.2, parsing the SSE stream from /v1/agents/heroku is central to HerokuMiaAgent's functionality. State management for multi-step agentic flows (where the LLM might think, call a tool, get a result, think again, etc.) is largely handled by Heroku's agent service itself. The client library initiates the interaction by sending the initial user request and then faithfully represents the sequence of events streamed back by Heroku. The LangChain library does not need to manage an explicit agent loop for these server-side tools; rather, it consumes and interprets the events generated by Heroku's loop.

### **3.5. Tool Support (heroku_tool and mcp)** 5

HerokuMiaAgent will support the two types of server-side tools manageable by the Heroku Agents API: heroku_tool (first-party tools provided by Heroku) and mcp (custom tools deployed by users following the Model Context Protocol).

#### **3.5.1. Defining Tools (HerokuAgentToolDefinition interface)**

A TypeScript interface, HerokuAgentToolDefinition, will be created to allow users to define these tools when configuring HerokuMiaAgent.

```typescript
interface HerokuAgentToolDefinition {
  type: "heroku_tool" | "mcp";
  name: string; // e.g., for heroku_tool: "dyno_run_command" \[5\]
  // e.g., for mcp: "my_mcp_namespace/my_mcp_tool" (the 'namespaced_name' \[7\])
  description?: string; // Optional hint text for the model to understand when to use the tool \[4\]
  runtime_params: {
    target_app_name: string; // Name of the Heroku app where the tool runs or MCP server is deployed \[4, 5\]
    dyno_size?: string; // Dyno size for tool execution, e.g., "standard-1x" \[4\]
    ttl_seconds?: number; // Max seconds for dyno run (max 120\) \[4\]
    max_calls?: number; // Max times this tool can be called in the agent loop \[4\]
    tool_params?: Record<string, any>; // Parameters specific to the 'heroku_tool' itself
    // e.g., { cmd: "...", description: "...", parameters: {... } } for dyno_run_command \[5\]
    // e.g., { db_attachment: "..." } for postgres_get_schema \[5\]
    // For MCP tools, 'tool_params' are generally not specified here as they are part of the MCP server's definition.
    // However, 'runtime_params' like ttl_seconds, max_calls, dyno_size are applicable to MCP tools.\[4\]
  };
}
```

The tool_params field within runtime_params is particularly important for heroku_tool types and varies based on the specific tool being used.5 For mcp tools, the name should correspond to the namespaced_name (e.g., acute-partridge/code_exec_ruby) which can be discovered via Heroku's /v1/mcp/servers endpoint.7 The description and input schema for MCP tools are also typically part of the MCP server's definition and discoverable via /v1/mcp/servers.7 The library might offer a utility to fetch and format these MCP tool details, or users may need to provide them if they are already known.

**Table: Heroku Agent Tool Types and runtime_params**

| Tool Type   | Key runtime_params Fields                                                            | tool_params Source & Content                                                                                                                                              | Discovery/Definition Notes                                                                                                                                                    | Source(s) |
| :---------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------- |
| heroku_tool | target_app_name (usually required), dyno_size, ttl_seconds, max_calls                | Defined by the specific Heroku tool. Examples: cmd, description, parameters (JSON schema for command inputs) for dyno_run_command; db_attachment for postgres_get_schema. | Tool names and their required/optional tool_params are documented by Heroku.5 The user provides these values within the HerokuAgentToolDefinition.                            | 4         |
| mcp         | target_app_name (app where MCP server is running), dyno_size, ttl_seconds, max_calls | Generally not specified within tool_params here. The input_schema and other functional parameters are part of the MCP server's own definition.                            | The tool name (which should be the namespaced_name), description, and input_schema can be discovered via the /v1/mcp/servers endpoint.7 Users must provide at least the name. | 4         |

#### **3.5.2. Passing Tools in Requests**

The array of HerokuAgentToolDefinition objects, configured as described above, is passed in the tools field of the JSON request body sent to the /v1/agents/heroku endpoint.4

#### **3.5.3. Handling Agent-Initiated Tool Calls (tool_calls in assistant message)**

When Heroku's agent decides to use one of the configured tools, it will generate an assistant message (streamed as part of a chat.completion SSE event) that includes a tool_calls array.4 Each object in this array will contain an id for the tool call, type: "function" (Heroku uses this type internally even for heroku_tool and mcp calls in this context), and a function object specifying the name of the tool to be invoked and the arguments (as a JSON-formatted string). This information is parsed by HerokuMiaAgent and represented in the AIMessageChunk stream, typically within additional_kwargs.tool_calls or via tool_call_chunks if applicable.

#### **3.5.4. Formatting and Sending Tool Results (tool message with tool_call_id)**

This step is managed entirely by Heroku's agent service for heroku_tool and mcp tools. After the Heroku backend executes the requested tool, it sends a tool.completion SSE event. The message object within this event will have role: "tool", and its content field will contain the output from the tool execution. It will also include the tool_call_id corresponding to the agent's initial request.4 The HerokuMiaAgent library's responsibility is to parse this tool.completion event and accurately represent its content (the tool's output) in the AIMessageChunk stream, as discussed in Section 3.3.2.

### **3.6. Error Handling Specific to /v1/agents/heroku**

Error handling for HerokuMiaAgent will cover:

- HTTP errors encountered during the initial request to establish the SSE connection.
- Errors that may occur within the SSE stream itself, such as if Heroku sends an error event or if the stream terminates unexpectedly.
- If a tool.completion event from Heroku indicates an error during the server-side execution of a tool, this error information must be clearly surfaced to the user, likely through the AIMessageChunk stream (e.g., in additional_kwargs).

## **4\. Shared Library Functionality**

Several functionalities will be common to both HerokuMia and HerokuMiaAgent to ensure consistency and reduce code duplication. This suggests the potential for a base class or a shared utility module for API communication, handling aspects like authentication, retry logic, and base URL management.

### **4.1. Authentication** 2

A centralized authentication mechanism will be implemented:

- **API Key (INFERENCE_KEY):** The Heroku Inference API key will be accepted via a constructor parameter (e.g., apiKey). If this parameter is not provided, the library will attempt to read the key from the INFERENCE_KEY environment variable. An error will be thrown if the API key cannot be found.
- **API URL (INFERENCE_URL):** The base URL for the Heroku Inference API will be accepted via a constructor parameter (e.g., apiUrl). If not provided, it will fall back to the INFERENCE_URL environment variable. If neither is available, a default Heroku base URL (e.g., https://inference.heroku.com, if such a standard URL is published by Heroku) will be used. The specific endpoint paths (/v1/chat/completions or /v1/agents/heroku) will be appended by the respective classes (HerokuMia or HerokuMiaAgent).
- **Header Construction:** A utility function will be responsible for constructing the Authorization: Bearer \<INFERENCE_KEY\> header, which is required for all API requests to Heroku Inference services.

### **4.2. Common TypeScript Type Definitions**

The library will define and use a set of common TypeScript interfaces and types:

- Interfaces for Heroku API request and response structures, such as HerokuChatMessage, HerokuToolCall, and HerokuCompletionChoice, based on the details provided in the Heroku API documentation.3 These will be used if existing LangChain types do not fully cover Heroku's specific schemas.
- The HerokuAgentToolDefinition interface, as detailed in Section 3.5.1.
- Interfaces for any structured error responses that the Heroku API might return. These types will be used internally for request formatting and response parsing, and some may be exported for advanced users who need to interact with the library at a lower level.

### **4.3. Utility Functions**

Several utility functions will be developed to support the core classes:

- **SSE Parser:** A minimal yet robust parser for Server-Sent Events will be implemented if a suitable lightweight external library is not chosen, or if Node.js built-in capabilities are insufficient for handling potentially complex SSE streams. This parser must correctly handle event:, data:, and multi-line data: fields.
- **Message Transformation:** Utilities to convert between LangChain's BaseMessage types (e.g., HumanMessage, AIMessage) and the message object format expected by Heroku's APIs (as outlined in the request mapping tables in Sections 2.4.1 and 3.4.1).
- **Tool Format Conversion (for HerokuMia):** Logic to convert LangChain StructuredTool instances into the JSON schema format required by Heroku's function type tools for the /v1/chat/completions endpoint. This may involve adapting the convertToOpenAIFunction utility from @langchain/core.13

## **5\. LangChain Ecosystem Integration**

A primary goal of @langchain/heroku is to ensure seamless integration with the broader LangChain ecosystem, particularly LangChain Expression Language (LCEL) and LangGraph.

### **5.1. LangChain Expression Language (LCEL) Compatibility** 10

Both HerokuMia and HerokuMiaAgent (assuming it extends BaseChatModel or is otherwise a valid Runnable) must function as standard Runnable instances. This requires correct implementation of the invoke, stream, and batch methods, as well as proper handling and propagation of RunnableConfig.10

This compatibility will enable standard LCEL operations:

- Piping with pipe(): e.g., const chain \= prompt.pipe(herokuMiaLlm);
- Binding parameters with bind(): e.g., herokuMiaLlm.bind({ stop: \["\\nObservation:"\] });
- Applying runtime configuration with withConfig(): e.g., herokuMiaLlm.withConfig({ tags: \["my_heroku_llm_call"\] });
- For HerokuMia, binding tools with bindTools(): e.g., herokuMiaLlm.bindTools();.8

For HerokuMiaAgent, its composability within LCEL requires careful consideration. If its stream method yields a complex sequence of events (representing LLM text, agent-initiated tool calls, and Heroku-executed tool results), standard LCEL chains that expect a single AIMessage (or a stream of its chunks) as output from an LLM component might need adaptation. If HerokuMiaAgent's output is mapped effectively to AIMessageChunks (e.g., using additional_kwargs to carry diverse event data), then standard LCEL composition should be feasible. However, users might need to employ custom RunnableLambda components to parse and process the richer information within these chunks if they need to react differently to text responses versus tool execution results.

### **5.2. LangGraph Compatibility**

The components of @langchain/heroku should integrate effectively with LangGraph for building stateful, multi-step agentic applications.

- **HerokuMia:** This class should integrate into LangGraph agents in a manner similar to ChatOpenAI. It would typically be used as the LLM node in a graph, particularly for scenarios involving function calling where the graph itself manages the tool execution loop (LLM requests tool \-\> graph executes tool \-\> graph sends result to LLM).
- **HerokuMiaAgent:** This class presents an interesting opportunity for LangGraph integration. Since Heroku's /v1/agents/heroku service manages the agent loop and server-side tool execution for heroku_tool and mcp tools, a LangGraph graph utilizing HerokuMiaAgent might be significantly simpler.
  - The traditional "tool execution" node within a LangGraph agent might not be necessary if all tools are handled by Heroku. Instead, the graph would primarily orchestrate calls to HerokuMiaAgent and react to the comprehensive stream of events it produces (LLM responses, tool calls, and tool results).
  - State management within LangGraph will need to be designed to align with how HerokuMiaAgent surfaces the sequence of LLM responses and tool results. The graph's state would be updated based on the full sequence of events received from HerokuMiaAgent.stream(). This differs from graphs where a LangGraph node explicitly calls a client-side tool function. HerokuMiaAgent could simplify certain LangGraph setups by offloading tool execution, but this also implies less direct control over the tool execution environment from within the LangGraph itself.

## **6\. Development and Implementation Notes**

### **6.1. Reference Implementation: @langchain/openai** 8

The @langchain/openai library, particularly its ChatOpenAI class, will serve as a key reference for implementing HerokuMia. Aspects to draw from include:

- **Class Structure:** Adopting the general organization of fields, constructor, CallOptions interface, and core internal methods like \_generate and \_llmType.
- **Method Signatures:** Ensuring adherence to the method signatures defined by BaseChatModel and the Runnable interface.
- **Options Handling:** Mimicking the pattern of how options are passed during construction versus at call-time for specific invocations.
- **Tool Integration:** Adapting the patterns used for bindTools and the conversion of LangChain tool definitions to the API-specific format required by Heroku's function tools (for HerokuMia).
- **Streaming Logic:** The mechanisms for SSE parsing and the transformation of incoming chunks into AIMessageChunk objects in ChatOpenAI will be a valuable guide, especially for HerokuMia's streaming and potentially for adapting to HerokuMiaAgent's more complex SSE stream.

### **6.2. Error Handling Strategy**

A comprehensive error handling strategy is essential:

- Implement thorough handling for API request errors, including network failures, HTTP status codes (4xx, 5xx), and any specific error messages or codes returned by the Heroku API.
- Define custom error classes (e.g., HerokuApiError extending a base LangChain error class) if the standard LangChain errors are insufficient to convey Heroku-specific error details.
- Incorporate retry mechanisms (e.g., exponential backoff) for transient issues, configurable via the maxRetries parameter in the constructor.
- Ensure that errors occurring during the processing of SSE streams are caught, handled gracefully, and propagated correctly to the caller.

### **6.3. Logging and Debugging Support**

To aid development and user debugging:

- Utilize LangChain's built-in callback system (e.g., CallbackManagerForLLMRun, handleLLMNewToken, handleLLMError) for logging significant events during the lifecycle of an API call.
- Allow users to pass verbose flags or custom CallbackManager instances to the constructor or call options to control logging behavior.
- Consider providing options for logging raw API request and response data when a debug mode is enabled, which can be invaluable for troubleshooting.

### **6.4. Testing Guidelines**

A robust testing suite will be crucial for ensuring the library's correctness and reliability:

- **Unit Tests:**
  - Test utility functions for message formatting (LangChain BaseMessage instances to Heroku's JSON message format).
  - Test the conversion logic for tool definitions (e.g., LangChain StructuredTool to Heroku's function tool JSON schema for HerokuMia).
  - Test the SSE parsing logic with a variety of valid inputs, edge cases, and malformed data streams.
  - Test response parsing logic (Heroku API JSON responses to LangChain ChatResult or AIMessageChunk objects).
- **Integration Tests:**
  - Mock the Heroku API endpoints (/v1/chat/completions and /v1/agents/heroku).
  - Test the invoke, stream, and batch methods of both HerokuMia and HerokuMiaAgent against the mocked API.
  - Verify the correct handling of function calling flows for HerokuMia (client-side tool execution loop).
  - Verify the correct handling of heroku_tool and mcp tool interactions for HerokuMiaAgent, including the accurate representation of tool_calls initiated by the Heroku agent and tool.completion events (tool results) from Heroku.
  - Test authentication mechanisms and various error handling paths (e.g., API errors, network errors, invalid input).

## **7\. Appendix (Optional)**

### **7.1. Full Heroku API Request/Response Examples**

For ease of reference during implementation, this section would ideally include verbatim JSON examples of requests and responses for:

- Heroku /v1/chat/completions API:
  - Standard (non-streaming) request and response.
  - Request with stream: true and examples of SSE message chunks.
  - Request and response involving function type tools (tool definition, tool_calls in response, subsequent request with tool message).
  - (Examples can be found in or derived from 3)
- Heroku /v1/agents/heroku API:
  - Initial request including heroku_tool or mcp tool definitions.
  - Example sequence of SSE events, showing interleaved chat.completion (with assistant text or tool_calls) and tool.completion (with tool results) messages, culminating in an event: done.
  - (Examples can be found in or derived from 4)

### **7.2. Glossary of Terms**

- **MIA:** Managed Inference and Agents (Heroku's AI service platform).
- **MCP:** Model Context Protocol. A specification for creating and interacting with tools (often LLM-callable) in a standardized way.1
- **SSE:** Server-Sent Events. A web technology for enabling a server to push data to a client in real-time over a single HTTP connection.
- **LCEL:** LangChain Expression Language. A declarative way to compose LangChain components into chains and graphs.
- **heroku_tool:** A first-party tool provided and executed by Heroku's Managed Agents service.5
- **function tool (Heroku context):** A tool type used with the /v1/chat/completions API where the LLM describes a function for the client to execute.3
- **INFERENCE_KEY:** The API key for authenticating with Heroku's Managed Inference and Agents services.
- **INFERENCE_URL:** The base URL for Heroku's Managed Inference and Agents API endpoints.

#### **Works cited**

1. Heroku Managed Inference and Agents add-on is now available, accessed May 23, 2025, [https://devcenter.heroku.com/changelog-items/3235](https://devcenter.heroku.com/changelog-items/3235)
2. Heroku Inference | Heroku Dev Center, accessed May 23, 2025, [https://devcenter.heroku.com/categories/heroku-inference](https://devcenter.heroku.com/categories/heroku-inference)
3. Managed Inference and Agents API /v1/chat/completions | Heroku ..., accessed May 23, 2025, [https://devcenter.heroku.com/articles/heroku-inference-api-v1-chat-completions](https://devcenter.heroku.com/articles/heroku-inference-api-v1-chat-completions)
4. Managed Inference and Agents API /v1/agents/heroku | Heroku Dev ..., accessed May 23, 2025, [https://devcenter.heroku.com/articles/heroku-inference-api-v1-agents-heroku](https://devcenter.heroku.com/articles/heroku-inference-api-v1-agents-heroku)
5. Using Heroku Tools with the Managed Inference and Agents Add-on, accessed May 23, 2025, [https://devcenter.heroku.com/articles/heroku-inference-tools](https://devcenter.heroku.com/articles/heroku-inference-tools)
6. Managed Inference and Agents API /v1/agents/heroku, accessed May 23, 2025, [https://devcenter.heroku.com/articles/heroku-inference-api-v1-agents](https://devcenter.heroku.com/articles/heroku-inference-api-v1-agents)
7. Managed Inference and Agents API /v1/mcp/servers \- Heroku Dev Center, accessed May 23, 2025, [https://devcenter.heroku.com/articles/heroku-inference-api-v1-mcp-servers](https://devcenter.heroku.com/articles/heroku-inference-api-v1-mcp-servers)
8. ChatOpenAI | LangChain.js, accessed May 23, 2025, [https://api.js.langchain.com/classes/langchain_openai.ChatOpenAI.html](https://api.js.langchain.com/classes/langchain_openai.ChatOpenAI.html)
9. BaseChatModel | LangChain.js, accessed May 23, 2025, [https://api.js.langchain.com/classes/langchain_core.language_models_chat_models.BaseChatModel.html](https://api.js.langchain.com/classes/langchain_core.language_models_chat_models.BaseChatModel.html)
10. Runnable interface | 🦜️ LangChain, accessed May 23, 2025, [https://js.langchain.com/docs/concepts/runnables/](https://js.langchain.com/docs/concepts/runnables/)
11. How to use chat models to call tools \- LangChain.js, accessed May 23, 2025, [https://js.langchain.com/docs/how_to/tool_calling](https://js.langchain.com/docs/how_to/tool_calling)
12. LangChain: Structured Output with JavaScript \- Robin Wieruch, accessed May 23, 2025, [https://www.robinwieruch.de/langchain-javascript-structured/](https://www.robinwieruch.de/langchain-javascript-structured/)
13. Function convertToOpenAIFunction \- LangChain.js, accessed May 23, 2025, [https://v03.api.js.langchain.com/functions/\_langchain_core.utils_function_calling.convertToOpenAIFunction.html](https://v03.api.js.langchain.com/functions/_langchain_core.utils_function_calling.convertToOpenAIFunction.html)
