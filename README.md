# Architecture Insight Tool

Architecture Insight Tool is a local project analyzer for React and TypeScript codebases. It lets you load a folder from disk and inspect the repository structure, import graph, file tree, and architectural layer violations in one place.

The app is focused on readability rather than code generation. It parses real files, resolves imports, groups nodes by layer, and shows the result through a project tree, a dependency graph, and a warnings panel. You can filter by search query, layer, file type, and violation-only mode.

## What it shows

- project stats such as files, folders, import links, and layer violations
- tree view of folders and files
- dependency graph with import directions and highlighted violations
- file import drawer for a selected node
- FSD warnings based on layer boundaries

## Run locally

```bash
npm install
npm run dev
```

Build the production bundle with:

```bash
npm run build
```

## Stack

React, TypeScript, Vite, Ant Design, React Flow, and dagre.

## Notes

The analyzer works best on source trees that contain real import statements and standard TypeScript path mappings. For large repositories, the graph may become dense, so filters are useful for narrowing the view.
