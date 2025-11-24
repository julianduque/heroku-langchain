import { createAgent } from "langchain";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { HerokuAgent } from "../src";
import { HerokuTool } from "../src/types";

const stringifyMessageContent = (content: BaseMessage["content"]): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part === "object" && part !== null && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return JSON.stringify(part);
      })
      .join("");
  }
  if (content === null || content === undefined) return "";
  return JSON.stringify(content);
};

async function main() {
  console.log("🤖 Running createAgent Examples with HerokuAgent...");

  const appName = process.env.HEROKU_APP_NAME || "mia-inference-demo"; // Change this to your actual app name
  const tools: HerokuTool[] = [
    {
      type: "heroku_tool",
      name: "dyno_run_command",
      runtime_params: {
        target_app_name: appName,
        tool_params: {
          cmd: "date && uptime && uname -a",
          description:
            "Gets the current date and time, uptime, and kernel version on the server.",
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

  const model = new HerokuAgent();
  const agent = createAgent({
    model,
    tools,
    systemPrompt:
      "You are a Heroku operator. Prefer dyno_run_command to inspect the target app.",
  });

  try {
    console.log("\n🔧 === HerokuAgent Tool Execution ===");

    const response = await agent.invoke({
      messages: [
        new HumanMessage(
          "1. What time is it on the app server? Please use the available tools to check.",
        ),
      ],
    });
    console.log(response.messages.at(-1)?.content);

    console.log("\n🔄 createAgent Stream...");
    const stream = await agent.stream(
      {
        messages: [
          new HumanMessage(
            "2. Collect detailed uptime information from the target app.",
          ),
        ],
      },
      { streamMode: "updates" },
    );

    let lastAgentMessageId: string | undefined;
    let lastAgentPrintedLength = 0;

    for await (const chunk of stream as AsyncIterable<Record<string, any>>) {
      const [step, payload] = Object.entries(chunk)[0] ?? [];
      if (!payload) continue;

      const messages = Array.isArray(payload.messages)
        ? (payload.messages as BaseMessage[])
        : undefined;
      const latestMessage = messages?.at(-1);

      if (!latestMessage) {
        console.log(`\n📡 ${step} update:`, JSON.stringify(payload, null, 2));
        continue;
      }

      const messageType =
        typeof (latestMessage as any)._getType === "function"
          ? (latestMessage as any)._getType()
          : undefined;

      if (messageType === "ai") {
        const text = stringifyMessageContent(latestMessage.content);
        if (latestMessage.id !== lastAgentMessageId) {
          process.stdout.write("\n🧠 Agent: ");
          lastAgentMessageId = latestMessage.id;
          lastAgentPrintedLength = 0;
        }
        const delta = text.slice(lastAgentPrintedLength);
        if (delta.length > 0) {
          process.stdout.write(delta);
          lastAgentPrintedLength = text.length;
        }

        const metadata = latestMessage.response_metadata as
          | { tool_calls?: any[] }
          | undefined;
        if (metadata?.tool_calls?.length) {
          for (const toolCall of metadata.tool_calls) {
            console.log(
              `\n⚡ Agent executed tool: ${toolCall.name} (${toolCall.id})`,
            );
            console.log(
              "📋 Tool Call Details:",
              JSON.stringify(toolCall, null, 2),
            );
          }
        }

        const toolResult = latestMessage.additional_kwargs?.tool_result as
          | {
              tool_name?: string;
              tool_result?: string;
              tool_call_id?: string;
            }
          | undefined;
        if (toolResult?.tool_result) {
          console.log(
            `\n🛠️ Tool '${toolResult.tool_name}' (${toolResult.tool_call_id}) completed with result: ${toolResult.tool_result}`,
          );
        }
        continue;
      }

      if (messageType === "tool") {
        const toolText = stringifyMessageContent(latestMessage.content);
        console.log(
          `\n🧰 Tool response (${(latestMessage as any).name ?? "tool"}): ${toolText}`,
        );
        continue;
      }

      console.log(
        `\n📩 ${step} message update:`,
        stringifyMessageContent(latestMessage.content),
      );
    }
    console.log(`\n✅ stream() updates example complete.`);

    console.log("\n🎧 createAgent streamEvents (token-level)...");
    const eventStream = await agent.streamEvents(
      {
        messages: [
          new HumanMessage(
            "What is the kernel version of the server? Use the dyno_run_command tool to get the information.",
          ),
        ],
      },
      { version: "v2" },
    );

    for await (const event of eventStream as AsyncIterable<any>) {
      if (event.event === "on_chat_model_start") {
        console.log(`\n🧩 Chat model started: ${event.name}`);
        continue;
      }

      if (event.event === "on_chat_model_stream") {
        const chunk: any = event.data?.chunk;
        const chunkContent =
          typeof chunk === "string"
            ? chunk
            : stringifyMessageContent(
                ((chunk?.content ?? chunk ?? "") as BaseMessage["content"]) ??
                  "",
              );
        if (chunkContent) {
          process.stdout.write(chunkContent);
        }
        continue;
      }

      if (event.event === "on_chat_model_end") {
        const output =
          event.data?.output && "content" in event.data.output
            ? stringifyMessageContent(
                (event.data.output.content ?? "") as BaseMessage["content"],
              )
            : "";
        if (output) {
          console.log(`\n🧠 Final assistant output: ${output}`);
        }
        continue;
      }

      if (event.event === "on_tool_start") {
        console.log(
          `\n🛠️ [streamEvents] Tool start: ${event.name}\n   input: ${JSON.stringify(event.data?.input, null, 2)}`,
        );
        continue;
      }

      if (event.event === "on_tool_stream") {
        if (typeof event.data?.chunk === "string") {
          process.stdout.write(
            `\n📤 [streamEvents] Tool chunk: ${event.data.chunk}`,
          );
        }
        continue;
      }

      if (event.event === "on_tool_end") {
        console.log(
          `\n✅ [streamEvents] Tool result: ${JSON.stringify(event.data?.output, null, 2)}`,
        );
        continue;
      }
    }
    console.log(`\n✅ streamEvents example complete.`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);
