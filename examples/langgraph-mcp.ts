import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { loadMcpTools } from "@langchain/mcp-adapters";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ChatHeroku } from "../src";

async function main() {
  const model = new ChatHeroku();

  const transport = new StdioClientTransport({
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-postgres",
      `${process.env.DATABASE_URL}?sslmode=no-verify`,
    ],
  });

  const client = new Client({ name: "database-client", version: "1.0.0" });
  await client.connect(transport);

  const tools = await loadMcpTools("database", client);
  const agent = createReactAgent({ llm: model, tools });

  const response = await agent.invoke({
    messages: [new HumanMessage("List all repositories")],
  });
  console.log(response.messages[response.messages.length - 1].content);
}

main().catch(console.error);
