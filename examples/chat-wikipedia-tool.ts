import { z } from "zod";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";
import { RunnableLambda } from "@langchain/core/runnables";
import { ChatHeroku } from "../src";

class WikipediaSearchTool extends StructuredTool {
  name = "wikipedia_search";
  description = "Searches Wikipedia for information about a given topic.";
  schema = z.object({ query: z.string() });

  private wikipediaTool: WikipediaQueryRun;

  constructor() {
    super();
    this.wikipediaTool = new WikipediaQueryRun({ topKResults: 2 });
  }

  async _call(arg: { query: string }, _rm?, parentConfig?) {
    return this.wikipediaTool.invoke(arg.query, parentConfig);
  }
}

async function main() {
  const wikipediaTool = new WikipediaSearchTool();
  const llm = new ChatHeroku({ temperature: 0.1 });
  const tools = [wikipediaTool];
  const llmWithTools = llm.bindTools(tools);

  const agent = RunnableLambda.from(
    async (
      input: { messages: (HumanMessage | AIMessage | ToolMessage)[] },
      config,
    ) => {
      const chat = [...input.messages];
      let res = await llmWithTools.invoke(chat, config);
      chat.push(res);
      if (res.tool_calls?.length) {
        for (const tc of res.tool_calls) {
          const tool = tools.find((t) => t.name === tc.name)!;
          const out = await tool.invoke(tc.args, config);
          chat.push(new ToolMessage({ content: out, tool_call_id: tc.id! }));
        }
        res = await llmWithTools.invoke(chat, config);
      }
      return res.content;
    },
  );

  const answer = await agent.invoke({
    messages: [new HumanMessage("Summarize Heroku using Wikipedia")],
  });
  console.log(answer);
}

main().catch(console.error);
