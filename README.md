# Heroku Mia LangChain SDK

This SDK provides a convenient way to interact with Heroku's AI services, specifically for chat completions and agent functionalities.

## Installation

```bash
pnpm install heroku-langchain
```

## Basic Usage

Here's a simple example of how to use the `HerokuMia` class for chat completions:

```typescript
import { HerokuMia } from "heroku-langchain";
import { HumanMessage } from "@langchain/core/messages";

async function main() {
  // Ensure INFERENCE_MODEL_ID and INFERENCE_KEY are set in your environment
  // or pass them directly to the constructor:
  // const chat = new HerokuMia({ model: "your-model-id", apiKey: "your-api-key" });
  const chat = new HerokuMia({ model: "claude-3-7-sonnet" });

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

## Environment Variables

The SDK can utilize the following environment variables:

- `INFERENCE_MODEL_ID`: The ID of the inference model to use. This is required if not provided in the constructor.
- `INFERENCE_KEY`: Your Heroku Managed Inference and Agents API key. This is required if not provided in the constructor.
- `INFERENCE_URL`: The base URL for the Heroku Managed Inference and Agents API.

## Advanced Usage

### Using Tools

You can bind tools (functions) to the model for more complex interactions.

```typescript
import { HerokuMia } from "heroku-langchain";
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
  const chat = new HerokuMia({ model: "your-model-id" }).bindTools([
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

The `HerokuMiaAgent` class allows for more autonomous interactions with access to Heroku tools and MCP (Model Context Protocol) tools. Here's an example demonstrating agent usage:

```typescript
import { HerokuMiaAgent } from "heroku-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "heroku-langchain/types";

async function agentExample() {
  console.log("Running HerokuMiaAgent Example...");

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

  const agentExecutor = new HerokuMiaAgent({
    tools: tools,
  });

  try {
    console.log("\n=== Heroku Tool Execution ===");
    console.log("\nStreaming HerokuMiaAgent...");

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
import { HerokuMiaAgent } from "heroku-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "heroku-langchain/types";

async function mcpExample() {
  const tools: HerokuAgentToolDefinition[] = [
    {
      type: "mcp",
      name: "mcp-brave/brave_web_search", // MCP tool name registered on Heroku MCP Toolkit
    },
  ];

  const agentExecutor = new HerokuMiaAgent({
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

Complete working examples are available in the `examples/` folder:

- **`examples/heroku-mia-agent-example.ts`** - Demonstrates using Heroku tools with the agent to execute commands on Heroku apps
- **`examples/heroku-mia-agent-example-mcp.ts`** - Shows how to use MCP tools for web search and other external services

To run the examples:

```bash
# Set required environment variables
export INFERENCE_MODEL_ID="claude-3-5-sonnet"
export INFERENCE_KEY="your-heroku-api-key"
export HEROKU_APP_NAME="your-app-name"  # Optional, defaults to "mia-inference-demo"

# Run the Heroku tools example
tsx examples/heroku-mia-agent-example.ts

# Run the MCP tools example
tsx examples/heroku-mia-agent-example-mcp.ts
```

## API Documentation

For more detailed information on the available classes, methods, and types, please refer to the source code and TypeDoc generated documentation (if available).

- `HerokuMia`: For chat completions.
- `HerokuMiaAgent`: For agent-based interactions.
- `types.ts`: Contains all relevant TypeScript type definitions.

## Testing

This project uses Node.js's native test runner with TypeScript support. The test suite covers:

- Common utilities (configuration, message transformation, tool conversion)
- Type definitions and interfaces
- HerokuMia class functionality
- HerokuMiaAgent class functionality
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
- `test/heroku-mia.test.ts` - HerokuMia class tests
- `test/heroku-mia-agent.test.ts` - HerokuMiaAgent class tests
- `test/integration.test.ts` - End-to-end integration tests

All tests use environment variable mocking to avoid requiring actual API keys during testing.

## License

Apache 2.0
