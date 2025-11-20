import { AgentMiddleware, createAgent } from "langchain";
import type { Tool } from "@langchain/core/tools";
import { HerokuAgent } from "./heroku-agent.js";
import type { HerokuAgentToolDefinition } from "./types.js";
import type { HerokuAgentFields } from "./types.js";

export interface CreateHerokuAgentOptions {
  /** Optional system prompt passed to LangChain's createAgent helper. */
  systemPrompt?: string;
  /**
   * Middleware hooks for the new LangChain v1 agent runtime.
   * Use these to replicate pre/post model hooks or wrap tool calls.
   */
  middleware?: readonly AgentMiddleware[];
}

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
  options: CreateHerokuAgentOptions = {},
) {
  const { systemPrompt, middleware } = options;
  const { tools: serverTools, ...herokuFields } = fields ?? {};

  // Create base agent
  let llm = new HerokuAgent(herokuFields);

  // If server-side tools are configured on the agent, bind them so we register
  // local no-op counterparts to satisfy LangGraph tool execution.
  if (serverTools && serverTools.length > 0) {
    llm = llm.bindTools(serverTools);
  }

  // Merge any user-provided local tools with our generated no-op tools
  const mergedTools: Tool[] = [...tools, ...llm.getLocalTools()];

  return createAgent({
    model: llm,
    tools: mergedTools,
    systemPrompt,
    middleware,
  });
}
