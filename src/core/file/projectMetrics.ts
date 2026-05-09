import { flattenStructure, projectEdges, projectStructure } from './projectStructure'

export interface ProjectMetric {
  label: string
  value: string
  helper: string
}

const flattenedStructure = flattenStructure(projectStructure)

const folderCount = flattenedStructure.filter((node) => node.kind === 'folder').length
const fileCount = flattenedStructure.filter((node) => node.kind === 'file').length

export const projectMetrics: ProjectMetric[] = [
  {
    label: 'Nodes',
    value: String(flattenedStructure.length),
    helper: 'All folders and files in the current snapshot',
  },
  {
    label: 'Folders',
    value: String(folderCount),
    helper: 'Structural containers that organize the app',
  },
  {
    label: 'Files',
    value: String(fileCount),
    helper: 'Concrete implementation units detected so far',
  },
  {
    label: 'Edges',
    value: String(projectEdges.length),
    helper: 'Known relationships between application layers',
  },
]
