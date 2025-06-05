import { Embeddings } from "@langchain/core/embeddings";
import { getHerokuConfigOptionsWithEnvKeys, HerokuApiError } from "./common.js";
/**
 * **HerokuMiaEmbeddings** - Heroku Managed Inference Embeddings Integration
 *
 * A LangChain-compatible embeddings class that interfaces with Heroku's Managed Inference API
 * for generating text embeddings. This class provides access to various embedding models
 * hosted on Heroku's infrastructure, supporting both single query embedding and batch
 * document embedding operations with automatic retry logic and proper error handling.
 *
 * The class supports different input types (search queries, documents, classification, clustering),
 * encoding formats, and embedding types to match your specific use case requirements.
 *
 * @example
 * ```typescript
 * import { HerokuMiaEmbeddings } from "heroku-langchain";
 *
 * // Basic usage
 * const embeddings = new HerokuMiaEmbeddings({
 *   model: "cohere-embed-multilingual",
 *   apiKey: process.env.EMBEDDING_KEY,
 *   apiUrl: process.env.EMBEDDING_URL
 * });
 *
 * // Embed a single query
 * const queryEmbedding = await embeddings.embedQuery("What is Heroku?");
 * console.log("Query embedding dimensions:", queryEmbedding.length);
 *
 * // Embed multiple documents
 * const docEmbeddings = await embeddings.embedDocuments([
 *   "Heroku is a cloud platform that enables companies to build, run, and operate applications entirely in the cloud.",
 *   "Heroku supports several programming languages including Ruby, Node.js, Python, Java, and more."
 * ]);
 * console.log("Document embeddings:", docEmbeddings.length);
 * ```
 *
 * @example
 * ```typescript
 * // Advanced usage with specific options
 * const embeddings = new HerokuMiaEmbeddings({
 *   model: "cohere-embed-multilingual",
 *   maxRetries: 3,
 *   timeout: 30000, // 30 seconds
 *   additionalKwargs: {
 *     encoding_format: "base64",
 *     embedding_type: "float"
 *   }
 * });
 *
 * // Embed with specific input type for search
 * const searchEmbedding = await embeddings.embedQuery(
 *   "machine learning algorithms",
 *   { input_type: "search_query" }
 * );
 *
 * // Embed documents for indexing
 * const documents = [
 *   "Introduction to machine learning and its applications",
 *   "Deep learning neural networks explained",
 *   "Natural language processing with transformers"
 * ];
 *
 * const documentEmbeddings = await embeddings.embedDocuments(documents, {
 *   input_type: "search_document",
 *   truncate: "END"
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Error handling and validation
 * try {
 *   const embeddings = new HerokuMiaEmbeddings({
 *     model: "cohere-embed-multilingual"
 *   });
 *
 *   // This will throw an error due to input constraints
 *   const tooManyDocs = new Array(100).fill("Sample document");
 *   await embeddings.embedDocuments(tooManyDocs);
 * } catch (error) {
 *   if (error instanceof Error) {
 *     console.error("Validation error:", error.message);
 *   }
 * }
 * ```
 *
 * @see {@link HerokuMiaEmbeddingsFields} for constructor options
 * @see {@link HerokuMiaEmbeddingsCallOptions} for runtime call options
 * @see [Heroku Embeddings API Documentation](https://devcenter.heroku.com/articles/heroku-inference-api-v1-embeddings)
 */
