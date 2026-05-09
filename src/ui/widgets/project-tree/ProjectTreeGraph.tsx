import { Badge, Empty, Tag, Tree, Typography } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { ProjectFilters, ProjectFolderNode, ProjectTreeNode } from '../../../core/file/projectTypes'
import { FILE_TYPE_LABEL_RU } from '../../locale/ru'

interface ProjectTreeGraphProps {
  snapshot: ProjectFolderNode
  filters: ProjectFilters
  selectedFileId?: string | null
  onSelectFile?: (fileId: string | null) => void
}

function matchesSearch(node: ProjectTreeNode, search: string): boolean {
  if (!search) {
    return true
  }

  return node.path.toLowerCase().includes(search) || node.name.toLowerCase().includes(search)
}

function matchesLayer(node: ProjectTreeNode, selectedLayers: ProjectFilters['layers']): boolean {
  return selectedLayers.length === 0 || selectedLayers.includes(node.layer)
}

function matchesType(node: ProjectTreeNode, selectedTypes: ProjectFilters['types']): boolean {
  if (node.kind !== 'file') {
    return true
  }

  return selectedTypes.length === 0 || selectedTypes.includes(node.fileType)
}

function filterNode(node: ProjectTreeNode, filters: ProjectFilters): ProjectTreeNode | null {
  const searchValue = filters.search.trim().toLowerCase()
  const selfMatches = matchesSearch(node, searchValue) && matchesLayer(node, filters.layers) && matchesType(node, filters.types)

  if (node.kind === 'file') {
    return selfMatches ? node : null
  }

  const filteredChildren = node.children
    .map((child) => filterNode(child, filters))
    .filter((child): child is ProjectTreeNode => child !== null)

  if (selfMatches || filteredChildren.length > 0) {
    return {
      ...node,
      children: filteredChildren,
    }
  }

  return null
}

function findNodeInTree(root: ProjectTreeNode, id: string): ProjectTreeNode | null {
  if (root.id === id) {
    return root
  }
  if (root.kind === 'file') {
    return null
  }
  for (const child of root.children) {
    const found = findNodeInTree(child, id)
    if (found) {
      return found
    }
  }
  return null
}

function toTreeData(node: ProjectTreeNode, searchValue: string): DataNode {
  const isMatched = matchesSearch(node, searchValue)
  const importCount = node.kind === 'file' ? node.imports.length : 0

  return {
    key: node.id,
    title: (
      <span className={isMatched ? 'tree-node tree-node--match' : 'tree-node'}>
        <span className="tree-node__name">{node.name}</span>
        <span className="tree-node__meta">
          <Tag color="magenta">{node.layer}</Tag>
          {node.kind === 'file' ? <Tag color="volcano">{FILE_TYPE_LABEL_RU[node.fileType]}</Tag> : null}
          {node.kind === 'file' ? (
            <Badge
              count={importCount}
              size="small"
              showZero
              className="tree-node__import-badge"
              title="Исходящие import в файле"
              color="rgba(24, 144, 255, 0.85)"
            />
          ) : null}
        </span>
      </span>
    ),
    children: node.kind === 'file' ? undefined : node.children.map((child) => toTreeData(child, searchValue)),
  }
}

export function ProjectTreeGraph({ snapshot, filters, selectedFileId = null, onSelectFile }: ProjectTreeGraphProps) {
  const filteredTree = filterNode(snapshot, filters)

  if (!filteredTree) {
    return <Empty description="Нет узлов дерева под текущие фильтры." />
  }

  const searchLower = filters.search.trim().toLowerCase()

  return (
    <div className="project-tree-graph">
      <Typography.Text className="tree-caption">
        Папки видны, если внутри есть совпадения по фильтру. У файлов — число исходящих import; клик открывает панель: исходящие и входящие import, ссылки по проекту.
      </Typography.Text>
      <Tree
        blockNode
        defaultExpandAll
        showLine
        selectedKeys={selectedFileId ? [selectedFileId] : []}
        onSelect={(_keys, info) => {
          if (!onSelectFile) {
            return
          }
          const key = String(info.node.key)
          const found = findNodeInTree(filteredTree, key)
          if (found?.kind === 'file') {
            onSelectFile(found.id === selectedFileId ? null : found.id)
          }
        }}
        treeData={[toTreeData(filteredTree, searchLower)]}
      />
    </div>
  )
}
