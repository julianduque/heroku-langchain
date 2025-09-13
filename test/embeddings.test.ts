import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { HerokuEmbeddings } from "../src/embeddings.js";

describe("HerokuEmbeddings", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Backup environment variables
    originalEnv = {
      EMBEDDING_MODEL_ID: process.env.EMBEDDING_MODEL_ID,
      EMBEDDING_KEY: process.env.EMBEDDING_KEY,
      EMBEDDING_URL: process.env.EMBEDDING_URL,
    };

    // Set test environment variables
    process.env.EMBEDDING_MODEL_ID = "test-embed-model";
    process.env.EMBEDDING_KEY = "test-embed-key";
    process.env.EMBEDDING_URL = "https://test-embed.url";
  });

  afterEach(() => {
    // Restore original environment variables
    process.env.EMBEDDING_MODEL_ID = originalEnv.EMBEDDING_MODEL_ID;
    process.env.EMBEDDING_KEY = originalEnv.EMBEDDING_KEY;
    process.env.EMBEDDING_URL = originalEnv.EMBEDDING_URL;
  });

  it("should throw error when no model is provided", () => {
    assert.throws(() => {
      // Clear the environment variable temporarily
      const original = process.env.EMBEDDING_MODEL_ID;
      delete process.env.EMBEDDING_MODEL_ID;
      try {
        new HerokuEmbeddings();
      } finally {
        if (original) {
          process.env.EMBEDDING_MODEL_ID = original;
        }
      }
    }, /Heroku embeddings model ID not found/);
  });

  it("should create instance with model", () => {
    const embeddings = new HerokuEmbeddings({
      model: "cohere-embed-multilingual",
    });
    assert.ok(embeddings);
  });

  it("should have correct lc_name", () => {
    const embeddings = new HerokuEmbeddings({
      model: "cohere-embed-multilingual",
    });
    assert.strictEqual(embeddings.lc_name, "HerokuEmbeddings");
  });

  it("should validate input constraints", () => {
    const embeddings = new HerokuEmbeddings({
      model: "cohere-embed-multilingual",
    });

    // Test maximum number of strings
    const tooManyStrings = Array(97).fill("test");
    assert.throws(
      () => (embeddings as any).validateInput(tooManyStrings),
      /maximum 96 strings per request/,
    );

    // Test maximum string length
    const tooLongString = "a".repeat(2049);
    assert.throws(
      () => (embeddings as any).validateInput([tooLongString]),
      /exceeds maximum length of 2048 characters/,
    );
  });

  it("should use environment variables for model", () => {
    const original = process.env.EMBEDDING_MODEL_ID;
    process.env.EMBEDDING_MODEL_ID = "test-model";
    try {
      const embeddings = new HerokuEmbeddings();
      assert.ok(embeddings);
    } finally {
      if (original) {
        process.env.EMBEDDING_MODEL_ID = original;
      } else {
        delete process.env.EMBEDDING_MODEL_ID;
      }
    }
  });

  it("should have correct lc_serializable", () => {
    const embeddings = new HerokuEmbeddings({
      model: "cohere-embed-multilingual",
    });
    assert.strictEqual(embeddings.lc_serializable, true);
  });

  // New tests for optional constructor
  describe("Optional Constructor", () => {
    it("should create instance without any parameters when environment variables are set", () => {
      const embeddings = new HerokuEmbeddings();

      assert.ok(embeddings);
      assert.strictEqual(embeddings.lc_name, "HerokuEmbeddings");
    });

    it("should throw error when no parameters and no environment variables", () => {
      // Backup current env vars
      const backupModelId = process.env.EMBEDDING_MODEL_ID;

      try {
        delete process.env.EMBEDDING_MODEL_ID;

        assert.throws(
          () => new HerokuEmbeddings(),
          /Heroku embeddings model ID not found/,
        );
      } finally {
        // Restore env vars
        if (backupModelId) {
          process.env.EMBEDDING_MODEL_ID = backupModelId;
        }
      }
    });

    it("should prioritize constructor parameters over environment variables", () => {
      const customModel = "custom-embed-model";
      const embeddings = new HerokuEmbeddings({ model: customModel });

      assert.ok(embeddings);
      // We can verify the model is used by checking the invocation params
      const params = (embeddings as any).invocationParams();
      assert.strictEqual(params.model, customModel);
    });

    it("should use environment variables when constructor parameters are undefined", () => {
      const envModel = process.env.EMBEDDING_MODEL_ID;
      const embeddings = new HerokuEmbeddings();

      const params = (embeddings as any).invocationParams();
      assert.strictEqual(params.model, envModel);
    });

    it("should handle mixed parameter sources correctly", () => {
      const customMaxRetries = 5;
      const customAdditionalKwargs = { encoding_format: "base64" };

      const embeddings = new HerokuEmbeddings({
        maxRetries: customMaxRetries,
        additionalKwargs: customAdditionalKwargs,
      });

      assert.ok(embeddings);
      const params = (embeddings as any).invocationParams();
      // Should use environment model but custom parameters
      assert.strictEqual(params.model, process.env.EMBEDDING_MODEL_ID);
      assert.strictEqual(params.encoding_format, "base64");
    });

    it("should support all constructor parameters being optional", () => {
      // Test that all parameter combinations work
      assert.doesNotThrow(() => {
        new HerokuEmbeddings();
        new HerokuEmbeddings({});
        new HerokuEmbeddings({ model: "custom-model" });
        new HerokuEmbeddings({ maxRetries: 3 });
        new HerokuEmbeddings({ timeout: 10000 });
        new HerokuEmbeddings({
          additionalKwargs: { input_type: "search_query" },
        });
      });
    });
  });
});
