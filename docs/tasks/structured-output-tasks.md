# HerokuMia withStructuredOutput Implementation

Implementation of the `withStructuredOutput` method for the HerokuMia class to enable structured output functionality similar to other LangChain chat models.

## Completed Tasks

- [x] Added withStructuredOutput method to HerokuMia class
- [x] Implemented Zod schema to JSON schema conversion using zod-to-json-schema
- [x] Fixed tool schema conversion to bypass langchainToolsToHerokuTools for custom schemas
- [x] Resolved Heroku API rejection of $schema field in tool parameters
- [x] Added proper method overloads for includeRaw parameter support
- [x] Implemented function calling with forced tool choice for extract function
- [x] Added JsonOutputKeyToolsParser for structured output parsing
- [x] Tested and validated functionality with complex schemas (jokes, sentiment analysis)
- [x] Updated example to remove TODO comment indicating completion

## Implementation Details

The `withStructuredOutput` method creates a new HerokuMia instance with:

- Forced tool choice to ensure the model uses the "extract" function
- Proper JSON schema generation from Zod schemas (with $schema field removed)
- Direct tool schema passing to avoid issues with langchainToolsToHerokuTools
- Support for both Zod schemas and raw JSON schemas
- Proper handling of includeRaw parameter for returning both raw and parsed results

## Key Technical Fixes Applied

1. **Tool Schema Conversion**: Bypassed `langchainToolsToHerokuTools` for withStructuredOutput since it expects StructuredTool instances, not raw schemas
2. **$schema Field Removal**: Removed the $schema field from zod-to-json-schema output as Heroku API rejects it
3. **Forced Tool Choice**: Implemented proper tool_choice forcing to ensure model uses the extract function
4. **Method Overloads**: Added proper TypeScript overloads to support both includeRaw true/false scenarios

## Example Usage

```typescript
const llm = new HerokuMia({ temperature: 0.7 });

// Simple schema
const JokeSchema = z.object({
  setup: z.string().describe("The setup of the joke"),
  punchline: z.string().describe("The punchline of the joke"),
});

const structuredLLM = llm.withStructuredOutput(JokeSchema);
const result = await structuredLLM.invoke([
  new HumanMessage("Tell me a programming joke"),
]);
console.log(result.setup, result.punchline);
```

## Relevant Files

- src/heroku-mia.ts - Main implementation of withStructuredOutput method
- examples/heroku-mia-chat-structured-output.ts - Example demonstrating functionality
- package.json - Added zod-to-json-schema dependency
