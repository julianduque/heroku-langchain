import { z } from "zod";
import { createAgent, tool } from "langchain";
import { ChatHeroku } from "../src";

const getWeather = tool(
  async ({ city }) => {
    return `The weather in ${city} is always sunny!`;
  },
  {
    name: "get_weather",
    description: "Get weather for a given city.",
    schema: z.object({
      city: z.string(),
    }),
  },
);

async function main() {
  const agent = createAgent({
    model: new ChatHeroku({
      model: process.env.INFERENCE_MODEL_ID ?? "gpt-oss-120b",
      temperature: 0,
    }),
    tools: [getWeather],
  });

  const stream = await agent.stream(
    { messages: [{ role: "user", content: "what is the weather in sf" }] },
    { streamMode: "updates" },
  );

  for await (const chunk of stream) {
    const [step, content] = Object.entries(chunk)[0];
    console.log(`step: ${step}`);
    console.log(`content: ${JSON.stringify(content, null, 2)}`);
  }
}

main().catch(console.error);
