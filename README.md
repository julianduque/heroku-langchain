# Heroku AI LangChain SDK

This SDK provides a convenient way to interact with Heroku's AI services, specifically for chat completions, agent functionalities, and text embeddings.

## Installation

> **Node.js 20+ is required.**

```bash
pnpm install heroku-langchain
```

## Core Classes

This SDK includes three main classes:

- **`ChatHeroku`**: Chat completions with support for function calling, structured outputs, and streaming
- **`HerokuAgent`**: Autonomous agents with access to Heroku tools and MCP (Model Context Protocol) tools
- **`HerokuEmbeddings`**: Text embeddings for similarity search, RAG applications, and semantic understanding

## Basic Usage

### Chat Completions

Here's a simple example of how to use the `ChatHeroku` class for chat completions:

```typescript
import { ChatHeroku } from "heroku-langchain";
import { HumanMessage } from "@langchain/core/messages";

async function main() {
  // Ensure INFERENCE_MODEL_ID and INFERENCE_KEY are set in your environment
  // or pass them directly to the constructor:
  // const chat = new ChatHeroku({ model: "your-model-id", apiKey: "your-api-key" });
  const chat = new ChatHeroku({ model: "gpt-oss-120b" });

  const messages = [new HumanMessage("Hello, how are you doing today?")];

  try {
    const response = await chat.invoke(messages);
    console.log("AI Response:", response.content);

    // Example of streaming
    // const stream = await chat.stream(messages);
    // for await (const chunk of stream) {
    //   console.log(chunk.content);
    // }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

### Text Embeddings

Here's how to use the `HerokuEmbeddings` class for generating text embeddings:

```typescript
import { HerokuEmbeddings } from "heroku-langchain";

