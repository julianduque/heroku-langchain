import { HerokuMiaAgent } from "../src"; // Adjusted for local example structure
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "../src/types"; // Assuming types are exported from ../src/types

async function main() {
  console.log("Running HerokuMiaAgent Example...");

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

  const agentExecutor = new HerokuMiaAgent({
    tools: tools,
  });

  try {
    console.log("\n=== Heroku Tool Execution ===");

    // First interaction - simple streaming
    console.log("\nStreaming HerokuMiaAgent...");
    const stream = await agentExecutor.stream([
      new HumanMessage("What is new in the world of AI?"),
    ]);

    const toolCalls: any[] = [];

    for await (const chunk of stream) {
      if (chunk.content) {
        process.stdout.write(chunk.content as string);
      }

      // Show tool calls if present in response_metadata (where Heroku puts them)
      if (chunk.response_metadata?.tool_calls) {
        for (const toolCall of chunk.response_metadata.tool_calls) {
          console.log(
            `\n🔧 Agent executed tool: ${toolCall.name} (${toolCall.id})`,
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
          `\n🛠️ Tool '${tool_name}' (${tool_call_id}) completed with result: ${tool_result}`,
        );
      }

      // Show tool results from response_metadata as well
      if (chunk.response_metadata?.tool_results) {
        console.log(
          "\n📋 Tool Results Details:",
          JSON.stringify(chunk.response_metadata.tool_results, null, 2),
        );
      }
    }

    console.log(`\n✅ Stream ended. Tool calls executed: ${toolCalls.length}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);
