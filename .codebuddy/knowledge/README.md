# Knowledge Directory

Place `.md` files here to inject domain-specific knowledge into Code Buddy's context.

## Frontmatter fields

```yaml
---
title: "Short descriptive title"
tags: ["tag1", "tag2"]
scope: "project"       # project | global
priority: 1            # lower = higher priority
---
```

Files with lower `priority` values are injected first (higher precedence).
