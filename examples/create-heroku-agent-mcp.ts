import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgent } from "../src";
import { HerokuTool } from "../src/types";

async function main() {
  console.log("🤖 Running HerokuAgent MCP Example...");

  const appName = process.env.HEROKU_APP_NAME || "mia-inference-demo";
  const tools: HerokuTool[] = [
    {
      type: "mcp",
      name: "mcp-brave/brave_web_search", // MCP tool name registered on Heroku MCP Toolkit
    },
  ];

  console.log(`📱 Using app: ${appName}`);
  console.log("💡 Note: Make sure this app exists and you have access to it!");
  console.log(
    "   Set HEROKU_APP_NAME environment variable to use a different app.",
  );

  const model = new HerokuAgent();
  const agent = createAgent({
    model,
    tools,
    systemPrompt:
      "Blend model knowledge with results from mcp-brave/brave_web_search.",
  });

  try {
    console.log("\n🔧 === Heroku MCP Tool Execution ===");

    const response = await agent.invoke({
      messages: [new HumanMessage("What is new in the world of AI?")],
    });

    const finalMessage = response.messages.at(-1);
    console.log("\n🧠 Final Response:");
    console.log(finalMessage?.content);

    for (const message of response.messages) {
      const metadata = message.response_metadata as
        | { tool_calls?: unknown[] }
        | undefined;
      if (metadata?.tool_calls?.length) {
        console.log("\n⚡ MCP Tool Calls:");
        console.log(JSON.stringify(metadata.tool_calls, null, 2));
      }

      if (message.additional_kwargs?.tool_result) {
        console.log("\n📋 Tool Result:");
        console.log(JSON.stringify(message.additional_kwargs, null, 2));
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);