export class HerokuMiaEmbeddings extends Embeddings {
    // Fields to store constructor parameters
    model;
    apiKey;
    apiUrl;
    maxRetries;
    timeout;
    additionalKwargs;
    /**
     * Creates a new HerokuMiaEmbeddings instance.
     *
     * @param fields - Optional configuration options for the Heroku embeddings model
     * @throws {Error} When model ID is not provided and EMBEDDING_MODEL_ID environment variable is not set
     *
     * @example
     * ```typescript
     * // Basic usage with defaults
     * const embeddings = new HerokuMiaEmbeddings();
     *
     * // With custom configuration
     * const embeddings = new HerokuMiaEmbeddings({
     *   model: "cohere-embed-multilingual",
     *   apiKey: "your-embedding-api-key",
     *   apiUrl: "https://us.inference.heroku.com",
     *   maxRetries: 3,
     *   timeout: 30000
     * });
     * ```
     */
    constructor(fields) {
        super(fields ?? {});
        const modelFromEnv = typeof process !== "undefined" &&
            process.env &&
            process.env.EMBEDDING_MODEL_ID;
        this.model = fields?.model || modelFromEnv || "";
        if (!this.model) {
            throw new Error("Heroku embeddings model ID not found. Please set it in the constructor, " +
                "or set the EMBEDDING_MODEL_ID environment variable.");
        }
        this.apiKey = fields?.apiKey;
        this.apiUrl = fields?.apiUrl;
        this.maxRetries = fields?.maxRetries ?? 2;
        this.timeout = fields?.timeout;
        this.additionalKwargs = fields?.additionalKwargs ?? {};
    }
    /**
     * Get the model name for identification.
     * @returns The string "HerokuMiaEmbeddings"
     */
    get lc_name() {
        return "HerokuMiaEmbeddings";
    }
    /**
     * Get additional parameters for serialization.
     * @returns true to indicate this class is serializable
     */
    get lc_serializable() {
        return true;
    }
    /**
     * Get the parameters used to invoke the embeddings model.
     *
     * This method combines constructor parameters with runtime options to create
     * the final request parameters for the Heroku Embeddings API.
     *
     * @param options - Optional runtime parameters that override constructor defaults
     * @returns Combined parameters for the embeddings API request (excluding input)
     *
     * @internal
     */
    invocationParams(options) {
        const constructorParams = {
            model: this.model,
            ...this.additionalKwargs,
        };
        let runtimeParams = {};
        if (options) {
            if (options.model !== undefined)
                runtimeParams.model = options.model;
            if (options.input_type !== undefined)
                runtimeParams.input_type = options.input_type;
            if (options.encoding_format !== undefined)
                runtimeParams.encoding_format = options.encoding_format;
            if (options.embedding_type !== undefined)
                runtimeParams.embedding_type = options.embedding_type;
            if (options.truncate !== undefined)
                runtimeParams.truncate = options.truncate;
            if (options.additionalKwargs) {
                runtimeParams = { ...runtimeParams, ...options.additionalKwargs };
            }
        }
        return { ...constructorParams, ...runtimeParams };
    }
    /**
     * Validates input constraints for Heroku embeddings API.
     *
     * The Heroku embeddings API has specific limitations that this method enforces:
     * - Maximum 96 strings per request
     * - Maximum 2048 characters per string
     *
     * @param texts - Array of strings to validate
     * @throws {Error} When input exceeds API constraints
     *
     * @internal
     */
    validateInput(texts) {
        if (texts.length > 96) {
            throw new Error(`Heroku embeddings API supports maximum 96 strings per request. Received ${texts.length} strings.`);
        }
        for (let i = 0; i < texts.length; i++) {
            if (texts[i].length > 2048) {
                throw new Error(`String at index ${i} exceeds maximum length of 2048 characters. Received ${texts[i].length} characters.`);
            }
        }
    }
    /**
     * Makes a request to the Heroku embeddings API with retry logic.
     *
     * This method handles the actual HTTP request to the Heroku API, including:
     * - Automatic retries for transient failures (5xx errors, 429 rate limits)
     * - Exponential backoff with jitter
     * - Proper error handling and reporting
     * - Timeout management
     *
     * @param requestPayload - The complete request payload for the embeddings API
     * @returns Promise resolving to the embeddings API response
     * @throws {HerokuApiError} For API errors or network failures
     *
     * @internal
     */
    async makeRequest(requestPayload) {
        const herokuConfig = getHerokuConfigOptionsWithEnvKeys(this.apiKey, this.apiUrl, "/v1/embeddings", "EMBEDDING_KEY", "EMBEDDING_URL");
        let response;
        let attempt = 0;
        const maxRetries = this.maxRetries;
        let lastError;
        while (attempt <= maxRetries) {
            try {
                const controller = new AbortController();
                const timeoutId = this.timeout
                    ? setTimeout(() => controller.abort(), this.timeout)
                    : null;
                response = await fetch(herokuConfig.apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${herokuConfig.apiKey}`,
                    },
                    body: JSON.stringify(requestPayload),
                    signal: controller.signal,
                });
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                if (!response.ok) {
                    const errorText = await response.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    }
                    catch {
                        errorData = { message: errorText };
                    }
                    // Enhanced error message for better debugging
                    const errorMessage = `Heroku embeddings API error: ${response.status} ${response.statusText}`;
                    const detailedMessage = errorData.error?.message || errorData.message || errorText;
                    const error = new HerokuApiError(`${errorMessage}\nDetails: ${detailedMessage}`, response.status, errorData);
                    throw error;
                }
                const data = await response.json();
                return data;
            }
            catch (error) {
                lastError = error;
                // Check if this is a retryable error
                const isRetryable = error instanceof HerokuApiError &&
                    error.status &&
                    (error.status >= 500 || error.status === 429);
                if (!isRetryable || attempt >= maxRetries) {
                    throw error;
                }
                // Exponential backoff with jitter
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                const jitter = Math.random() * 0.1 * delay;
                await new Promise((resolve) => setTimeout(resolve, delay + jitter));
                attempt++;
            }
        }
        throw lastError;
    }
    /**
     * Embeds a single text query.
     *
     * This method is optimized for embedding search queries and single pieces of text.
     * It automatically sets the input_type to "search_query" unless overridden in options.
     *
     * @param text - The text to embed
     * @param options - Optional call-time parameters to customize the embedding request
     * @returns Promise resolving to an array of numbers representing the embedding vector
     *
     * @example
     * ```typescript
     * const embeddings = new HerokuMiaEmbeddings({ model: "cohere-embed-multilingual" });
     *
     * // Basic query embedding
     * const queryVector = await embeddings.embedQuery("machine learning algorithms");
     * console.log("Embedding dimensions:", queryVector.length);
     *
     * // With custom options
     * const customQueryVector = await embeddings.embedQuery(
     *   "natural language processing",
     *   {
     *     input_type: "classification",
     *     encoding_format: "base64"
     *   }
     * );
     * ```
     *
     * @throws {Error} When the text exceeds 2048 characters
     * @throws {HerokuApiError} For API-related errors
     */
    async embedQuery(text, options) {
        const embeddings = await this.embedDocuments([text], {
            ...options,
            input_type: options?.input_type ?? "search_query",
        });
        return embeddings[0];
    }
    /**
     * Embeds multiple documents.
     *
     * This method is optimized for embedding multiple documents for indexing or similarity search.
     * It automatically sets the input_type to "search_document" unless overridden in options.
     * Input validation ensures compliance with API constraints before making any network calls.
     *
     * @param documents - Array of text documents to embed (max 96 documents, 2048 chars each)
     * @param options - Optional call-time parameters to customize the embedding request
     * @returns Promise resolving to an array of embedding vectors, one per input document
     *
     * @example
     * ```typescript
     * const embeddings = new HerokuMiaEmbeddings({ model: "openai-text-embedding-3-large" });
     *
     * const documents = [
     *   "Heroku is a cloud platform for building and running applications.",
     *   "LangChain is a framework for developing applications powered by language models.",
     *   "Vector databases enable semantic search and similarity matching."
     * ];
     *
     * // Basic document embedding
     * const documentVectors = await embeddings.embedDocuments(documents);
     * console.log(`Generated ${documentVectors.length} embeddings`);
     *
     * // With custom options for clustering
     * const clusteringVectors = await embeddings.embedDocuments(documents, {
     *   input_type: "clustering",
     *   embedding_type: "int8",
     *   truncate: "START"
     * });
     * ```
     *
     * @throws {Error} When input exceeds API constraints (>96 documents or >2048 chars per document)
     * @throws {HerokuApiError} For API-related errors
     */
    async embedDocuments(documents, options) {
        // Validate input constraints immediately to avoid network calls for invalid input
        this.validateInput(documents);
        // Use the inherited AsyncCaller to support callbacks
        return this.caller.call(async () => {
            return this._embedDocuments(documents, options);
        });
    }
    /**
     * Internal method to embed documents.
     *
     * This method performs the actual embedding work after validation has been completed
     * in the public embedDocuments method. It constructs the API request and processes the response.
     *
     * @param documents - Array of validated text documents to embed
     * @param options - Optional call-time parameters
     * @returns Promise resolving to an array of embedding vectors
     *
     * @internal
     */
    async _embedDocuments(documents, options) {
        // Input is already validated in embedDocuments method
        const params = this.invocationParams(options);
        const requestPayload = {
            model: params.model || this.model,
            input: documents,
            input_type: options?.input_type ?? "search_document",
            ...params,
        };
        // Remove undefined values
        Object.keys(requestPayload).forEach((key) => requestPayload[key] === undefined &&
            delete requestPayload[key]);
        const response = await this.makeRequest(requestPayload);
        return response.data.map((item) => item.embedding);
    }
}
//# sourceMappingURL=heroku-mia-embeddings.js.map