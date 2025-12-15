Ultrathink. 

The user flow that I want to implement is: 
1. When the user clicks on add column, the tool should take the serialized prompt from @fluffy-viz/src/components/spreadsheet/PromptComposer.tsx and make LLM call using it programmatically by hydrating it with the corresponding values from each of the rows. 
2. The list of providers that we want to support is available here @fluffy-viz/src/components/ai-provider-config-demo.tsx. Of these, we do not have to worry about `Novita`, or `LocalLLM`. Apart from the major providers OpenAI, Anthropic, Google AI, Mistral, Cohere, I want to use HuggingFace to support all other inferences. 
3. We are looking at a scaffolding that supports these providers either directly or indirectly (like HuggingFace). I want the simple and elegant way to create a provider factory. Should we use Lanchain.js or should we use ai sdk by vercel or is something else better for our use case?

Use agents to search the web. User the context7 MCP to understand the task. 

Given the flow I want to implement look at the plan here and critique it, I don't want a overly complicated plan that would make implementing stuff later a challenge. 

Note that downstream we would also be using these providers to compute embeddings to create indices. 

