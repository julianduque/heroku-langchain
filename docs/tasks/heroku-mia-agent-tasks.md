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
- [x] Implement `invocationParams()` method.
- [x] Implement `_generate()` method with proper tool call aggregation.
- [x] Implement `_stream()` method with SSE parsing for Heroku Agent events.
- [x] Fix event parsing to handle actual Heroku API response structure.
- [x] Implement proper tool call tracing for LangSmith integration.
- [x] Clean up implementation to match actual API behavior (removed unused tool_call_chunks).
- [x] Verify tool execution results are properly captured in traces.
- [x] Update examples to demonstrate proper usage.

## In Progress Tasks

- [ ] Refine how `tool.completion` and `tool.error` AIMessageChunks are consumed/interpreted by a LangChain AgentExecutor (this is more of an integration/usage concern than a direct implementation issue for `HerokuMiaAgent` itself, but worth noting).

## Future Tasks

- [x] Unit tests for `HerokuMiaAgent`.
- [x] Integration tests for `HerokuMiaAgent` (mocking Heroku Agent API).

## Implementation Plan

The class extends `BaseChatModel` and implements both `_generate` and `_stream` methods. The key insight is that Heroku Agents API returns complete responses with both content and tool information in a single chunk, rather than streaming separate tool call chunks.

## Relevant files

- `src/heroku-mia-agent.ts` - Main implementation of the `HerokuMiaAgent` class.
- `src/types.ts` - Shared type definitions for Heroku Agent API.
- `examples/heroku-mia-agent-example.ts` - Working example with tracing support.

## Latest Fix: Proper Tracing Support (✅ COMPLETED)

### Problem Solved

1. **"Unknown Heroku Agent event object type: undefined" errors** - Fixed by properly handling events without object types
2. **"Error: No LLM run to end" errors** - Fixed by removing duplicate LLM end calls
3. **Missing tool details in traces** - Fixed by properly synthesizing tool calls for LangChain tracing

### Key Insights from API Analysis

**Actual Heroku Agents API Response Structure:**

```json
{
  "content": "Agent response with tool results embedded",
  "additional_kwargs": {
    "finish_reason": "stop",
    "usage": {
      "prompt_tokens": 495,
      "completion_tokens": 31,
      "total_tokens": 526
    },
    "tool_call_id": "tooluse_...",
    "tool_name": "dyno_run_command",
    "tool_result": "Tool 'dyno_run_command' returned result: ..."
  },
  "response_metadata": {
    "finish_reason": "stop",
    "tool_calls": [
      {
        "id": "tooluse_...",
        "name": "dyno_run_command",
        "args": {},
        "type": "tool_call"
      }
    ],
    "tool_results": {
      "tool_call_id": "tooluse_...",
      "tool_name": "dyno_run_command",
      "result": "Tool 'dyno_run_command' returned result: ..."
    }
  }
}
```

### Implementation Changes

#### 1. Cleaned Up Event Handling

- **Removed unused logic**: No `tool_call_chunks` - Heroku doesn't send these
- **Simplified event processing**: Handle only actual event types from Heroku API
- **Fixed undefined events**: Skip events without proper object types

#### 2. Proper Tool Call Synthesis

- **Use `response_metadata.tool_calls`**: Where Heroku puts structured tool call data
- **Include tool results**: Both in `additional_kwargs` and `response_metadata`
- **LangSmith integration**: Tool calls appear properly in traces

#### 3. Enhanced Callback Manager Integration

- **Tool call notifications**: Notify tracing when tools are executed
- **Tool result notifications**: Trace tool execution results
- **Removed duplicate end calls**: Prevent LangSmith errors

#### 4. Streamlined `_generate` Method

- **Use response_metadata**: Extract tool calls from where Heroku actually puts them
- **Aggregate properly**: Collect tool information from structured metadata
- **Include in generation info**: Ensure tools appear in LangChain traces

### Current Working State

✅ **Functional**: Agent executes and returns responses correctly  
✅ **Tool Results**: Tool execution results are captured and displayed  
✅ **LangSmith Tracing**: Tool calls and results appear properly in traces  
✅ **Clean Implementation**: Matches actual Heroku API behavior  
✅ **Error-free**: No more undefined event type or duplicate LLM end errors

### Usage

To enable LangSmith tracing:

```bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=your_langsmith_api_key
export LANGCHAIN_PROJECT=your_project_name
```

The implementation now correctly:

- Handles the single-chunk response pattern from Heroku Agents API
- Synthesizes proper tool call structures for LangChain compatibility
- Provides complete tracing information to LangSmith
- Shows clear tool execution lifecycle in console output

### Example Output

```
🔧 Agent executed tool: dyno_run_command (tooluse_IrOXtRsfSeqETblyFx1cLg)
🛠️ Tool 'dyno_run_command' (tooluse_IrOXtRsfSeqETblyFx1cLg) completed with result: Tool 'dyno_run_command' returned result: Fri May 30 17:17:17 UTC 2025
✅ Stream ended. Tool calls executed: 1
```

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
