---
inclusion: auto
---

# PR Review Comments

When addressing PR review comments:

1. After fixing the code that a review comment references, **resolve the comment** on GitHub using the GraphQL API:
   ```bash
   # Get node IDs for PR review comments
   gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments --jq '.[].node_id'
   
   # Resolve them
   gh api graphql -f query='mutation { minimizeComment(input: {subjectId: "NODE_ID", classifier: RESOLVED}) { minimizedComment { isMinimized } } }'
   ```

2. Multiple comments can be resolved in a single GraphQL mutation using aliases (`c1:`, `c2:`, etc.).

3. Never include AWS account numbers or other sensitive identifiers in any content that will be pushed to a public or soon-to-be-public repository — not in code, commit messages, PR descriptions, or issue bodies.
