import { z } from "zod";
import { ChatHeroku } from "../src";
import { HumanMessage } from "@langchain/core/messages";

const JokeSchema = z.object({
  setup: z.string(),
  punchline: z.string(),
});

async function main() {
  const llm = new ChatHeroku({ temperature: 0.7 });
  const structured = llm.withStructuredOutput(JokeSchema);

  const res = await structured.invoke([
    new HumanMessage("Tell me a short, clean programming joke."),
  ]);

  console.log(res);

  const structuredWithRaw = llm.withStructuredOutput(JokeSchema, {
    includeRaw: true,
  });

  const resWithRaw = await structuredWithRaw.invoke([
    new HumanMessage("Tell me a short, clean programming joke."),
  ]);

  console.log(resWithRaw);
}

main().catch(console.error);
