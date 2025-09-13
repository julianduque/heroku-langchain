import { HerokuAgent, createHerokuAgent } from "../src"; // Adjusted for local example structure
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "../src/types"; // Assuming types are exported from ../src/types

async function main() {
  console.log("🤖 Running HerokuAgent Example...");

  const appName = process.env.HEROKU_APP_NAME || "mia-inference-demo"; // Change this to your actual app name
  const tools: HerokuAgentToolDefinition[] = [
    {
      type: "heroku_tool",
      name: "dyno_run_command",
      runtime_params: {
        target_app_name: appName,
        tool_params: {
          cmd: "date",
          description: "Gets the current date and time on the server.",
          parameters: { type: "object", properties: {} },
        },
      },
    },
  ];

  console.log(`📱 Using app: ${appName}`);
  console.log("💡 Note: Make sure this app exists and you have access to it!");
  console.log(
    "   Set HEROKU_APP_NAME environment variable to use a different app.",
  );


  const agent = createHerokuAgent({
    tools: tools,
  });

  const agentModel = new HerokuAgent({
    tools: tools,
  });

  try {
    console.log("\n🔧 === Heroku ReaAct Agent ===");
    const agentResponse = await agent.invoke({
      messages: [
        new HumanMessage(
          "What time is it on the app server? Please use the available tools to check.",
        ),
      ],
    });
    console.log(
      agentResponse.messages[agentResponse.messages.length - 1].content,
    );

    console.log("\n🔧 === Heroku Tool Execution ===");

    const response = await agentModel.invoke([
      new HumanMessage(
        "What time is it on the app server? Please use the available tools to check.",
      ),
    ]);
    console.log(response.content);

    // First interaction - simple streaming
    console.log("\n🔄 HerokuAgent Stream...");
    const stream = await agentModel.stream([
      new HumanMessage(
        "What time is it on the app server? Please use the available tools to check.",
      ),
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
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);
