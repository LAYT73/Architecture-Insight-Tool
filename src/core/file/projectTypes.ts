export type ProjectNodeKind = 'project' | 'folder' | 'file'

export type ProjectLayer =
  | 'app'
  | 'pages'
  | 'widgets'
  | 'features'
  | 'entities'
  | 'shared'
  | 'processes'
  | 'core'
  | 'ui'
  | 'root'
  | 'unknown'

export type ProjectFileType = 'source' | 'style' | 'markup' | 'data' | 'doc' | 'asset' | 'other'

export interface ProjectNodeBase {
  id: string
  name: string
  path: string
  kind: ProjectNodeKind
  layer: ProjectLayer
}

export interface ProjectFolderNode extends ProjectNodeBase {
  kind: 'folder' | 'project'
  children: ProjectTreeNode[]
}

export interface ProjectFileNode extends ProjectNodeBase {
  kind: 'file'
  extension: string
  fileType: ProjectFileType
  imports: string[]
}

export type ProjectTreeNode = ProjectFolderNode | ProjectFileNode

export interface ProjectEdge {
  id: string
  from: string
  to: string
  fromLayer: ProjectLayer
  toLayer: ProjectLayer
  isViolation: boolean
  /** Raw import specifier from source (when resolved to a project file). */
  specifier?: string
}

export type FsdWarningKind = 'missing_slice_index' | 'deep_cross_slice_import'

export interface ProjectFsdWarning {
  id: string
  kind: FsdWarningKind
  severity: 'warning' | 'info'
  message: string
  path: string
  relatedPath?: string
  detail?: string
  /** Module specifier as written in the importer file (deep import warnings). */
  specifier?: string
  /** Trimmed source line at `codeLineNumber` in `relatedPath`. */
  codeLine?: string
  codeLineNumber?: number
}

export interface ProjectSnapshot {
  rootName: string
  rootPath: string
  tree: ProjectFolderNode
  nodes: ProjectTreeNode[]
  edges: ProjectEdge[]
  layers: ProjectLayer[]
  fileTypes: ProjectFileType[]
  violationsCount: number
  fileCount: number
  folderCount: number
  fsdWarnings: ProjectFsdWarning[]
}

export interface ProjectFilters {
  search: string
  layers: ProjectLayer[]
  types: ProjectFileType[]
  violationsOnly: boolean
}
