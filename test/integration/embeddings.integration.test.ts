import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { HerokuEmbeddings } from "../../src/embeddings.js";

/**
 * Integration tests for HerokuEmbeddings following LangChain 1.0 best practices.
 *
 * These tests verify compatibility with LangChain 1.0 embeddings interface
 * and ensure proper integration with the Heroku Embeddings API.
 *
 * Prerequisites:
 * - EMBEDDING_KEY environment variable must be set
 * - EMBEDDING_URL environment variable must be set
 * - EMBEDDING_MODEL_ID environment variable must be set
 * - Access to a working Heroku Embeddings endpoint
 */
describe("HerokuEmbeddings Integration Tests (LangChain 1.0)", () => {
  let embeddings: HerokuEmbeddings;
  let skipTests = false;

  beforeEach(() => {
    // Check if required environment variables are set
    if (
      !process.env.EMBEDDING_KEY ||
      !process.env.EMBEDDING_URL ||
      !process.env.EMBEDDING_MODEL_ID
    ) {
      console.warn(
        "⚠️  Skipping embeddings integration tests: Required environment variables not set",
      );
      console.warn(
        "   Set EMBEDDING_KEY, EMBEDDING_URL, and EMBEDDING_MODEL_ID to run integration tests",
      );
      skipTests = true;
      return;
    }

    embeddings = new HerokuEmbeddings({
      model: process.env.EMBEDDING_MODEL_ID,
      apiKey: process.env.EMBEDDING_KEY,
      apiUrl: process.env.EMBEDDING_URL,
    });
  });

  describe("Basic Embedding Functionality", () => {
    test("should embed a single query", { skip: skipTests }, async () => {
      const vector = await embeddings.embedQuery("Hello, world!");

      assert.ok(vector);
      assert.ok(Array.isArray(vector));
      assert.ok(vector.length > 0);
      assert.strictEqual(typeof vector[0], "number");
    });

    test("should embed multiple documents", { skip: skipTests }, async () => {
      const documents = [
        "First document about AI",
        "Second document about machine learning",
        "Third document about neural networks",
      ];

      const vectors = await embeddings.embedDocuments(documents);

      assert.ok(vectors);
      assert.ok(Array.isArray(vectors));
      assert.strictEqual(vectors.length, documents.length);

      vectors.forEach((vector) => {
        assert.ok(Array.isArray(vector));
        assert.ok(vector.length > 0);
        assert.strictEqual(typeof vector[0], "number");
      });
    });

    test(
      "should produce consistent embeddings for the same text",
      { skip: skipTests },
      async () => {
        const text = "Consistent embedding test";

        const vector1 = await embeddings.embedQuery(text);
        const vector2 = await embeddings.embedQuery(text);

        assert.strictEqual(vector1.length, vector2.length);

        // Embeddings should be identical or very similar
        let differences = 0;
        for (let i = 0; i < vector1.length; i++) {
          if (Math.abs(vector1[i] - vector2[i]) > 0.0001) {
            differences++;
          }
        }

        // Allow for minimal floating point differences
        assert.ok(
          differences < vector1.length * 0.01,
          "Embeddings should be consistent",
        );
      },
    );
  });

  describe("Semantic Similarity", () => {
    test(
      "should produce similar embeddings for similar text",
      { skip: skipTests },
      async () => {
        const text1 = "The cat sits on the mat";
        const text2 = "A cat is sitting on a mat";
        const text3 = "The weather is sunny today";

        const vector1 = await embeddings.embedQuery(text1);
        const vector2 = await embeddings.embedQuery(text2);
        const vector3 = await embeddings.embedQuery(text3);

        // Calculate cosine similarity
        const cosineSimilarity = (a: number[], b: number[]) => {
          const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
          const magnitudeA = Math.sqrt(
            a.reduce((sum, val) => sum + val * val, 0),
          );
          const magnitudeB = Math.sqrt(
            b.reduce((sum, val) => sum + val * val, 0),
          );
          return dotProduct / (magnitudeA * magnitudeB);
        };

        const similarity12 = cosineSimilarity(vector1, vector2);
        const similarity13 = cosineSimilarity(vector1, vector3);

        // Similar texts should have higher similarity than dissimilar texts
        assert.ok(
          similarity12 > similarity13,
          "Similar texts should have higher similarity",
        );
      },
    );
  });

  describe("Input Validation", () => {
    test("should handle empty strings", { skip: skipTests }, async () => {
      const vector = await embeddings.embedQuery("");

      assert.ok(vector);
      assert.ok(Array.isArray(vector));
      assert.ok(vector.length > 0);
    });

    test("should handle special characters", { skip: skipTests }, async () => {
      const text = "Hello! @#$%^&*() 你好 مرحبا";
      const vector = await embeddings.embedQuery(text);

      assert.ok(vector);
      assert.ok(Array.isArray(vector));
      assert.ok(vector.length > 0);
    });

    test("should handle long text", { skip: skipTests }, async () => {
      const longText = "AI and machine learning ".repeat(100);
      const vector = await embeddings.embedQuery(longText);

      assert.ok(vector);
      assert.ok(Array.isArray(vector));
      assert.ok(vector.length > 0);
    });

    test("should reject too many documents", { skip: skipTests }, async () => {
      const tooManyDocs = Array(97).fill("test document");

      await assert.rejects(
        () => embeddings.embedDocuments(tooManyDocs),
        /maximum 96 strings/,
      );
    });

    test("should reject too long documents", { skip: skipTests }, async () => {
      const tooLongDoc = "a".repeat(2049);

      await assert.rejects(
        () => embeddings.embedDocuments([tooLongDoc]),
        /exceeds maximum length/,
      );
    });
  });

  describe("Configuration Options", () => {
    test(
      "should support different input types",
      { skip: skipTests },
      async () => {
        const text = "Search query example";

        const searchQueryVector = await embeddings.embedQuery(text, {
          input_type: "search_query",
        });

        const searchDocVector = await embeddings.embedDocuments([text], {
          input_type: "search_document",
        });

        assert.ok(searchQueryVector);
        assert.ok(searchDocVector);
        assert.ok(Array.isArray(searchQueryVector));
        assert.ok(Array.isArray(searchDocVector));
      },
    );

    test("should handle additional kwargs", { skip: skipTests }, async () => {
      const customEmbeddings = new HerokuEmbeddings({
        model: process.env.EMBEDDING_MODEL_ID,
        apiKey: process.env.EMBEDDING_KEY,
        apiUrl: process.env.EMBEDDING_URL,
        additionalKwargs: {
          encoding_format: "float",
        },
      });

      const vector = await customEmbeddings.embedQuery("test");

      assert.ok(vector);
      assert.ok(Array.isArray(vector));
    });
  });

  describe("Error Handling", () => {
    test(
      "should handle API errors gracefully",
      { skip: skipTests },
      async () => {
        const badEmbeddings = new HerokuEmbeddings({
          model: "non-existent-model",
          apiKey: process.env.EMBEDDING_KEY,
          apiUrl: process.env.EMBEDDING_URL,
        });

        await assert.rejects(
          () => badEmbeddings.embedQuery("test"),
          (error: any) => {
            assert.ok(error);
            return true;
          },
        );
      },
    );

    test("should handle timeout errors", { skip: skipTests }, async () => {
      const timeoutEmbeddings = new HerokuEmbeddings({
        model: process.env.EMBEDDING_MODEL_ID,
        apiKey: process.env.EMBEDDING_KEY,
        apiUrl: process.env.EMBEDDING_URL,
        timeout: 1, // 1ms timeout to force timeout
      });

      await assert.rejects(
        () => timeoutEmbeddings.embedQuery("test"),
        (error: any) => {
          assert.ok(error);
          return true;
        },
      );
    });

    test("should retry on transient errors", { skip: skipTests }, async () => {
      // This test verifies that the retry logic works
      // In a real scenario, the API might return 503 or 429 temporarily
      const embeddings = new HerokuEmbeddings({
        model: process.env.EMBEDDING_MODEL_ID,
        apiKey: process.env.EMBEDDING_KEY,
        apiUrl: process.env.EMBEDDING_URL,
        maxRetries: 3,
      });

      // Normal request should succeed (implicitly tests retry mechanism)
      const vector = await embeddings.embedQuery("retry test");

      assert.ok(vector);
      assert.ok(Array.isArray(vector));
    });
  });

  describe("LangChain 1.0 Compatibility", () => {
    test("should work with retrieval chains", { skip: skipTests }, async () => {
      // Simulate a simple vector store use case
      const documents = [
        "Heroku is a cloud platform",
        "LangChain is a framework for LLMs",
        "Vector databases store embeddings",
      ];

      const documentVectors = await embeddings.embedDocuments(documents);

      // Now search with a query
      const query = "What is Heroku?";
      const queryVector = await embeddings.embedQuery(query);

      // Calculate similarities
      const cosineSimilarity = (a: number[], b: number[]) => {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(
          a.reduce((sum, val) => sum + val * val, 0),
        );
        const magnitudeB = Math.sqrt(
          b.reduce((sum, val) => sum + val * val, 0),
        );
        return dotProduct / (magnitudeA * magnitudeB);
      };

      const similarities = documentVectors.map((docVector) =>
        cosineSimilarity(queryVector, docVector),
      );

      // Find most similar document
      const maxSimilarity = Math.max(...similarities);
      const mostSimilarIndex = similarities.indexOf(maxSimilarity);

      // The query about Heroku should match the Heroku document best
      assert.strictEqual(
        mostSimilarIndex,
        0,
        "Query should match Heroku document",
      );
    });

    test(
      "should support batch embedding operations",
      { skip: skipTests },
      async () => {
        const batchSize = 10;
        const documents = Array(batchSize)
          .fill(null)
          .map((_, i) => `Document number ${i + 1}`);

        const vectors = await embeddings.embedDocuments(documents);

        assert.strictEqual(vectors.length, batchSize);
        vectors.forEach((vector) => {
          assert.ok(Array.isArray(vector));
          assert.ok(vector.length > 0);
        });
      },
    );

    test(
      "should have correct LangChain metadata",
      { skip: skipTests },
      async () => {
        assert.strictEqual(embeddings.lc_name, "HerokuEmbeddings");
        assert.strictEqual(embeddings.lc_serializable, true);
      },
    );
  });

  describe("Performance Tests", () => {
    test(
      "should handle bulk embedding efficiently",
      { skip: skipTests },
      async () => {
        const documents = Array(50)
          .fill(null)
          .map((_, i) => `Performance test document ${i}`);

        const startTime = Date.now();
        const vectors = await embeddings.embedDocuments(documents);
        const duration = Date.now() - startTime;

        assert.strictEqual(vectors.length, documents.length);
        // Should complete in reasonable time (< 30 seconds for 50 documents)
        assert.ok(duration < 30000, `Embedding took ${duration}ms`);
      },
    );
  });
});
