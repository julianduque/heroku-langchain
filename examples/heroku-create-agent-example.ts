import { createHerokuAgent } from "../src"; // Adjusted for local example structure
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgentToolDefinition } from "../src/types"; // Assuming types are exported from ../src/types

async function main() {
  console.log("🤖 Running createHerokuAgent Example...");

  const appName = process.env.HEROKU_APP_NAME || "mia-inference-demo"; // Change this to your actual app name
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

  const agent = createHerokuAgent({
    tools: tools,
  });

  try {
    console.log("\n🔧 === Heroku ReaAct Agent ===");
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
