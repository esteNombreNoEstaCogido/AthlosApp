---
name: token-efficiency
description: "Use when you need to compress code context before sending it to an agent. Minify selected code, remove irrelevant comments, drop unused imports, trim whitespace, and keep the logic intact while reducing token usage."
argument-hint: Which file or code block should be compressed?
---

# Token Efficiency Compression

Use this skill to make selected code much cheaper to send to another agent without changing behavior.

## When to use
- Large files or snippets with verbose comments and extra whitespace.
- You need to pass only the essential logic to a downstream agent.
- You want a compact preview for review, debugging, refactoring, or summarization.

## Workflow
1. Identify the exact code slice to compress.
2. Keep only the relevant logic, function, class, or module section.
3. Remove comments that do not explain intent or behavior.
4. Drop unused imports, dead code, and obvious noise.
5. Collapse whitespace and blank lines while preserving structure.
6. Preserve control flow, variable semantics, and public behavior.
7. Return a compact version plus a brief note on what changed.

## Quality bar
- No logic changes.
- No syntax errors.
- The remaining code still communicates intent clearly.
- The output is meaningfully smaller than the original input.

## Compression checklist
- [ ] Remove irrelevant comments.
- [ ] Remove unused imports and unused local helpers.
- [ ] Collapse repeated blank lines and extra indentation.
- [ ] Keep names that carry meaning.
- [ ] Preserve guards, conditions, and return values.
- [ ] Avoid changing APIs or external behavior.

## Helper script
Run the built-in helper on a file:

```bash
node .github/skills/token-efficiency/scripts/minify-context.js path/to/file.js
```

The script applies safe heuristics:
- removes block and line comments,
- trims blank lines and repeated whitespace,
- removes unused import statements when possible.

## Prompt template
Use this compact instruction when sending code to another agent:

```text
Compress this code for agent input. Preserve logic and behavior. Remove irrelevant comments, unused imports, dead code, and excessive whitespace. Keep only the essential semantics needed for review or refactoring. Return:
1. compact code
2. one-line summary
3. risky changes note if any
```

## Output format
- Compact code block
- Short summary of intent
- Optional bullet list of what was removed

## Example usage
- "Compress this React component before sending it to the agent."
- "Minify this utility file while preserving behavior."
- "Reduce the token cost of this selected code block."
