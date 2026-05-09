import { Empty, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
// @ts-ignore - dagre has no types
import dagre from 'dagre'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { ProjectFilters, ProjectFileNode, ProjectLayer, ProjectSnapshot, ProjectTreeNode } from '../../../core/file/projectTypes'
import { FILE_TYPE_LABEL_RU } from '../../locale/ru'

const DAGRE_NODE_W = 220
const DAGRE_NODE_H = 108

const LAYER_COLORS: Record<ProjectLayer, string> = {
  app: '#1890ff',
  pages: '#faad14',
  processes: '#eb2f96',
  widgets: '#52c41a',
  features: '#13c2c2',
  entities: '#722ed1',
  shared: '#fa541c',
  root: '#8c8c8c',
  unknown: '#595959',
  core: '#177ddc',
  ui: '#ff85c0',
}

interface ProjectGraphViewProps {
  snapshot: ProjectSnapshot
  filters: ProjectFilters
  selectedFileId?: string | null
  onSelectFile?: (fileId: string | null) => void
}

function flattenTree(node: ProjectTreeNode): ProjectTreeNode[] {
  return [node, ...(node.kind === 'file' ? [] : node.children.flatMap((child) => flattenTree(child)))]
}

function matchesNode(node: ProjectFileNode, filters: ProjectFilters): boolean {
  const searchValue = filters.search.trim().toLowerCase()
  const matchesSearch = !searchValue || node.path.toLowerCase().includes(searchValue) || node.name.toLowerCase().includes(searchValue)
  const matchesLayer = filters.layers.length === 0 || filters.layers.includes(node.layer)
  const matchesType = filters.types.length === 0 || filters.types.includes(node.fileType)

  return matchesSearch && matchesLayer && matchesType
}

function computeGraphLayout(nodeIds: string[], edges: Array<{ from: string; to: string }>) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))

  g.setGraph({
    rankdir: 'LR',
    nodesep: 72,
    ranksep: 96,
    edgesep: 24,
    marginx: 48,
    marginy: 48,
    ranker: 'network-simplex',
  })

  for (const nodeId of nodeIds) {
    g.setNode(nodeId, { width: DAGRE_NODE_W, height: DAGRE_NODE_H })
  }

  for (const edge of edges) {
    g.setEdge(edge.from, edge.to)
  }

  dagre.layout(g)

  const positions: Record<string, { x: number; y: number }> = {}

  for (const nodeId of nodeIds) {
    const node = g.node(nodeId)

    if (node && typeof node.x === 'number' && typeof node.y === 'number') {
      positions[nodeId] = {
        x: node.x - DAGRE_NODE_W / 2,
        y: node.y - DAGRE_NODE_H / 2,
      }
    }
  }

  return positions
}

function FitViewOnLayout({ layoutKey }: { layoutKey: string }) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      fitView({ padding: 0.14, duration: 320, minZoom: 0.04, maxZoom: 1.35 })
    })
    return () => cancelAnimationFrame(handle)
  }, [fitView, layoutKey])

  return null
}

