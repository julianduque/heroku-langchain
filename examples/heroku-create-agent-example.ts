import { createAgent, createMiddleware } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { HerokuAgent } from "../src"; // Adjusted for local example structure
import { HerokuAgentToolDefinition } from "../src/types";

async function main() {
  console.log("🤖 Running createAgent + HerokuAgent Example...");

  const appName = process.env.HEROKU_APP_NAME || "mia-inference-demo";
  const herokuTools: HerokuAgentToolDefinition[] = [
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

  // Bind Heroku server tools so createAgent can mirror them as local tool stubs
  let model = new HerokuAgent({ tools: herokuTools });
  model = model.bindTools(herokuTools);

  // Replace pre/post model hooks with LangChain v1 middleware
  const loggingMiddleware = createMiddleware({
    beforeModel: async ({ systemPrompt }) => {
      console.log("🧠 system prompt", systemPrompt ?? "<default>");
    },
    wrapToolCall: async (request, handler) => {
      console.log(`🛠️  executing tool: ${request.tool.name}`);
      const result = await handler(request);
      console.log(`✅ tool ${request.tool.name} finished.`);
      return result;
    },
  });

  const agent = createAgent({
    model,
    tools: model.getLocalTools(),
    systemPrompt:
      "You are a Heroku operator. Use dyno_run_command to inspect the target app.",
    middleware: [loggingMiddleware],
  });

  try {
    console.log("\n🔧 === Heroku createAgent Demo ===");
    const response = await agent.invoke({
      messages: [
        new HumanMessage(
          "What kernel version is running on the app server?",
        ),
      ],
    });
    console.log(response.messages[response.messages.length - 1].content);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);
