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
  // const chat = new HerokuMia({ model: "your-model-id", herokuApiKey: "your-api-key" });
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

The `HerokuMiaAgent` class allows for more autonomous interactions. Here is an example demonstrating its usage with a predefined Heroku tool:

```typescript
import { HerokuMiaAgent } from "heroku-langchain"; // Use "../src" for local dev, "heroku-langchain" for published package
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "heroku-langchain/types"; // Use "../src/types" for local dev

async function agentExample() {
  console.log("Running HerokuMiaAgent Example...");

  const tools: HerokuAgentToolDefinition[] = [
    {
      type: "heroku_tool",
      name: "dyno_run_command",
      runtime_params: {
        target_app_name: "your-heroku-app-name", // Replace with your actual Heroku app name
        tool_params: {
          cmd: "date",
          description: "Gets the current date and time on the server.",
          parameters: { type: "object", properties: {} },
        },
      },
    },
  ];

  // Ensure INFERENCE_MODEL_ID and INFERENCE_KEY are set in your environment
  // or pass them directly to the constructor, e.g.:
  // const agentExecutor = new HerokuMiaAgent({
  //   tools: tools,
  //   model: "your-model-id", // Optional: if not set, INFERENCE_MODEL_ID env var is used
  //   herokuApiKey: "your-api-key" // Optional: if not set, INFERENCE_KEY env var is used
  // });
  const agentExecutor = new HerokuMiaAgent({
    tools: tools,
  });

  try {
    console.log("\nStreaming HerokuMiaAgent...");
    const stream = await agentExecutor.stream([
      new HumanMessage(
        "What time is it on the app server named your-heroku-app-name?", // Adjust query to match your app name
      ),
    ]);

    for await (const chunk of stream) {
      if (chunk.content) {
        process.stdout.write(chunk.content as string);
      }
      // Check for tool calls made by the agent
      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        console.log("\nAgent wants to call tools:", chunk.tool_call_chunks);
      }
      // Check for tool results from Heroku
      if (chunk.additional_kwargs?.tool_results) {
        console.log(
          "\nHeroku executed tool, result:",
          chunk.additional_kwargs.tool_results,
        );
      }
      // To see all additional_kwargs for different event types:
      // if (
      //   chunk.additional_kwargs &&
      //   Object.keys(chunk.additional_kwargs).length > 0
      // ) {
      //   console.log("\nChunk additional_kwargs:", chunk.additional_kwargs);
      // }
    }
    console.log("\nStream ended.");
  } catch (error) {
    console.error("Error during agent stream:", error);
  }
}

agentExample().catch(console.error);
```

## API Documentation

For more detailed information on the available classes, methods, and types, please refer to the source code and TypeDoc generated documentation (if available).

- `HerokuMia`: For chat completions.
- `HerokuMiaAgent`: For agent-based interactions.
- `types.ts`: Contains all relevant TypeScript type definitions.

## Contributing

(Details on how to contribute to this project, if applicable)

## License

Apache 2.0