async function main() {
  const embeddings = new HerokuEmbeddings({
    model: "cohere-embed-multilingual",
    // Optional: set API credentials explicitly
    // apiKey: process.env.EMBEDDING_KEY,
    // apiUrl: process.env.EMBEDDING_URL
  });

  try {
    // Generate embedding for a single query
    const queryEmbedding = await embeddings.embedQuery("What is Heroku?", {
      input_type: "search_query",
    });
    console.log(`Query embedding dimensions: ${queryEmbedding.length}`);

    // Generate embeddings for multiple documents
    const documents = [
      "Heroku is a cloud platform as a service (PaaS)",
      "It supports multiple programming languages",
      "Heroku makes it easy to deploy and scale applications",
    ];

    const docEmbeddings = await embeddings.embedDocuments(documents, {
      input_type: "search_document",
    });
    console.log(`Generated ${docEmbeddings.length} document embeddings`);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

## Environment Variables

The SDK can utilize the following environment variables:

### Chat Completions & Agents

- `INFERENCE_MODEL_ID`: The ID of the inference model to use. This is required if not provided in the constructor.
- `INFERENCE_KEY`: Your Heroku Managed Inference and Agents API key. This is required if not provided in the constructor.
- `INFERENCE_URL`: The base URL for the Heroku Managed Inference and Agents API.

### Text Embeddings

- `EMBEDDING_MODEL_ID`: The ID of the embedding model to use (e.g., "cohere-embed-multilingual").
- `EMBEDDING_KEY`: Your Heroku Embedding API key.
- `EMBEDDING_URL`: The base URL for the Heroku Embedding API.

## Advanced Usage

### Using Tools

You can build an agent with LangChain's `createAgent` helper and attach tools declared with the `tool` helper for richer interactions.

```typescript
import { ChatHeroku } from "heroku-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { createAgent, tool } from "langchain";
import { z } from "zod";

const getWeather = tool(
  async ({ location }) => {
    // In a real scenario, you would call a weather API here
    if (location.toLowerCase().includes("san francisco")) {
      return JSON.stringify({ weather: "sunny", temperature: "70F" });
    }
    return JSON.stringify({ weather: "unknown", temperature: "unknown" });
  },
  {
    name: "get_weather",
    description: "Gets the current weather for a given location.",
    schema: z.object({
      location: z
        .string()
        .describe("The city and state, e.g., San Francisco, CA"),
    }),
  },
);

async function main() {
  const model = new ChatHeroku({ model: "your-model-id" });
  const agent = createAgent({
    model,
    tools: [getWeather],
    systemPrompt:
      "You are a weather assistant. Call the get_weather tool when needed.",
  });

  const response = await agent.invoke({
    messages: [new HumanMessage("What's the weather like in San Francisco?")],
  });

  console.log("AI Response:", response.messages.at(-1)?.content);
}

main();
```

### Using Agents

The `HerokuAgent` class allows for more autonomous interactions with access to Heroku tools and MCP (Model Context Protocol) tools. Here's an example demonstrating agent usage:

```typescript
import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgent } from "heroku-langchain";
import { HerokuTool } from "heroku-langchain/types";

async function agentExample() {
  console.log("Running Heroku createAgent Example...");

  const appName = process.env.HEROKU_APP_NAME || "mia-inference-demo";
  const tools: HerokuTool[] = [
    {
      type: "heroku_tool",
      name: "dyno_run_command",
      runtime_params: {
        target_app_name: appName,
        tool_params: {
          cmd: "date",
          description: "Gets the current date and time on the server.",
          parameters: { type: "object", properties: {} },
        },
      },
    },
  ];

  console.log(`📱 Using app: ${appName}`);
  console.log("💡 Note: Make sure this app exists and you have access to it!");
  console.log(
    "   Set HEROKU_APP_NAME environment variable to use a different app.",
  );

  const model = new HerokuAgent();
  const agent = createAgent({
    model,
    tools,
    systemPrompt:
      "You are a Heroku operator. Prefer dyno_run_command to inspect the target app.",
  });

  const response = await agent.invoke({
    messages: [
      new HumanMessage(
        "What time is it on the app server? Please use the available tools to check.",
      ),
    ],
  });

  const finalMessage = response.messages.at(-1);
  console.log(finalMessage?.content);
}

agentExample().catch(console.error);
```

#### Using MCP Tools

You can also use MCP (Model Context Protocol) tools with the agent:

```typescript
import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgent } from "heroku-langchain";
import { HerokuTool } from "heroku-langchain/types";

async function mcpExample() {
  const tools: HerokuTool[] = [
    {
      type: "mcp",
      name: "mcp-brave/brave_web_search", // MCP tool name registered on Heroku MCP Toolkit
    },
  ];

  const model = new HerokuAgent();
  const agent = createAgent({
    model,
    tools,
    systemPrompt: "Answer with help from brave_web_search when needed.",
  });

  const response = await agent.invoke({
    messages: [new HumanMessage("What is new in the world of AI?")],
  });

  console.log(response.messages.at(-1)?.content);
}
```

## Examples

Complete working examples are available in the `examples/` folder, organized by functionality:

### Chat Completions (`ChatHeroku`)

- `examples/chat-basic.ts` — Basic chat completion
- `examples/chat-structured-output.ts` — Structured output with Zod schemas
- `examples/chat-structured-output-advanced.ts` — Structured output with complex Zod schemas
- `examples/chat-lcel-prompt.ts` — LCEL with prompt templates
- `examples/chat-runnable-sequence.ts` — Chaining with RunnableSequence
- `examples/create-agent-wikipedia-tool.ts` — Tool integration with Wikipedia search
- `examples/create-agent-custom-tool.ts` — Custom weather tool with function calling
- `examples/create-agent-updates-stream.ts` — Streaming tool execution with createAgent and updates stream mode

### Agents (`HerokuAgent`)

- `examples/create-heroku-agent-basic.ts` — Minimal createAgent wiring for Heroku tools
- `examples/create-heroku-agent-streaming.ts` — Streaming tool execution with createAgent
- `examples/create-heroku-agent-mcp.ts` — Using MCP tools with createAgent
- `examples/create-heroku-agent-structured-output.ts` — Structured output with createAgent

### Text Embeddings (`HerokuEmbeddings`)

- `examples/embeddings-basic.ts` — Basic embeddings usage for queries and documents

### Advanced Integrations

- `examples/langraph.ts` — Multi-agent workflow with LangGraph
- `examples/langraph-mcp.ts` — LangGraph with MCP tools for database interactions
- `examples/langgraph-human-in-the-loop.ts` — LangGraph with human in the loop interruption
- `examples/create-heroku-agent-langgraph.ts` — Agent workflow with LangGraph and Heroku tools

### Running Examples

To run the examples:

```bash
# Set required environment variables for chat/agents
export INFERENCE_MODEL_ID="gpt-oss-120b"
export INFERENCE_KEY="your-heroku-api-key"
export HEROKU_APP_NAME="your-app-name"  # Optional, defaults to "mia-inference-demo"

# Set required environment variables for embeddings
export EMBEDDING_MODEL_ID="cohere-embed-multilingual"
export EMBEDDING_KEY="your-embedding-api-key"
export EMBEDDING_URL="your-embedding-api-url"

# Run a chat example
npx tsx examples/chat-basic.ts

# Run a structured output example
npx tsx examples/chat-structured-output.ts

# Run an agent example
npx tsx examples/create-heroku-agent-basic.ts

# Run the embeddings example
npx tsx examples/embeddings-basic.ts
```

## API Documentation

For more detailed information on the available classes, methods, and types, please refer to the source code and TypeDoc generated documentation (if available).

- `ChatHeroku`: For chat completions with function calling and structured output support.
- `HerokuAgent`: For agent-based interactions with Heroku and MCP tools.
- `HerokuEmbeddings`: For generating text embeddings and semantic search.
- `types.ts`: Contains all relevant TypeScript type definitions.

## Testing

This project uses Node.js's native test runner with TypeScript support. The test suite covers:

- Common utilities (configuration, message transformation, tool conversion)
- Type definitions and interfaces
- ChatHeroku class functionality
- HerokuAgent class functionality
- HerokuEmbeddings class functionality
- Integration tests

### Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch
```

### Test Structure

The test files are organized as follows:

- `test/common.test.ts` - Tests for utility functions and error handling
- `test/types.test.ts` - Type definition validation tests
- `test/chat-heroku.test.ts` - ChatHeroku class tests
- `test/heroku-agent.test.ts` - HerokuAgent class tests
- `test/embeddings.test.ts` - HerokuEmbeddings class tests
- `test/integration/**` - End-to-end integration tests

All tests but the integration tests use environment variable mocking to avoid requiring actual API keys during testing.

## License

Apache 2.0
