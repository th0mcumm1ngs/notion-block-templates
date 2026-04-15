# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server — builds and hot-reloads into Raycast
npm run build    # production build (validates extension without publishing)
npm run lint     # lint
npm run fix-lint # lint with auto-fix
```

To recompile the Swift clipboard bridge after changes:
```bash
swiftc assets/clipboard-bridge.swift -o assets/clipboard-bridge
```

## Architecture

Single Raycast command (`src/index.tsx`) with two views:

- **Command (List)** — shows saved templates, search, paste/delete/new actions
- **NewTemplateForm (Form)** — name field + ⌘V action to capture clipboard

Templates are stored in Raycast `LocalStorage` as JSON under the key `"templates"`. Each record:
```typescript
{ id: string; name: string; clipboardData: string; preview: string }
```
`clipboardData` is a JSON string mapping pasteboard type identifiers → base64-encoded raw bytes (every format on the clipboard at capture time). `preview` is the plain text representation for display.

## Clipboard Bridge

`assets/clipboard-bridge` is a compiled Swift binary that reads/writes the macOS NSPasteboard directly. Raycast's JS `Clipboard` API only surfaces `text/html` and `text/plain`; the bridge captures all formats including Notion's internal block type.

```
./assets/clipboard-bridge read         → stdout: JSON { type: base64 }
./assets/clipboard-bridge write        → stdin:  JSON { type: base64 }
```

**Paste flow:** `writeAllClipboard()` → `closeMainWindow()` → 150ms delay → `osascript` CMD+V keystroke. This bypasses Raycast's clipboard API entirely and lets Notion receive its own internal format, producing native block rendering.

Requires Raycast to have **Accessibility permission** (System Settings → Privacy & Security → Accessibility) for the osascript keystroke to work.

The `.swift` source is kept alongside the binary. Recompile if the source changes.
