import { BaseChatModel, BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { BaseMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { StructuredTool } from "@langchain/core/tools";
import { HerokuMiaFields, HerokuMiaCallOptions } from "./types";
export declare class HerokuMia extends BaseChatModel<HerokuMiaCallOptions> {
    protected model: string;
    protected temperature?: number;
    protected maxTokens?: number;
    protected stop?: string[];
    protected topP?: number;
    protected herokuApiKey?: string;
    protected herokuApiUrl?: string;
    protected maxRetries?: number;
    protected timeout?: number;
    protected streaming?: boolean;
    protected additionalKwargs?: Record<string, any>;
    static lc_name(): string;
    constructor(fields: HerokuMiaFields);
    _llmType(): string;
    /**
     * Bind tools to this chat model.
     * @param tools A list of tools to bind to the model.
     * @returns A new instance of this chat model with the tools bound.
     */
    bindTools(tools: (StructuredTool | Record<string, any>)[]): HerokuMia;
    /**
     * Get the parameters used to invoke the model.
     */
    invocationParams(options?: Partial<HerokuMiaCallOptions>): Omit<HerokuMiaFields, keyof BaseChatModelParams> & {
        [key: string]: any;
    };
    _generate(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): Promise<ChatResult>;
    _stream(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): AsyncGenerator<AIMessageChunk>;
}
