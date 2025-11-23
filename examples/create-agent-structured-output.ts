import { createAgent, tool } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatHeroku } from "../src";
import { InteropZodType } from "@langchain/core/utils/types";

const WeatherSchema = z.object({
  city: z.string(),
  temperatureCelsius: z.number(),
  condition: z.string(),
}) as unknown as InteropZodType<typeof WeatherSchema>;

// Simple weather tool with deterministic responses for the demo
const getWeather = tool(
  async ({ city }) => {
    const lower = city.toLowerCase();
    if (lower.includes("tokyo")) {
      return JSON.stringify({
        city: "Tokyo",
        temperatureCelsius: 18,
        condition: "Cloudy",
      });
    }
    if (lower.includes("london")) {
      return JSON.stringify({
        city: "London",
        temperatureCelsius: 12,
        condition: "Rainy",
      });
    }
    return JSON.stringify({
      city,
      temperatureCelsius: 25,
      condition: "Sunny",
    });
  },
  {
    name: "get_weather",
    description: "Get weather for a given city.",
    schema: z.object({
      city: z
        .string()
        .describe("City the user is asking about (case-insensitive)"),
    }),
  },
);

async function main() {
  const model = new ChatHeroku({
    model: process.env.INFERENCE_MODEL_ID ?? "gpt-oss-120b",
    temperature: 0,
  });

  const agent = createAgent({
    model,
    tools: [getWeather],
    responseFormat: WeatherSchema,
    systemPrompt:
      "You are a weather assistant. Use get_weather to answer every question.",
  });

  const result = await agent.invoke({
    messages: [
      new HumanMessage(
        "What's the weather like in Tokyo? Feel free to elaborate.",
      ),
    ],
  });

  console.log(result.structuredResponse);
}

main().catch(console.error);
