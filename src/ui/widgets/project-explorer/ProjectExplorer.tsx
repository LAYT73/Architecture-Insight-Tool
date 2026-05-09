import { Card, Col, Row, Space, Tabs, Tag, Typography } from 'antd'
import { useProjectExplorer } from '../../../hooks/useProjectExplorer'
import { FileImportsDrawer } from './FileImportsDrawer'
import { ProjectFilters } from '../project-filters/ProjectFilters'
import { ProjectFolderLoader } from '../project-loader/ProjectFolderLoader'
import { ProjectFsdWarningsPanel } from '../project-fsd-warnings/ProjectFsdWarningsPanel'
import { ProjectGraphView } from '../project-graph/ProjectGraphView'
import { ProjectSummary } from '../project-summary/ProjectSummary'
import { ProjectTreeGraph } from '../project-tree/ProjectTreeGraph'

export function ProjectExplorer() {
  const {
    snapshot,
    filters,
    selectedFileId,
    selectFile,
    availableLayers,
    availableTypes,
    isLoading,
    error,
    sourceLabel,
    loadProject,
    updateSearch,
    updateLayers,
    updateTypes,
    updateViolationsOnly,
  } = useProjectExplorer()

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={7}>
        <Space direction="vertical" size={16} className="sidebar-stack">
          <Card className="hero-card">
            <ProjectFolderLoader isLoading={isLoading} onLoadProject={loadProject} />
          </Card>

          <Card title="Фильтры" className="sidebar-card">
            <ProjectFilters
              search={filters.search}
              layers={filters.layers}
              types={filters.types}
              violationsOnly={filters.violationsOnly}
              availableLayers={availableLayers}
              availableTypes={availableTypes}
              onSearchChange={updateSearch}
              onLayersChange={updateLayers}
              onTypesChange={updateTypes}
              onViolationsOnlyChange={updateViolationsOnly}
            />
          </Card>

          <Card title="Подсказки" className="sidebar-card">
            <Space direction="vertical" size={8}>
              <Typography.Text>Фильтр по слоям влияет и на дерево, и на graph.</Typography.Text>
              <Typography.Text>Тип файла сужает узлы по группе расширений.</Typography.Text>
              <Typography.Text>Режим «Только нарушения» оставляет import «вверх» по слоям.</Typography.Text>
            </Space>
          </Card>
        </Space>
      </Col>

      <Col xs={24} xl={17}>
        <Space direction="vertical" size={16} className="main-stack">
          <ProjectSummary snapshot={snapshot} sourceLabel={sourceLabel} />

          {error ? <Tag color="red" className="explorer-error">{error}</Tag> : null}

          <Card title="Обзор архитектуры" className="tree-card">
            <Tabs
              items={[
                {
                  key: 'tree',
                  label: 'Дерево',
                  children: (
                    <ProjectTreeGraph snapshot={snapshot.tree} filters={filters} selectedFileId={selectedFileId} onSelectFile={selectFile} />
                  ),
                },
                {
                  key: 'graph',
                  label: 'Graph',
                  children: (
                    <ProjectGraphView snapshot={snapshot} filters={filters} selectedFileId={selectedFileId} onSelectFile={selectFile} />
                  ),
                },
                {
                  key: 'fsd',
                  label: `FSD warnings${snapshot.fsdWarnings.length ? ` (${snapshot.fsdWarnings.length})` : ''}`,
                  children: <ProjectFsdWarningsPanel snapshot={snapshot} />,
                },
              ]}
            />
          </Card>
        </Space>
      </Col>

      <FileImportsDrawer
        open={selectedFileId !== null}
        fileId={selectedFileId}
        snapshot={snapshot}
        onClose={() => selectFile(null)}
        onOpenImportedFile={(id) => selectFile(id)}
      />
    </Row>
  )
}
