import { HerokuMiaAgent } from "../src"; // Adjusted for local example structure
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "../src/types"; // Assuming types are exported from ../src/types

async function main() {
  console.log("Running HerokuMiaAgent Example...");

  const tools: HerokuAgentToolDefinition[] = [
    {
      type: "heroku_tool",
      name: "dyno_run_command",
      runtime_params: {
        target_app_name: "heroku-mia-app",
        tool_params: {
          cmd: "date",
          description: "Gets the current date and time on the server.",
          parameters: { type: "object", properties: {} },
        },
      },
    },
  ];

  const agentExecutor = new HerokuMiaAgent({
    tools: tools,
  });

  try {
    console.log("\nStreaming HerokuMiaAgent...");
    const stream = await agentExecutor.stream([
      new HumanMessage(
        "What time is it on the app server named heroku-mia-app?",
      ),
    ]);

    for await (const chunk of stream) {
      if (chunk.content) {
        process.stdout.write(chunk.content as string);
      }
      // Check for tool calls made by the agent, now using tool_call_chunks
      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        console.log(
          "\nAgent wants to call tools (via tool_call_chunks):",
          chunk.tool_call_chunks,
        );
      }
      // Check for tool results from Heroku (derived from a tool.completion event)
      if (chunk.additional_kwargs?.tool_results) {
        console.log(
          "\nHeroku executed tool, result:",
          chunk.additional_kwargs.tool_results,
        );
      }
      // To see all additional_kwargs for different event types:
      if (
        chunk.additional_kwargs &&
        Object.keys(chunk.additional_kwargs).length > 0
      ) {
        console.log("\nChunk additional_kwargs:", chunk.additional_kwargs);
      }
    }
    console.log("\nStream ended.");
  } catch (error) {
    console.error("Error during agent stream:", error);
  }
}

main().catch(console.error);