export function ProjectGraphView({ snapshot, filters, selectedFileId = null, onSelectFile }: ProjectGraphViewProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const focusId = hoveredNode ?? selectedFileId

  const visibleNodes = useMemo(() => {
    const treeNodes = flattenTree(snapshot.tree).filter((node): node is ProjectFileNode => node.kind === 'file')
    return treeNodes.filter((node) => matchesNode(node, filters) && (!filters.violationsOnly || snapshot.edges.some((edge) => edge.isViolation && (edge.from === node.id || edge.to === node.id))))
  }, [filters, snapshot])

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const visibleEdgesData = useMemo(
    () => snapshot.edges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to) && (!filters.violationsOnly || edge.isViolation)),
    [filters.violationsOnly, snapshot.edges, visibleNodeIds],
  )

  const layoutKey = useMemo(
    () => `${visibleNodes.map((n) => n.id).join('\0')}\0${visibleEdgesData.map((e) => e.id).join('\0')}`,
    [visibleNodes, visibleEdgesData],
  )

  const positions = useMemo(() => {
    const edgeList = visibleEdgesData.map((edge) => ({ from: edge.from, to: edge.to }))
    return computeGraphLayout(Array.from(visibleNodeIds), edgeList)
  }, [visibleNodeIds, visibleEdgesData])

  const isInFocusNeighborhood = useCallback(
    (nodeId: string) => {
      if (focusId === null) {
        return true
      }
      if (focusId === nodeId) {
        return true
      }
      return visibleEdgesData.some((e) => (e.from === focusId && e.to === nodeId) || (e.to === focusId && e.from === nodeId))
    },
    [focusId, visibleEdgesData],
  )

  const nodes = useMemo(() => {
    return visibleNodes.map((node) => {
      const pos = positions[node.id] || { x: 0, y: 0 }
      const layer = node.layer as ProjectLayer
      const borderColor = LAYER_COLORS[layer] || '#888'
      const active = isInFocusNeighborhood(node.id)
      const dim = focusId !== null && !active
      const importCount = node.imports.length

      return {
        id: node.id,
        position: pos,
        data: {
          label: (
            <div className="graph-node-content">
              <div className="graph-node-title">{node.name}</div>
              <div className="graph-node-path" title={node.path}>
                {node.path.includes('/') ? `…/${node.path.split('/').slice(-2).join('/')}` : node.path}
              </div>
              <div className="graph-node-meta">
                <span className="graph-node-layer" style={{ color: borderColor }}>
                  {layer}
                </span>
                <span className="graph-node-type">{FILE_TYPE_LABEL_RU[node.fileType]}</span>
                <span className="graph-node-imports" title="Исходящие import в этом файле">
                  ↳ {importCount}
                </span>
              </div>
            </div>
          ),
        },
        style: {
          border: `2px solid ${borderColor}`,
          borderRadius: '12px',
          background: dim ? 'rgba(21, 23, 28, 0.72)' : 'linear-gradient(165deg, rgba(28, 32, 40, 0.96) 0%, rgba(18, 20, 26, 0.94) 100%)',
          padding: '10px 12px',
          opacity: dim ? 0.38 : focusId === null ? 0.96 : 1,
          transition: 'opacity 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
          minWidth: `${DAGRE_NODE_W - 20}px`,
          maxWidth: `${DAGRE_NODE_W}px`,
          boxShadow:
            selectedFileId === node.id
              ? `0 0 0 2px rgba(255, 255, 255, 0.2), 0 12px 36px ${borderColor}55`
              : dim
                ? 'none'
                : `0 10px 28px rgba(0, 0, 0, 0.35)`,
        },
      }
    })
  }, [visibleNodes, positions, focusId, isInFocusNeighborhood, selectedFileId])

  const edges = useMemo(() => {
    return visibleEdgesData.map((edge) => {
      const incident = focusId === null || edge.from === focusId || edge.to === focusId
      const baseOpacity = focusId === null ? 0.74 : incident ? 0.92 : 0.5
      const stroke = edge.isViolation ? '#ff4d4f' : 'rgba(82, 196, 26, 0.85)'

      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        animated: edge.isViolation,
        type: 'smoothstep' as const,
        style: {
          stroke,
          strokeWidth: edge.isViolation ? 2.8 : incident && focusId !== null ? 2.35 : 2,
          opacity: baseOpacity,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: edge.isViolation ? '#ff4d4f' : '#52c41a',
        },
      }
    })
  }, [visibleEdgesData, focusId])

  const onNodeMouseEnter = useCallback((_event: React.MouseEvent, nodeId: string) => {
    setHoveredNode(nodeId)
  }, [])

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null)
  }, [])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      if (!onSelectFile) {
        return
      }
      onSelectFile(selectedFileId === node.id ? null : node.id)
    },
    [onSelectFile, selectedFileId],
  )

  const minimapNodeColor = useCallback((node: { id: string }) => {
    const hit = visibleNodes.find((n) => n.id === node.id)
    return hit ? LAYER_COLORS[hit.layer] || '#666' : '#444'
  }, [visibleNodes])

  const layerOrder: ProjectLayer[] = ['app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared', 'root', 'unknown', 'core', 'ui']
  const activeLayers = layerOrder.filter((layer) => visibleNodes.some((n) => n.layer === layer))

  if (visibleNodes.length === 0) {
    return <Empty description="Нет узлов graph под текущие фильтры." />
  }

  return (
    <div className="project-graph">
      <Typography.Text className="graph-caption">
        <strong>Граф зависимостей:</strong> все рёбра видны; при наведении или выборе файла остальные узлы слегка приглушаются, связи остаются читаемыми.
        <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#888' }}>
          Зелёные — разрешённые импорты • Красные пульсирующие — нарушения слоёв • {visibleNodes.length} файлов • {visibleEdgesData.length} связей • клик по узлу открывает панель импортов
        </span>
      </Typography.Text>

      <div style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'stretch' }}>
        <div className="graph-layer-legend">
          {activeLayers.map((layer) => {
            const count = visibleNodes.filter((n) => n.layer === layer).length
            return (
              <div key={layer} className="graph-layer-item" style={{ borderLeftColor: LAYER_COLORS[layer] }}>
                <div className="graph-layer-name">{layer}</div>
                <div className="graph-layer-count">{count} файлов</div>
              </div>
            )
          })}
        </div>

        <div className="graph-canvas-container" onMouseLeave={onNodeMouseLeave}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            minZoom={0.04}
            maxZoom={1.6}
            attributionPosition="bottom-left"
            onNodeMouseEnter={(e, node) => onNodeMouseEnter(e as React.MouseEvent, node.id)}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeClick={onNodeClick}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <FitViewOnLayout layoutKey={layoutKey} />
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="rgba(255,255,255,0.07)" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeStrokeWidth={2}
              nodeColor={minimapNodeColor}
              maskColor="rgba(10, 12, 16, 0.88)"
              className="graph-minimap"
              zoomable
              pannable
            />
            <Panel position="top-right" className="graph-hint-panel">
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                Колёсико — масштаб · перетаскивание фона — панорама · мини-карта справа снизу
              </Typography.Text>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
