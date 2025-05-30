import { BaseChatModel, BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { BaseMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Runnable } from "@langchain/core/runnables";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { HerokuMiaFields, HerokuMiaCallOptions } from "./types.js";
interface StructuredOutputMethodOptions<IncludeRaw extends boolean = false> {
    name?: string;
    description?: string;
    method?: "functionCalling" | "jsonMode";
    includeRaw?: IncludeRaw;
}
export declare class HerokuMia extends BaseChatModel<HerokuMiaCallOptions> {
    protected model: string;
    protected temperature?: number;
    protected maxTokens?: number;
    protected stop?: string[];
    protected topP?: number;
    protected apiKey?: string;
    protected apiUrl?: string;
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
    /**
     * Create a version of this chat model that returns structured output.
     * @param outputSchema The schema for the structured output (Zod schema or JSON schema)
     * @param config Configuration options for structured output
     * @returns A new runnable that returns structured output
     */
    withStructuredOutput<RunOutput extends Record<string, any> = Record<string, any>>(outputSchema: z.ZodType<RunOutput> | Record<string, any>, config?: StructuredOutputMethodOptions<false>): Runnable<BaseLanguageModelInput, RunOutput>;
    withStructuredOutput<RunOutput extends Record<string, any> = Record<string, any>>(outputSchema: z.ZodType<RunOutput> | Record<string, any>, config?: StructuredOutputMethodOptions<true>): Runnable<BaseLanguageModelInput, {
        raw: BaseMessage;
        parsed: RunOutput;
    }>;
    /**
     * Helper method to check if input is a Zod schema
     */
    private isZodSchema;
    /**
     * Helper method to check if input is StructuredOutputMethodParams
     */
    private isStructuredOutputMethodParams;
}
export {};
