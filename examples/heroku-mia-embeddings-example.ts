import { HerokuMiaEmbeddings } from "../src";
/**
 * Example demonstrating how to use HerokuMiaEmbeddings for text embeddings.
 *
 * This example shows:
 * 1. Basic configuration
 * 2. Single query embedding
 * 3. Multiple document embeddings
 * 4. Using different input types
 */

async function main() {
  console.log("🚀 HerokuMiaEmbeddings Example");
  console.log("===============================\n");

  // Initialize the embeddings model
  const embeddings = new HerokuMiaEmbeddings({
    model: "cohere-embed-multilingual",
  });

  try {
    console.log("1. Single Query Embedding");
    console.log("--------------------------");

    const query = "What is Heroku?";
    console.log(`Query: "${query}"`);

    const queryEmbedding = await embeddings.embedQuery(query, {
      input_type: "search_query", // Optimize for query use case
    });

    console.log(`Embedding dimensions: ${queryEmbedding.length}`);
    console.log(
      `First 5 values: [${queryEmbedding
        .slice(0, 5)
        .map((n) => n.toFixed(4))
        .join(", ")}]\n`,
    );

    console.log("2. Multiple Document Embeddings");
    console.log("--------------------------------");

    const documents = [
      "Heroku is a cloud platform as a service (PaaS)",
      "It supports multiple programming languages like Node.js, Python, and Ruby",
      "Heroku makes it easy to deploy, manage, and scale applications",
      "The platform handles infrastructure so developers can focus on code",
    ];

    console.log(`Documents to embed: ${documents.length}`);
    documents.forEach((doc, i) => console.log(`  ${i + 1}. "${doc}"`));

    const docEmbeddings = await embeddings.embedDocuments(documents, {
      input_type: "search_document", // Optimize for document use case
    });

    console.log(`\nEmbeddings generated: ${docEmbeddings.length}`);
    console.log(`Each embedding has ${docEmbeddings[0].length} dimensions`);

    // Calculate similarity between query and documents
    console.log("\n3. Similarity Calculation");
    console.log("--------------------------");

    const similarities = docEmbeddings.map((docEmb, i) => {
      const similarity = cosineSimilarity(queryEmbedding, docEmb);
      return { index: i, document: documents[i], similarity };
    });

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);

    console.log("Most similar documents to the query:");
    similarities.forEach((item, rank) => {
      console.log(
        `  ${rank + 1}. (${item.similarity.toFixed(4)}) "${item.document}"`,
      );
    });
  } catch (error) {
    console.error("Error:", error.message);

    if (error.message.includes("API key not found")) {
      console.log("\n💡 Tip: Set your API credentials:");
      console.log("  export EMBEDDING_KEY=your-api-key");
      console.log("  export EMBEDDING_URL=your-api-url");
      console.log("  export EMBEDDING_MODEL_ID=your-model-id");
    }
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Run the example
main().catch(console.error);
