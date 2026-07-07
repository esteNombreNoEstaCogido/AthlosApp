# Token-efficient code compression template

Use this template when you need to reduce the token cost of a selected code block before sending it to an agent.

## Input
- Target file or code block:
- Purpose:
- Constraints:

## Output
```text
1. Compact code
2. One-line summary
3. Notes on removed noise
```

## Compression instructions
- Keep logic intact.
- Remove irrelevant comments.
- Remove unused imports.
- Remove dead code and blank lines.
- Preserve variable names when they carry meaning.
- Do not alter behavior or public API.
