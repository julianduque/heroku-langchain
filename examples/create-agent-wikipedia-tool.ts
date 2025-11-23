import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";
import { createAgent, tool } from "langchain";
import { ChatHeroku } from "../src";

const wikipediaTool = new WikipediaQueryRun({ topKResults: 2 });

const wikipediaSearchTool = tool(
  async ({ query }) => {
    return wikipediaTool.invoke(query);
  },
  {
    name: "wikipedia_search",
    description: "Searches Wikipedia for information about a given topic.",
    schema: z.object({
      query: z.string().describe("The search query for Wikipedia"),
    }),
  },
);

async function main() {
  console.log(
    "📚 Running ChatHeroku with Wikipedia Tool Example (LangChain 1.0)...",
  );

  const model = new ChatHeroku({ temperature: 0.1 });

  // Use LangChain 1.0's createAgent for automatic tool execution
  const agent = createAgent({
    model,
    tools: [wikipediaSearchTool],
    systemPrompt:
      "You are a helpful research assistant. Use Wikipedia to find accurate information and provide well-sourced answers.",
  });

  try {
    console.log("\n🔍 Searching Wikipedia for information about Heroku...");

    const result = await agent.invoke({
      messages: [new HumanMessage("Summarize Heroku using Wikipedia")],
    });

    console.log("\n📖 --- Wikipedia Summary ---");
    console.log(result.messages[result.messages.length - 1].content);
  } catch (error) {
    console.error("❌ Error during Wikipedia tool example:", error);
  }
}

main().catch(console.error);
