import { BaseChatModel, BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { BaseMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { HerokuMiaAgentFields, HerokuMiaAgentCallOptions } from "./types.js";
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
    static lc_name(): string;
    constructor(fields: HerokuMiaAgentFields);
    _llmType(): string;
    /**
     * Get the parameters used to invoke the agent.
     * This will need to be adapted for agent-specific parameters vs. chat completion.
     */
    invocationParams(options?: Partial<HerokuMiaAgentCallOptions>): Omit<HerokuMiaAgentFields, keyof BaseChatModelParams> & {
        [key: string]: any;
    };
    _generate(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): Promise<ChatResult>;
    _stream(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): AsyncGenerator<AIMessageChunk>;
}
//# sourceMappingURL=heroku-mia-agent.d.ts.map