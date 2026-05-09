import { sortTreeNode, compareLayers } from './projectAnalysis'
import { computeFsdWarnings } from './projectFsdAnalysis'
import type { ProjectFolderNode, ProjectSnapshot, ProjectTreeNode } from './projectTypes'

function flattenNodes(node: ProjectTreeNode): ProjectTreeNode[] {
  return [node, ...(node.kind === 'file' ? [] : node.children.flatMap((child) => flattenNodes(child)))]
}

function createSampleTree(): ProjectFolderNode {
  return sortTreeNode({
    id: 'architecture-insight-tool',
    name: 'architecture-insight-tool',
    path: 'architecture-insight-tool',
    kind: 'project',
    layer: 'root',
    children: [
      {
        id: 'architecture-insight-tool/src',
        name: 'src',
        path: 'architecture-insight-tool/src',
        kind: 'folder',
        layer: 'app',
        children: [
          { id: 'architecture-insight-tool/src/App.tsx', name: 'App.tsx', path: 'architecture-insight-tool/src/App.tsx', kind: 'file', layer: 'app', extension: 'tsx', fileType: 'source', imports: [] },
          { id: 'architecture-insight-tool/src/main.tsx', name: 'main.tsx', path: 'architecture-insight-tool/src/main.tsx', kind: 'file', layer: 'app', extension: 'tsx', fileType: 'source', imports: ['./App'] },
          {
            id: 'architecture-insight-tool/src/core',
            name: 'core',
            path: 'architecture-insight-tool/src/core',
            kind: 'folder',
            layer: 'core',
            children: [
              { id: 'architecture-insight-tool/src/core/file', name: 'file', path: 'architecture-insight-tool/src/core/file', kind: 'folder', layer: 'core', children: [] },
              { id: 'architecture-insight-tool/src/core/hooks', name: 'hooks', path: 'architecture-insight-tool/src/core/hooks', kind: 'folder', layer: 'core', children: [] },
            ],
          },
          {
            id: 'architecture-insight-tool/src/ui',
            name: 'ui',
            path: 'architecture-insight-tool/src/ui',
            kind: 'folder',
            layer: 'ui',
            children: [
              { id: 'architecture-insight-tool/src/ui/components', name: 'components', path: 'architecture-insight-tool/src/ui/components', kind: 'folder', layer: 'ui', children: [] },
              { id: 'architecture-insight-tool/src/ui/pages', name: 'pages', path: 'architecture-insight-tool/src/ui/pages', kind: 'folder', layer: 'pages', children: [] },
              { id: 'architecture-insight-tool/src/ui/widgets', name: 'widgets', path: 'architecture-insight-tool/src/ui/widgets', kind: 'folder', layer: 'widgets', children: [] },
            ],
          },
        ],
      },
      { id: 'architecture-insight-tool/public', name: 'public', path: 'architecture-insight-tool/public', kind: 'folder', layer: 'root', children: [] },
      { id: 'architecture-insight-tool/package.json', name: 'package.json', path: 'architecture-insight-tool/package.json', kind: 'file', layer: 'root', extension: 'json', fileType: 'data', imports: [] },
      { id: 'architecture-insight-tool/vite.config.ts', name: 'vite.config.ts', path: 'architecture-insight-tool/vite.config.ts', kind: 'file', layer: 'root', extension: 'ts', fileType: 'source', imports: [] },
    ],
  })
}

export function createSampleSnapshot(): ProjectSnapshot {
  const tree = createSampleTree()
  const flattenedNodes = flattenNodes(tree)
  const folderCount = flattenedNodes.filter((node) => node.kind !== 'file').length
  const fileCount = flattenedNodes.filter((node) => node.kind === 'file').length
  const fileTypes = [...new Set(flattenedNodes.filter((node) => node.kind === 'file').map((node) => node.fileType))]

  const snapshotBase: ProjectSnapshot = {
    rootName: tree.name,
    rootPath: tree.path,
    tree,
    nodes: flattenedNodes,
    edges: [
      {
        id: 'architecture-insight-tool/src/main.tsx -> architecture-insight-tool/src/App.tsx',
        from: 'architecture-insight-tool/src/main.tsx',
        to: 'architecture-insight-tool/src/App.tsx',
        fromLayer: 'app',
        toLayer: 'app',
        isViolation: false,
        specifier: './App',
      },
    ],
    layers: [...new Set(flattenedNodes.map((node) => node.layer))].sort(compareLayers),
    fileTypes,
    violationsCount: 0,
    fileCount,
    folderCount,
    fsdWarnings: [],
  }

  return {
    ...snapshotBase,
    fsdWarnings: computeFsdWarnings(snapshotBase, new Map()),
  }
}
