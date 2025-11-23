import { createAgent, createMiddleware } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgent } from "../src"; // Adjusted for local example structure
import { HerokuAgentToolDefinition } from "../src/types";

async function main() {
  console.log("🤖 Running createAgent + HerokuAgent Example...");

  const appName = process.env.HEROKU_APP_NAME || "mia-inference-demo";
  const tools: HerokuAgentToolDefinition[] = [
    {
      type: "heroku_tool",
      name: "dyno_run_command",
      runtime_params: {
        target_app_name: appName,
        tool_params: {
          cmd: "uname -a",
          description: "Gets the current kernel version on the server.",
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

  // Create the HerokuAgent model with the server-side tools
  const model = new HerokuAgent();

  // Replace pre/post model hooks with LangChain v1 middleware
  const loggingMiddleware = createMiddleware({
    name: "LoggingMiddleware",
    wrapModelCall: async (request, handler) => {
      console.log("🧠 system prompt", request.systemPrompt ?? "<default>");
      const response = await handler(request);

      // Heroku executes tools server-side; surface those events from metadata.
      const metadata =
        (response?.response_metadata as Record<string, any>) ?? {};
      const toolCalls =
        metadata.tool_calls ?? response?.additional_kwargs?.tool_calls ?? [];
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        for (const call of toolCalls) {
          console.log(
            `🛠️  server tool call: ${call.name} (${call.id ?? "no-id"})`,
            JSON.stringify(call.args ?? {}, null, 2),
          );
        }
      }

      const toolResult =
        metadata.tool_results ??
        response?.additional_kwargs?.tool_results ??
        response?.additional_kwargs?.tool_result;
      if (toolResult) {
        console.log(
          `📋 server tool result from ${toolResult.tool_name ?? "unknown"} (${toolResult.tool_call_id ?? "no-id"})`,
          toolResult.result ?? toolResult,
        );
      }

      return response;
    },
  });

  const agent = createAgent({
    model,
    tools,
    systemPrompt:
      "You are a Heroku operator. Use dyno_run_command to inspect the target app.",
    middleware: [loggingMiddleware],
  });

  try {
    console.log("\n🔧 === Heroku createAgent Demo ===");
    const response = await agent.invoke({
      messages: [
        new HumanMessage("What kernel version is running on the app server?"),
      ],
    });
    console.log(response.messages[response.messages.length - 1].content);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);
