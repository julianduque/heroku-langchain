import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { Tool } from "@langchain/core/tools";
import { HerokuAgent } from "./heroku-agent.js";
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
  const llm = new HerokuAgent(fields);
  return createReactAgent({ llm, tools });
}
