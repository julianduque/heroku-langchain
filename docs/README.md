# Heroku LangChain Documentation

This directory contains comprehensive documentation for the Heroku LangChain integration package.

## Documentation Structure

### API Documentation (`/api/`)

Auto-generated TypeScript API documentation created with TypeDoc from JSDoc comments and TypeScript types.

- **Access**: Open `api/index.html` in your browser
- **Contents**:
  - Complete API reference for all classes, interfaces, and types
  - Detailed method documentation with examples
  - Type definitions and parameter descriptions
  - Interactive navigation and search functionality

**Key Classes:**

- [`HerokuMia`](api/classes/HerokuMia.html) - Chat model for Heroku's Managed Inference API
- [`HerokuMiaAgent`](api/classes/HerokuMiaAgent.html) - Intelligent agent with tool execution
- [`HerokuMiaEmbeddings`](api/classes/HerokuMiaEmbeddings.html) - Text embeddings generation

### Specifications (`SPECS.md`)

Detailed technical specifications and implementation details for the Heroku Mia LangChain SDK.

### Task Documentation (`/tasks/`)

Development tasks, planning documents, and implementation notes.

## Building Documentation

To regenerate the API documentation:

```bash
# Install dependencies
pnpm install

# Build documentation
pnpm run build:docs
```

This will create updated documentation in the `docs/api/` directory based on the latest JSDoc comments and TypeScript definitions.

## Documentation Features

### JSDoc Comments

All classes, methods, and interfaces include comprehensive JSDoc documentation with:

- Detailed descriptions and usage examples
- Parameter and return type documentation
- Error handling information
- Related links and references

### TypeScript Integration

The documentation is generated directly from TypeScript source code, ensuring:

- Accurate type information
- Up-to-date interface definitions
- Proper inheritance relationships
- Complete API surface coverage

### Examples and Usage

Each major class includes practical examples showing:

- Basic usage patterns
- Advanced configuration options
- Error handling best practices
- Integration with LangChain ecosystem

## Quick Start

For quick reference, see the main package documentation:

- [Installation and basic usage](../README.md)
- [API Reference](api/index.html) - Complete TypeScript API docs
- [Examples](../examples/) - Working code examples

## Contributing to Documentation

When adding new features or modifying existing code:

1. **Add JSDoc comments** to all public methods and classes
2. **Include usage examples** in JSDoc comments
3. **Update type definitions** as needed
4. **Regenerate documentation** with `pnpm run build:docs`
5. **Verify examples work** with current codebase

### JSDoc Best Practices

- Use `@param` and `@returns` for all parameters and return values
- Include `@example` blocks for complex methods
- Use `@throws` to document error conditions
- Reference related types with `@see`
- Keep descriptions concise but comprehensive

---

_This documentation is automatically generated from TypeScript source code and JSDoc comments. Last updated: {current_date}_
