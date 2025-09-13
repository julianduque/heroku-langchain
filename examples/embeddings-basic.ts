import { HerokuEmbeddings } from "../src";

async function main() {
  const embeddings = new HerokuEmbeddings({
    model: "cohere-embed-multilingual",
  });

  // Single query
  const queryEmbedding = await embeddings.embedQuery("What is Heroku?");
  console.log("Query embedding dims:", queryEmbedding.length);

  // Multiple documents
  const docs = [
    "Heroku is a cloud platform as a service (PaaS)",
    "It supports multiple programming languages",
  ];
  const docEmbeddings = await embeddings.embedDocuments(docs);
  console.log("Docs embeddings count:", docEmbeddings.length);
}

main().catch(console.error);
