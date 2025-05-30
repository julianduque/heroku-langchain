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

      // Track tool calls if present in tool_call_chunks
      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        for (const toolCallChunk of chunk.tool_call_chunks) {
          if (toolCallChunk.name) {
            toolCalls.push({
              id: toolCallChunk.id,
              name: toolCallChunk.name,
              args: toolCallChunk.args,
            });
            console.log(`\n🔧 Agent is calling tool: ${toolCallChunk.name}`);
          }
        }
      }

      // Show tool results if present in additional_kwargs
      if (chunk.additional_kwargs?.tool_result) {
        const { tool_name, tool_result, tool_call_id } =
          chunk.additional_kwargs;
        console.log(
          `\n🛠️ Tool '${tool_name}' (${tool_call_id}) completed with result: ${tool_result}`,
        );

        // Track this as a completed tool call
        const existingCall = toolCalls.find((tc) => tc.id === tool_call_id);
        if (!existingCall && tool_name) {
          toolCalls.push({
            id: tool_call_id,
            name: tool_name,
            args: {}, // We don't have original args from additional_kwargs
            result: tool_result,
          });
        } else if (existingCall) {
          (existingCall as any).result = tool_result;
        }
      }
    }

    console.log(`\n✅ Stream ended. Tool calls executed: ${toolCalls.length}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);
