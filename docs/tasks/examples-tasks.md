# Library Examples Implementation

Brief description of the feature and its purpose.

Provide example usage for `HerokuMia` and `HerokuMiaAgent` classes as demonstrated in `SPECS.md` and other common use cases.

## Completed Tasks

- [x] Created `docs/tasks/examples-tasks.md`
- [x] Create `examples` directory (implicitly by creating files within it).
- [x] Create `examples/heroku-mia-chat-example.ts` with example from SPECS.md (Section 2.1.1).
- [x] Create `examples/heroku-mia-agent-example.ts` with example from SPECS.md (Section 3.1.1).
- [x] Ensured examples are runnable by adding necessary imports, basic setup, and fixing related type definitions in `src/types.ts`.
- [x] Create `examples/heroku-mia-chat-structured-output.ts` (Zod schema for output).
- [x] Create `examples/heroku-mia-chat-lcel-prompt.ts` (LCEL with prompt template and output parser).
- [x] Create `examples/heroku-mia-chat-custom-tool.ts` (using a custom Node.js function as a tool).

## In Progress Tasks

(None currently)

## Future Tasks

- [ ] Add more examples for specific features (e.g., specific agent event handling for HerokuMiaAgent).
- [ ] Add instructions on how to run the examples (e.g., `tsx examples/heroku-mia-chat-example.ts`).
- [ ] Review and refine tool definition and input parsing in the custom tool example.

## Implementation Plan

Extract code snippets from `SPECS.md` and place them into individual `.ts` files within an `examples` directory. Create additional examples for common LangChain patterns. Ensure basic imports and setup are included to make the examples runnable or easily adaptable.

## Relevant files

- `SPECS.md` - Source of initial example code.
- `examples/heroku-mia-chat-example.ts` - Example for HerokuMia.
- `examples/heroku-mia-agent-example.ts` - Example for HerokuMiaAgent.
- `examples/heroku-mia-chat-structured-output.ts` - HerokuMia with Zod structured output.
- `examples/heroku-mia-chat-lcel-prompt.ts` - HerokuMia with LCEL, prompt, and parser.
- `examples/heroku-mia-chat-custom-tool.ts` - HerokuMia with a custom tool.
- `src/types.ts` - Updated to support example code.
- `package.json` - Updated with `zod` dependency for structured output example.
