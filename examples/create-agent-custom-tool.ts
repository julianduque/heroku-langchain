import { ChatHeroku } from "../src"; // Adjusted for local example structure
import { HumanMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware, tool } from "langchain";
import { z } from "zod";

// Define tool with proper Zod schema for type safety
const weatherTool = tool(
  async ({ location, unit = "celsius" }) => {
    console.log(
      `🌡️ [Tool Call] getCurrentWeather called with location: ${location}, unit: ${unit}`,
    );

    if (location.toLowerCase().includes("tokyo")) {
      return JSON.stringify({
        location: "Tokyo",
        temperature: "15",
        unit: unit,
        condition: "Cloudy",
      });
    }
    if (location.toLowerCase().includes("london")) {
      return JSON.stringify({
        location: "London",
        temperature: "10",
        unit: unit,
        condition: "Rainy",
      });
    }
    return JSON.stringify({ location, temperature: "unknown", unit: unit });
  },
  {
    name: "get_current_weather",
    description:
      "Get the current weather in a given location. Returns temperature and conditions.",
    schema: z.object({
      location: z.string().describe("The city or location to get weather for"),
      unit: z
        .enum(["celsius", "fahrenheit"])
        .optional()
        .default("celsius")
        .describe("Temperature unit"),
    }),
  },
);

async function main() {
  console.log(
    "🛠️ Running ChatHeroku with Custom Tool Example with createAgent...",
  );

  const loggingMiddleware = createMiddleware({
    name: "LoggingMiddleware",
    wrapModelCall: async (request, handler) => {
      console.log("🧠 system prompt:", request.systemPrompt ?? "<default>");
      return handler(request);
    },
    wrapToolCall: async (request, handler) => {
      console.log(`🛠️  executing tool: ${request.tool.name}`);
      const result = await handler(request);
      console.log(`✅ tool ${request.tool.name} finished.`);
      return result;
    },
  });

  const model = new ChatHeroku({
    // model: "gpt-oss-120b", // Choose a model good at tool use
    temperature: 0.2,
  });

  const agent = createAgent({
    model,
    tools: [weatherTool],
    middleware: [loggingMiddleware],
    systemPrompt:
      "You are a helpful weather assistant. Use the weather tool to provide accurate weather information.",
  });

  try {
    console.log("\n🤖 Invoking agent with weather question...");

    const result = await agent.invoke({
      messages: [new HumanMessage("What is the weather like in London?")],
    });

    console.log("\n🎯 --- Final Result ---");
    console.log(
      "Final Response:",
      result.messages[result.messages.length - 1].content,
    );
  } catch (error) {
    console.error("❌ Error during custom tool example:", error);
  }
}

main().catch(console.error);
