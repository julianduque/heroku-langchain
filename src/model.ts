import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { HerokuApiError } from "./common.js";

export interface HerokuBaseFields extends BaseChatModelParams {
  model?: string;
  temperature?: number;
  stop?: string[];
  topP?: number;
  apiKey?: string;
  apiUrl?: string;
  maxRetries?: number;
  timeout?: number;
  streaming?: boolean;
  /** Optional alias used by some callers */
  stream?: boolean;
  additionalKwargs?: Record<string, any>;
}

/**
 * Base class with common Heroku model behavior.
 * Subclasses should implement API-specific request building and parsing.
 */
export abstract class HerokuModel<
  CallOptions extends BaseChatModelCallOptions,
> extends BaseChatModel<CallOptions> {
  /** Actual model ID used when calling Heroku APIs */
  protected resolvedModelId: string;
  /** Public/alias model name exposed to LangChain (can differ from actual ID) */
  protected model: string;
  protected temperature?: number;
  protected stop?: string[];
  protected topP?: number;
  protected apiKey?: string;
  protected apiUrl?: string;
  protected maxRetries?: number;
  protected timeout?: number;
  protected streaming?: boolean;
  protected additionalKwargs?: Record<string, any>;

  constructor(fields?: HerokuBaseFields) {
    super(fields ?? {});
    const modelFromEnv =
      typeof process !== "undefined" &&
      (process as any)?.env &&
      (process as any).env.INFERENCE_MODEL_ID;

    const resolvedModel = fields?.model || modelFromEnv || "";
    if (!resolvedModel) {
      throw new Error(
        "Heroku model ID not found. Please set it in the constructor, or set the INFERENCE_MODEL_ID environment variable.",
      );
    }
    this.resolvedModelId = resolvedModel;
    this.model = resolvedModel;

    this.temperature = fields?.temperature ?? 1.0;
    this.stop = fields?.stop;
    this.topP = fields?.topP ?? 0.999;
    this.apiKey = fields?.apiKey;
    this.apiUrl = fields?.apiUrl;
    this.maxRetries = fields?.maxRetries ?? 2;
    this.timeout = fields?.timeout;
    // Respect both streaming and stream aliases
    this.streaming = fields?.streaming ?? fields?.stream ?? false;
    this.additionalKwargs = fields?.additionalKwargs ?? {};
  }

  /** Remove undefined keys to keep payloads clean */
  protected cleanUndefined<T extends Record<string, any>>(obj: T): T {
    Object.keys(obj).forEach(
      (key) => (obj as any)[key] === undefined && delete (obj as any)[key],
    );
    return obj;
  }

  /** Standard headers for Heroku API calls */
  protected buildHeaders(apiKey: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }

  /** POST JSON with retries, timeout, and consistent error wrapping. */
  protected async postWithRetries(
    url: string,
    apiKey: string,
    body: Record<string, any>,
  ): Promise<Response> {
    const maxRetries = this.maxRetries ?? 2;
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= maxRetries) {
      try {
        const abortController = new AbortController();
        let timeoutId: NodeJS.Timeout | undefined;
        if (this.timeout) {
          timeoutId = setTimeout(() => abortController.abort(), this.timeout);
        }

        const response = await fetch(url, {
          method: "POST",
          headers: this.buildHeaders(apiKey),
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (response.ok) {
          return response;
        }

        if (response.status >= 400 && response.status < 500) {
          const errorData = await response
            .json()
            .catch(() => ({ message: response.statusText }));
          throw new HerokuApiError(
            `Heroku API request failed with status ${response.status}: ${errorData.message || response.statusText}`,
            response.status,
            errorData,
          );
        }

        lastError = new HerokuApiError(
          `Heroku API request failed with status ${response.status}: ${response.statusText}`,
          response.status,
        );
      } catch (err: any) {
        lastError = err;
      }

      attempt++;
      if (attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (lastError instanceof HerokuApiError) throw lastError;
    throw new HerokuApiError(
      `Heroku API request failed after ${maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`,
      undefined,
      lastError,
    );
  }

  protected getModelForRequest(): string {
    return this.resolvedModelId;
  }
}
