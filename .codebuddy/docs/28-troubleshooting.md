# Troubleshooting

## Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Module not found | Missing build step | Run `npm run build` |
| API key error | Missing env var | Set required API key in `.env` |
| Tests fail | Outdated deps | Run `npm install` |
| `GROK_API_KEY` not set | Missing environment variable | `export GROK_API_KEY=...` |

## Debug Mode

Run in development mode: `npm run dev`

Run tests: `npm test`

Check code quality: `npm run lint`


## Summary

**Troubleshooting** covers:
1. **Common Issues**
2. **Debug Mode**


---

**See also:** [Getting Started](./1-1-getting-started.md)


---
[← Previous: Testing](./27-testing.md)
