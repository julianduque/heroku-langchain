# Heroku Mia LangChain SDK

This SDK provides a convenient way to interact with Heroku's AI services, specifically for chat completions, agent functionalities, and text embeddings.

## Installation

```bash
pnpm install heroku-langchain
```

## Core Classes

This SDK includes three main classes:

- **`ChatHeroku`**: Chat completions with support for function calling, structured outputs, and streaming
- **`HerokuAgent`**: Autonomous agents with access to Heroku tools and MCP (Model Context Protocol) tools
- **`HerokuMiaEmbeddings`**: Text embeddings for similarity search, RAG applications, and semantic understanding

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

Here's how to use the `HerokuMiaEmbeddings` class for generating text embeddings:

```typescript
import { HerokuMiaEmbeddings } from "heroku-langchain";

async function main() {
  const embeddings = new HerokuMiaEmbeddings({
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

You can bind tools (functions) to the model for more complex interactions.

```typescript
import { ChatHeroku } from "heroku-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";

// Define a simple tool
class GetWeatherTool extends StructuredTool {
  name = "get_weather";
  description = "Gets the current weather for a given location.";
  schema = z.object({
    location: z
      .string()
      .describe("The city and state, e.g., San Francisco, CA"),
  });

  async _call(input: z.infer<typeof this.schema>) {
    // In a real scenario, you would call a weather API here
    if (input.location.toLowerCase().includes("san francisco")) {
      return JSON.stringify({ weather: "sunny", temperature: "70F" });
    }
    return JSON.stringify({ weather: "unknown", temperature: "unknown" });
  }
}

async function main() {
  const chat = new ChatHeroku({ model: "your-model-id" }).bindTools([
    new GetWeatherTool(),
  ]);

  const messages = [
    new HumanMessage("What's the weather like in San Francisco?"),
  ];

  try {
    const response = await chat.invoke(messages);
    console.log("AI Response:", response);

    // The response might include a tool_calls array if the model decided to use a tool
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log("Tool calls:", response.tool_calls);
      // Here you would typically execute the tool and send the result back to the model
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

### Using Agents

The `HerokuAgent` class allows for more autonomous interactions with access to Heroku tools and MCP (Model Context Protocol) tools. Here's an example demonstrating agent usage:

```typescript
import { HerokuAgent } from "heroku-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "heroku-langchain/types";

async function agentExample() {
  console.log("Running HerokuAgent Example...");

  const appName = process.env.HEROKU_APP_NAME || "mia-inference-demo";
  const tools: HerokuAgentToolDefinition[] = [
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

  const agentExecutor = new HerokuAgent({
    tools: tools,
  });

  try {
    console.log("\n=== Heroku Tool Execution ===");
    console.log("\nStreaming HerokuAgent...");

    const stream = await agentExecutor.stream([
      new HumanMessage(
        "What time is it on the app server? Please use the available tools to check.",
      ),
    ]);

    const toolCalls: any[] = [];

    for await (const chunk of stream) {
      if (chunk.content) {
        process.stdout.write(chunk.content as string);
      }

      // Show tool calls if present in response_metadata
      if (chunk.response_metadata?.tool_calls) {
        for (const toolCall of chunk.response_metadata.tool_calls) {
          console.log(
            `\n🔧 Agent executed tool: ${toolCall.name} (${toolCall.id})`,
          );
          console.log(
            "📋 Tool Call Details:",
            JSON.stringify(toolCall, null, 2),
          );
          toolCalls.push(toolCall);
        }
      }

      // Show tool results if present in additional_kwargs
      if (chunk.additional_kwargs?.tool_result) {
        const { tool_name, tool_result, tool_call_id } =
          chunk.additional_kwargs;
        console.log(
          `\n🛠️ Tool '${tool_name}' (${tool_call_id}) completed with result: ${tool_result}`,
        );
      }
    }

    console.log(`\n✅ Stream ended. Tool calls executed: ${toolCalls.length}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

agentExample().catch(console.error);
```

#### Using MCP Tools

You can also use MCP (Model Context Protocol) tools with the agent:

```typescript
import { HerokuAgent } from "heroku-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "heroku-langchain/types";

async function mcpExample() {
  const tools: HerokuAgentToolDefinition[] = [
    {
      type: "mcp",
      name: "mcp-brave/brave_web_search", // MCP tool name registered on Heroku MCP Toolkit
    },
  ];

  const agentExecutor = new HerokuAgent({
    tools: tools,
  });

  const stream = await agentExecutor.stream([
    new HumanMessage("What is new in the world of AI?"),
  ]);

  for await (const chunk of stream) {
    if (chunk.content) {
      process.stdout.write(chunk.content as string);
    }
    // Handle tool calls and results as shown in the previous example
  }
}
```

## Examples

Complete working examples are available in the `examples/` folder, organized by functionality:

### Chat Completions (`ChatHeroku`)

- `examples/chat-basic.ts` — Basic chat completion
- `examples/chat-custom-tool.ts` — Custom weather tool with function calling
- `examples/chat-structured-output.ts` — Structured output with Zod schemas
- `examples/chat-wikipedia-tool.ts` — Tool integration with Wikipedia search
- `examples/chat-lcel-prompt.ts` — LCEL with prompt templates
- `examples/chat-runnable-sequence.ts` — Chaining with RunnableSequence

### Agents (`HerokuAgent`)

- `examples/heroku-agent-example.ts` — Using Heroku tools to execute commands on apps
- `examples/heroku-agent-example-mcp.ts` — Using MCP tools with agents

### Text Embeddings (`HerokuEmbeddings`)

- `examples/embeddings-basic.ts` — Basic embeddings usage for queries and documents

### Advanced Integrations

- `examples/langraph.ts` — Multi-agent workflow with LangGraph
- `examples/heroku-agent-langgraph.ts` — CAgent workflow with LangGraph and Heroku Tools
- `examples/langraph-mcp.ts` — LangGraph with MCP tools for database interactions

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
npx tsx examples/heroku-agent-example.ts

# Run the embeddings example
npx tsx examples/embeddings-basic.ts
```

## API Documentation

For more detailed information on the available classes, methods, and types, please refer to the source code and TypeDoc generated documentation (if available).

- `ChatHeroku`: For chat completions with function calling and structured output support.
- `HerokuAgent`: For agent-based interactions with Heroku and MCP tools.
- `HerokuMiaEmbeddings`: For generating text embeddings and semantic search.
- `types.ts`: Contains all relevant TypeScript type definitions.

## Testing

This project uses Node.js's native test runner with TypeScript support. The test suite covers:

- Common utilities (configuration, message transformation, tool conversion)
- Type definitions and interfaces
- ChatHeroku class functionality
- HerokuAgent class functionality
- HerokuMiaEmbeddings class functionality
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
- `test/integration.test.ts` - End-to-end integration tests

All tests use environment variable mocking to avoid requiring actual API keys during testing.

## License

Apache 2.0
