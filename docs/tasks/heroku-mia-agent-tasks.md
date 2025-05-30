# HerokuMiaAgent (Agents) Implementation

Brief description of the feature and its purpose.

Integration with Heroku's Managed Agents API (/v1/agents/heroku) for agentic interactions with server-side tool execution.

## Completed Tasks

- [x] Define `HerokuMiaAgentFields` and `HerokuMiaAgentCallOptions` interfaces (in `src/types.ts`).
- [x] Define `HerokuAgentToolDefinition` interface (in `src/types.ts`).
- [x] Define Heroku Agent API request/response/stream payload types (in `src/types.ts`).
- [x] Implement `HerokuMiaAgent` class structure extending `BaseChatModel` (in `src/heroku-mia-agent.ts`).
- [x] Implement `HerokuMiaAgent` constructor and initialize properties.
- [x] Implement `_llmType()` method.
- [x] Implement `invocationParams()` method (basic structure).
- [x] Implement `_generate()` method (core logic: API call to `/invoke`, response parsing, error handling).
- [x] Implement request formatting for Heroku Agent API (`/invoke` path - messages, metadata, session_id).
- [x] Implement `_stream()` method (core logic: API call to `/stream`, SSE parsing for various agent events, mapping to `AIMessageChunk`, error handling).
- [x] Implement request formatting for Heroku Agent API (`/stream` path).
- [x] Implement SSE response parsing for `message.delta`, `tool.call`, `tool.completion`, `tool.error`, `agent.error`, `stream.end` events within `_stream()`.
- [x] Map agent SSE events to LangChain `AIMessageChunk` (using `additional_kwargs` for non-standard data like tool results/errors).
- [x] Handle server-side tool execution results (`tool.completion`, `tool.error`) by yielding AIMessageChunks with event data in `additional_kwargs`.

## In Progress Tasks

- [ ] Refine how `tool.completion` and `tool.error` AIMessageChunks are consumed/interpreted by a LangChain AgentExecutor (this is more of an integration/usage concern than a direct implementation issue for `HerokuMiaAgent` itself, but worth noting).

## Future Tasks

- [ ] Unit tests for `HerokuMiaAgent`.
- [ ] Integration tests for `HerokuMiaAgent` (mocking Heroku Agent API).

## Implementation Plan

Follow `SPECS.md` section 3. The class will extend `BaseChatModel`. Key methods are `_generate` (for `/invoke`) and `_stream` (for `/stream`). The main challenge is handling the complex SSE stream from `/v1/agents/heroku/stream` which includes various event types like `message.delta`, `tool.call`, `tool.completion`, `tool.error`, and `stream.end`. These need to be parsed and mapped to appropriate LangChain message chunks or agent actions/observations.

## Relevant files

- `src/heroku-mia-agent.ts` - Main implementation of the `HerokuMiaAgent` class.
- `src/types.ts` - Shared type definitions, including those for Heroku Agent API.
- `SPECS.md` - Technical specification document.

## Task: Fix HerokuMiaAgent Tool Call Traceability

### Status: ✅ COMPLETED

### Problem

HerokuMiaAgent implementation was broken due to incorrect event handling. The agent wasn't processing responses correctly and tool calls weren't being traced properly.

### Root Cause Analysis

1. **Wrong Event Structure**: The implementation expected custom agent events but Heroku actually returns standard chat completion events with `event: 'message'`
2. **Incorrect Event Parsing**: Looking for `eventDataJSON.event` instead of `parsedEvent.event`
3. **Missing Content Handling**: Not properly extracting content from chat completion messages
4. **Tool Call Structure Mismatch**: Expected direct tool events but tool calls come embedded in chat completion messages

### Solution Implemented

#### 1. Fixed Event Handling

- **Correct Event Processing**: Now handles `event: 'message'` with `chat.completion` objects
- **Proper Content Extraction**: Extracts content from `message.content` in chat completion responses
- **Tool Call Detection**: Identifies tool calls from `message.tool_calls` array in chat completion
- **Error Handling**: Processes `event: 'error'` for tool execution failures

#### 2. Enhanced Traceability for Server-Side Tools

- **Tool Start Notifications**: When agent initiates tool calls, we trace via `handleLLMNewToken()`
- **Content Streaming**: All content is properly streamed through the callback manager
- **Error Propagation**: Tool and agent errors are traced through `handleLLMError()`
- **Real-time Updates**: Users see tool calls and responses as they happen

#### 3. Proper Response Structure

- **Content Handling**: Agent text responses are properly captured and streamed
- **Tool Call Extraction**: Tool calls are properly extracted with id, name, and arguments
- **Error Integration**: Tool errors are included in the response for debugging
- **Finish Reasons**: Proper finish_reason handling for different completion types

### Key Features

✅ **Server-Side Tool Execution**: Properly handles tools executed by Heroku  
✅ **Real-Time Traceability**: Tool calls and content are traced as they stream  
✅ **Content Streaming**: Agent responses stream naturally through LangSmith  
✅ **Error Handling**: Tool and agent errors are properly captured and traced  
✅ **LangSmith Integration**: Full callback manager integration for monitoring  
✅ **Tool Call Structure**: Proper tool_calls array in final AIMessage

### Implementation Details

#### Event Flow (Corrected)

1. **Agent Response**: `event: 'message'` with chat completion containing content and/or tool_calls
2. **Tool Execution**: Heroku executes tools server-side and embeds results in subsequent content
3. **Tool Results**: Results appear in the agent's natural language response, not separate events
4. **Error Handling**: `event: 'error'` for tool execution failures
5. **Stream End**: `event: 'done'` signals completion

#### Server-Side Tool Execution Flow

1. Agent decides to call a tool → `tool_calls` in chat completion message
2. Heroku executes the tool server-side (not visible to client)
3. Agent continues with results embedded in content → new chat completion message with results

#### Callback Manager Integration

- `handleLLMNewToken()`: Called for all content and tool start notifications
- `handleLLMError()`: Called for tool and agent errors
- Provides real-time visibility into agent reasoning and embedded tool results

### Example Usage (Working)

```typescript
const agentExecutor = new HerokuMiaAgent({
  tools: [
    {
      type: "heroku_tool",
      name: "dyno_run_command",
      runtime_params: {
        target_app_name: "my-app",
        tool_params: {
          cmd: "date",
          description: "Gets the current date and time",
          parameters: { type: "object", properties: {} },
        },
      },
    },
  ],
});

// Streaming shows content with embedded tool results
for await (const chunk of agentExecutor.stream([message])) {
  if (chunk.content) {
    console.log("Content:", chunk.content); // Includes tool results naturally
  }
  if (chunk.additional_kwargs?.heroku_agent_event === "tool.call") {
    console.log("Tool called:", chunk.additional_kwargs.name);
  }
}

// Final response includes tool_calls but results are in content
const response = await agentExecutor.invoke([message]);
console.log("Tool calls made:", response.tool_calls);
console.log("Content with results:", response.content); // Tool results here
```

### Testing Verification

✅ Agent streams content properly  
✅ Tool calls are captured with correct structure  
✅ invoke() returns complete responses with tool_calls array  
✅ Error handling works correctly  
✅ Traceability works through LangSmith callback system  
✅ Example runs successfully and demonstrates all features

### Performance

- Streams responses in real-time
- Proper error handling for missing apps
- Clean event processing without unnecessary complexity
- Full compatibility with LangChain patterns
