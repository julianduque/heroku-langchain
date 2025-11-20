import { HerokuAgent } from "../src"; // Adjusted for local example structure
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "../src/types"; // Assuming types are exported from ../src/types

async function main() {
  console.log("🤖 Running HerokuAgent MCP Example...");

  const appName = process.env.HEROKU_APP_NAME || "mia-inference-demo";
  const tools: HerokuAgentToolDefinition[] = [
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

  const agent = new HerokuAgent({
    tools,
  });

  try {
    console.log("\n🔧 === Heroku MCP Tool Execution ===");

    // First interaction - simple streaming
    console.log("\n🔄 Streaming HerokuAgent...");
    const stream = await agent.stream([
      new HumanMessage("What is new in the world of AI?"),
    ]);

    const toolCalls: any[] = [];

    for await (const chunk of stream) {
      if (chunk.content) {
        process.stdout.write(chunk.content as string);
      }

      const chunkToolCalls = chunk.tool_calls ?? chunk.response_metadata?.tool_calls;
      if (chunkToolCalls?.length) {
        for (const toolCall of chunkToolCalls) {
          console.log(
            `\n⚡ Agent executed tool: ${toolCall.name} (${toolCall.id})`,
          );
          // Log the complete tool call metadata to see runtime_params
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
          `\n✅ Tool '${tool_name}' (${tool_call_id}) completed with result: ${tool_result}`,
        );
      }

      const toolResults =
        chunk.response_metadata?.tool_results ?? chunk.tool_call_chunks;
      if (toolResults?.length) {
        console.log("\n📋 Tool Results Details:");
        console.log(JSON.stringify(toolResults, null, 2));
      }
    }

    console.log(`\n✅ Stream ended. Tool calls executed: ${toolCalls.length}`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);
