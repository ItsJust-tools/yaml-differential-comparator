# YAML Differential Comparator

Compare two YAML documents by their **parsed data structures**, not their raw text. Formatting differences, key order and quoting style never produce false differences — only real changes in the data are reported.

**Live:** [yaml-differential-comparator.itsjust.tools](https://yaml-differential-comparator.itsjust.tools)

## Features

- Paste or upload two YAML documents side by side
- Parse both documents and diff the resulting data structures, not raw text
- Added, removed and changed keys shown with old → new values
- Options to ignore list order and to compare arrays as multisets — reordered arrays then compare equal
- Dot-notation paths (e.g. `services.web.image`) for quick copying into scripts and issue reports
- YAML syntax validation with line-accurate error messages for each input
- Swap left and right inputs with one click
- Copyable summary report of all differences
- Sortable difference list by path, type, old or new value
- JSON export of the comparison result
- 100% client-side — no data ever leaves your browser

## Example

Given these two documents:

```yaml
# left
services:
  web:
    image: nginx:1.25
```

```yaml
# right
services:
  web:
    image: nginx:1.27
    healthcheck: /health
```

The tool reports:

```text
~ services.web.image: "nginx:1.25" → "nginx:1.27"
+ services.web.healthcheck = "/health"
```

Invalid YAML shows a line-accurate error for the offending input instead of a crash, e.g. `Line 2: unexpected end of the stream within a flow collection`.

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t yaml-differential-comparator .
docker run -p 3000:3000 yaml-differential-comparator
```

## License

MIT
