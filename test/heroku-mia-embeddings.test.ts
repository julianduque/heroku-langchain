import { describe, it } from "node:test";
import assert from "node:assert";
import { HerokuMiaEmbeddings } from "../src/heroku-mia-embeddings.js";

describe("HerokuMiaEmbeddings", () => {
  it("should throw error when no model is provided", () => {
    assert.throws(() => {
      // Clear the environment variable temporarily
      const original = process.env.EMBEDDING_MODEL_ID;
      delete process.env.EMBEDDING_MODEL_ID;
      try {
        new HerokuMiaEmbeddings();
      } finally {
        if (original) {
          process.env.EMBEDDING_MODEL_ID = original;
        }
      }
    }, /Heroku embeddings model ID not found/);
  });

  it("should create instance with model", () => {
    const embeddings = new HerokuMiaEmbeddings({
      model: "cohere-embed-multilingual",
    });
    assert.ok(embeddings);
  });

  it("should have correct lc_name", () => {
    const embeddings = new HerokuMiaEmbeddings({
      model: "cohere-embed-multilingual",
    });
    assert.strictEqual(embeddings.lc_name, "HerokuMiaEmbeddings");
  });

  it("should validate input constraints", () => {
    const embeddings = new HerokuMiaEmbeddings({
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
      const embeddings = new HerokuMiaEmbeddings();
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
    const embeddings = new HerokuMiaEmbeddings({
      model: "cohere-embed-multilingual",
    });
    assert.strictEqual(embeddings.lc_serializable, true);
  });
});
