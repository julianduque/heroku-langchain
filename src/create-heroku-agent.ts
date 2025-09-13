import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { Tool } from "@langchain/core/tools";
import { HerokuAgent } from "./heroku-agent.js";
import type { HerokuAgentToolDefinition } from "./types.js";
import type { HerokuAgentFields } from "./types.js";

/**
 * Creates a LangGraph agent powered by the HerokuAgent model.
 *
 * This helper initializes a HerokuAgent instance and wraps it
 * with LangGraph's prebuilt React agent, allowing Heroku's
 * server-side tools to be used alongside any provided LangChain
 * tools.
 *
 * @param fields - Configuration options for the underlying HerokuAgent.
 *                 Includes definitions for Heroku server-side tools.
 * @param tools - Optional LangChain tools to execute locally within the agent.
 * @returns A LangGraph agent executor configured with the HerokuAgent.
 */
export function createHerokuAgent(
  fields?: HerokuAgentFields,
  tools: Tool[] = [],
) {
  // Create base agent
  let llm = new HerokuAgent(fields);

  // If server-side tools are configured on the agent, bind them so we register
  // local no-op counterparts to satisfy LangGraph tool execution.
  const serverTools: HerokuAgentToolDefinition[] | undefined = fields?.tools;
  if (serverTools && serverTools.length > 0) {
    llm = llm.bindTools(serverTools);
  }

  // Merge any user-provided local tools with our generated no-op tools
  const mergedTools: Tool[] = [...tools, ...llm.getLocalTools()];

  return createReactAgent({ llm, tools: mergedTools });
}
