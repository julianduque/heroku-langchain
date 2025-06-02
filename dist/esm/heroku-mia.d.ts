import { BaseChatModel, BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { BaseMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Runnable } from "@langchain/core/runnables";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { HerokuMiaFields, HerokuMiaCallOptions } from "./types.js";
/**
 * Configuration options for the structured output method.
 *
 * @public
 * @interface StructuredOutputMethodOptions
 * @template IncludeRaw - Whether to include raw response alongside parsed output
 */
export interface StructuredOutputMethodOptions<IncludeRaw extends boolean = false> {
    /** Optional name for the structured output function */
    name?: string;
    /** Optional description for the structured output function */
    description?: string;
    /** Method to use for structured output - either function calling or JSON mode */
    method?: "functionCalling" | "jsonMode";
    /** Whether to include the raw response alongside the parsed output */
    includeRaw?: IncludeRaw;
}
/**
 * Parameters for configuring structured output with schema and options.
 *
 * @public
 * @interface StructuredOutputMethodParams
 * @template RunOutput - The expected output type from the structured response
 * @template IncludeRaw - Whether to include raw response alongside parsed output
 */
export interface StructuredOutputMethodParams<RunOutput extends Record<string, any> = Record<string, any>, IncludeRaw extends boolean = false> {
    /** The Zod schema or JSON schema object defining the expected output structure */
    schema: z.ZodType<RunOutput> | Record<string, any>;
    /** Optional name for the structured output function */
    name?: string;
    /** Optional description for the structured output function */
    description?: string;
    /** Method to use for structured output - either function calling or JSON mode */
    method?: "functionCalling" | "jsonMode";
    /** Whether to include the raw response alongside the parsed output */
    includeRaw?: IncludeRaw;
}
/**
 * **HerokuMia** - Heroku Managed Inference API LangChain Integration
 *
 * A LangChain-compatible chat model that interfaces with Heroku's Managed Inference API (Mia).
 * This class provides access to various language models hosted on Heroku's infrastructure,
 * including support for function calling, structured outputs, and streaming responses.
 *
 * @example
 * ```typescript
 * import { HerokuMia } from "heroku-langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 *
 * // Basic usage
 * const model = new HerokuMia({
 *   model: "claude-3-7-sonnet",
 *   temperature: 0.7,
 *   apiKey: process.env.INFERENCE_KEY,
 *   apiUrl: process.env.INFERENCE_URL
 * });
 *
 * const response = await model.invoke([
 *   new HumanMessage("Explain quantum computing in simple terms")
 * ]);
 * console.log(response.content);
 * ```
 *
 * @example
 * ```typescript
 * // With function calling
 * import { DynamicStructuredTool } from "@langchain/core/tools";
 * import { z } from "zod";
 *
 * const weatherTool = new DynamicStructuredTool({
 *   name: "get_weather",
 *   description: "Get current weather for a location",
 *   schema: z.object({
 *     location: z.string().describe("City name")
 *   }),
 *   func: async ({ location }) => `Weather in ${location}: Sunny, 22°C`
 * });
 *
 * const modelWithTools = model.bindTools([weatherTool]);
 * const result = await modelWithTools.invoke([
 *   new HumanMessage("What's the weather in Paris?")
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // With structured output
 * const extractionSchema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 *   occupation: z.string()
 * });
 *
 * const structuredModel = model.withStructuredOutput(extractionSchema);
 * const extracted = await structuredModel.invoke([
 *   new HumanMessage("John is a 30-year-old software engineer")
 * ]);
 * console.log(extracted); // { name: "John", age: 30, occupation: "software engineer" }
 * ```
 *
 * @example
 * ```typescript
 * // Streaming responses
 * const stream = await model.stream([
 *   new HumanMessage("Write a story about a robot")
 * ]);
 *
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.content);
 * }
 * ```
 *
 * @see {@link HerokuMiaFields} for constructor options
 * @see {@link HerokuMiaCallOptions} for runtime call options
 * @see [Heroku Managed Inference API Documentation](https://devcenter.heroku.com/articles/heroku-inference-api-v1-chat-completions)
 */
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
    /**
     * Returns the LangChain identifier for this model class.
     * @returns The string "HerokuMia"
     */
    static lc_name(): string;
    /**
     * Creates a new HerokuMia instance.
     *
     * @param fields - Configuration options for the Heroku Mia model
     * @throws {Error} When model ID is not provided and INFERENCE_MODEL_ID environment variable is not set
     *
     * @example
     * ```typescript
     * const model = new HerokuMia({
     *   model: "claude-3-7-sonnet",
     *   temperature: 0.7,
     *   maxTokens: 1000,
     *   apiKey: "your-api-key",
     *   apiUrl: "https://us.inference.heroku.com"
     * });
     * ```
     */
    constructor(fields: HerokuMiaFields);
    /**
     * Returns the LLM type identifier for this model.
     * @returns The string "heroku-mia"
     */
    _llmType(): string;
    /**
     * Bind tools to this chat model for function calling capabilities.
     *
     * This method creates a new instance of HerokuMia with the specified tools pre-bound,
     * enabling the model to call functions during conversations. The tools will be
     * automatically included in all subsequent calls to the model.
     *
     * @param tools - A list of StructuredTool instances or tool definitions to bind to the model
     * @returns A new HerokuMia instance with the tools bound and tool_choice set to "auto"
     *
     * @example
     * ```typescript
     * import { DynamicStructuredTool } from "@langchain/core/tools";
     * import { z } from "zod";
     *
     * const calculatorTool = new DynamicStructuredTool({
     *   name: "calculator",
     *   description: "Perform basic arithmetic operations",
     *   schema: z.object({
     *     operation: z.enum(["add", "subtract", "multiply", "divide"]),
     *     a: z.number(),
     *     b: z.number()
     *   }),
     *   func: async ({ operation, a, b }) => {
     *     switch (operation) {
     *       case "add": return `${a + b}`;
     *       case "subtract": return `${a - b}`;
     *       case "multiply": return `${a * b}`;
     *       case "divide": return `${a / b}`;
     *     }
     *   }
     * });
     *
     * const modelWithTools = model.bindTools([calculatorTool]);
     * const result = await modelWithTools.invoke([
     *   new HumanMessage("What is 15 * 7?")
     * ]);
     * ```
     */
    bindTools(tools: (StructuredTool | Record<string, any>)[]): HerokuMia;
    /**
     * Get the parameters used to invoke the model.
     *
     * This method combines constructor parameters with runtime options to create
     * the final request parameters for the Heroku API. Runtime options take
     * precedence over constructor parameters.
     *
     * @param options - Optional runtime parameters that override constructor defaults
     * @returns Combined parameters for the API request
     *
     * @internal
     */
    invocationParams(options?: Partial<HerokuMiaCallOptions>): Omit<HerokuMiaFields, keyof BaseChatModelParams> & {
        [key: string]: any;
    };
    _generate(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): Promise<ChatResult>;
    _stream(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): AsyncGenerator<AIMessageChunk>;
    /**
     * Create a version of this chat model that returns structured output.
     *
     * This method enables the model to return responses that conform to a specific schema,
     * using function calling under the hood. The model is instructed to call a special
     * "extraction" function with the structured data as arguments.
     *
     * @template RunOutput - The type of the structured output
     * @param outputSchema - The schema for the structured output (Zod schema or JSON schema)
     * @param config - Configuration options for structured output
     * @returns A new runnable that returns structured output
     *
     * @example
     * ```typescript
     * import { z } from "zod";
     *
     * // Define the schema for extracted data
     * const personSchema = z.object({
     *   name: z.string().describe("The person's full name"),
     *   age: z.number().describe("The person's age in years"),
     *   occupation: z.string().describe("The person's job or profession"),
     *   skills: z.array(z.string()).describe("List of skills or expertise")
     * });
     *
     * // Create a model that returns structured output
     * const extractionModel = model.withStructuredOutput(personSchema, {
     *   name: "extract_person_info",
     *   description: "Extract structured information about a person"
     * });
     *
     * // Use the model
     * const result = await extractionModel.invoke([
     *   new HumanMessage("Sarah Johnson is a 28-year-old data scientist who specializes in machine learning, Python, and statistical analysis.")
     * ]);
     *
     * console.log(result);
     * // Output: {
     * //   name: "Sarah Johnson",
     * //   age: 28,
     * //   occupation: "data scientist",
     * //   skills: ["machine learning", "Python", "statistical analysis"]
     * // }
     * ```
     *
     * @example
     * ```typescript
     * // With includeRaw option to get both raw and parsed responses
     * const extractionModelWithRaw = model.withStructuredOutput(personSchema, {
     *   includeRaw: true
     * });
     *
     * const result = await extractionModelWithRaw.invoke([
     *   new HumanMessage("John is a 35-year-old teacher.")
     * ]);
     *
     * console.log(result.parsed); // { name: "John", age: 35, occupation: "teacher", skills: [] }
     * console.log(result.raw);    // Original AIMessage with tool calls
     * ```
     *
     * @throws {Error} When method is set to "jsonMode" (not supported)
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
//# sourceMappingURL=heroku-mia.d.ts.map