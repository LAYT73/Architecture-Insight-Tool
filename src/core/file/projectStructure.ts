export type ProjectNodeKind = 'project' | 'folder' | 'file'

export interface ProjectStructureNode {
  name: string
  kind: ProjectNodeKind
  layer?: string
  children?: ProjectStructureNode[]
}

export interface ProjectEdge {
  from: string
  to: string
}

export const projectStructure: ProjectStructureNode = {
  name: 'architecture-insight-tool',
  kind: 'project',
  layer: 'root',
  children: [
    {
      name: 'src',
      kind: 'folder',
      layer: 'app',
      children: [
        { name: 'App.tsx', kind: 'file', layer: 'app' },
        { name: 'main.tsx', kind: 'file', layer: 'app' },
        {
          name: 'core',
          kind: 'folder',
          layer: 'core',
          children: [
            { name: 'file', kind: 'folder', layer: 'core' },
            { name: 'hooks', kind: 'folder', layer: 'core' },
          ],
        },
        {
          name: 'ui',
          kind: 'folder',
          layer: 'ui',
          children: [
            { name: 'components', kind: 'folder', layer: 'ui' },
            { name: 'pages', kind: 'folder', layer: 'ui' },
            { name: 'widgets', kind: 'folder', layer: 'ui' },
          ],
        },
      ],
    },
    { name: 'public', kind: 'folder', layer: 'static' },
    { name: 'package.json', kind: 'file', layer: 'root' },
    { name: 'vite.config.ts', kind: 'file', layer: 'root' },
  ],
}

export const projectEdges: ProjectEdge[] = [
  { from: 'src/main.tsx', to: 'src/App.tsx' },
  { from: 'src/App.tsx', to: 'src/ui/pages/home/HomePage.tsx' },
  { from: 'src/ui/pages/home/HomePage.tsx', to: 'src/ui/widgets/project-tree/ProjectTreeGraph.tsx' },
  { from: 'src/ui/pages/home/HomePage.tsx', to: 'src/core/file/projectStructure.ts' },
]

export function flattenStructure(node: ProjectStructureNode, parentPath = ''): Array<ProjectStructureNode & { path: string }> {
  const path = parentPath ? `${parentPath}/${node.name}` : node.name
  const flattenedChildren = node.children?.flatMap((child) => flattenStructure(child, path)) ?? []

  return [{ ...node, path }, ...flattenedChildren]
}
