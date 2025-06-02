import { BaseChatModel, BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { BaseMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { HerokuMiaAgentFields, HerokuMiaAgentCallOptions } from "./types.js";
/**
 * **HerokuMiaAgent** - Heroku Managed Inference Agent Integration
 *
 * A LangChain-compatible chat model that interfaces with Heroku's Managed Inference Agent API.
 * This class provides access to intelligent agents that can execute tools and perform complex
 * multi-step reasoning tasks. Agents have access to Heroku-specific tools like app management,
 * database operations, and can integrate with external services via MCP (Model Context Protocol).
 *
 * Unlike the basic HerokuMia model, agents are designed for autonomous task execution with
 * built-in tool calling capabilities and advanced reasoning patterns.
 *
 * @example
 * ```typescript
 * import { HerokuMiaAgent } from "heroku-langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 *
 * // Basic agent usage
 * const agent = new HerokuMiaAgent({
 *   model: "claude-3-5-sonnet",
 *   temperature: 0.3,
 *   tools: [
 *     {
 *       type: "heroku_tool",
 *       name: "dyno_run_command  ",
 *       runtime_params: {
 *         target_app_name: "my-app",
 *         tool_params: {
 *            cmd: "date",
 *            description: "Gets the current date and time on the server.",
 *            parameters: { type: "object", properties: {} },
 *          },
 *        },
 *       }
 *   ],
 *   apiKey: process.env.INFERENCE_KEY,
 *   apiUrl: process.env.INFERENCE_URL
 * });
 *
 * const response = await agent.invoke([
 *   new HumanMessage("Deploy my Node.js application to Heroku")
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // Agent with MCP tools
 * const agentWithMCP = new HerokuMiaAgent({
 *   model: "claude-3-5-sonnet",
 *   tools: [
 *     {
 *       type: "mcp",
 *       name: "mcp/read_file",
 *       description: "Read file contents via MCP"
 *     },
 *     {
 *       type: "heroku_tool",
 *       name: "scale_dyno",
 *       runtime_params: {
 *         target_app_name: "production-app"
 *       }
 *     }
 *   ]
 * });
 *
 * const result = await agentWithMCP.invoke([
 *   new HumanMessage("Read my package.json and scale the app based on the dependencies")
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // Streaming agent responses to see tool execution in real-time
 * const stream = await agent.stream([
 *   new HumanMessage("Check the status of all my Heroku apps and restart any that are down")
 * ]);
 *
 * for await (const chunk of stream) {
 *   if (chunk.response_metadata?.tool_calls) {
 *     console.log("Agent is executing:", chunk.response_metadata.tool_calls);
 *   }
 *   if (chunk.content) {
 *     process.stdout.write(chunk.content);
 *   }
 * }
 * ```
 *
 * @see {@link HerokuMiaAgentFields} for constructor options
 * @see {@link HerokuMiaAgentCallOptions} for runtime call options
 * @see [Heroku Agent API Documentation](https://devcenter.heroku.com/articles/heroku-inference-api-v1-agents-heroku)
 */
export declare class HerokuMiaAgent extends BaseChatModel<HerokuMiaAgentCallOptions> {
    protected model: string;
    protected temperature?: number;
    protected maxTokensPerRequest?: number;
    protected stop?: string[];
    protected topP?: number;
    protected tools?: any[];
    protected apiKey?: string;
    protected apiUrl?: string;
    protected maxRetries?: number;
    protected timeout?: number;
    protected streaming?: boolean;
    protected streamUsage?: boolean;
    protected additionalKwargs?: Record<string, any>;
    /**
     * Returns the LangChain identifier for this agent class.
     * @returns The string "HerokuMiaAgent"
     */
    static lc_name(): string;
    /**
     * Creates a new HerokuMiaAgent instance.
     *
     * @param fields - Configuration options for the Heroku Mia Agent
     * @throws {Error} When model ID is not provided and INFERENCE_MODEL_ID environment variable is not set
     *
     * @example
     * ```typescript
     * const agent = new HerokuMiaAgent({
     *   model: "claude-3-5-sonnet",
     *   temperature: 0.3,
     *   maxTokensPerRequest: 2000,
     *   tools: [
     *     {
     *       type: "heroku_tool",
     *       name: "dyno_run_command",
     *       runtime_params: {
     *         target_app_name: "my-app",
     *         tool_params: {
     *            cmd: "date",
     *            description: "Gets the current date and time on the server.",
     *            parameters: { type: "object", properties: {} },
     *          },
     *        },
     *       }
     *     }
     *   ],
     *   apiKey: "your-api-key",
     *   apiUrl: "https://us.inference.heroku.com"
     * });
     * ```
     */
    constructor(fields: HerokuMiaAgentFields);
    /**
     * Returns the LLM type identifier for this agent.
     * @returns The string "HerokuMiaAgent"
     */
    _llmType(): string;
    /**
     * Get the parameters used to invoke the agent.
     *
     * This method combines constructor parameters with runtime options to create
     * the final request parameters for the Heroku Agent API. Runtime options take
     * precedence over constructor parameters.
     *
     * @param options - Optional runtime parameters that override constructor defaults
     * @returns Combined parameters for the agent API request
     *
     * @internal
     */
    invocationParams(options?: Partial<HerokuMiaAgentCallOptions>): Omit<HerokuMiaAgentFields, keyof BaseChatModelParams> & {
        [key: string]: any;
    };
    _generate(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): Promise<ChatResult>;
    _stream(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): AsyncGenerator<AIMessageChunk>;
}
//# sourceMappingURL=heroku-mia-agent.d.ts.map