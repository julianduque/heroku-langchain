import { ChatHeroku } from "../src";
import { HumanMessage } from "@langchain/core/messages";

async function main() {
  const llm = new ChatHeroku({ temperature: 0.5, maxTokens: 512 });

  console.log("--- Basic Generation ---");
  const response = await llm.invoke([
    new HumanMessage("Tell me about Heroku Inference in one paragraph."),
  ]);

  console.log(response.content);

  console.log("\n--- Streaming ---");
  const stream = await llm.stream([
    new HumanMessage("Tell me about Heroku Inference in one paragraph."),
  ]);
  for await (const chunk of stream) {
    process.stdout.write(chunk.content as string);
  }
}

main().catch(console.error);
