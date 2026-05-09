import { Card, Col, Row, Statistic, Tag, Typography } from 'antd'
import type { ProjectSnapshot } from '../../../core/file/projectTypes'

interface ProjectSummaryProps {
  snapshot: ProjectSnapshot
  sourceLabel: string
}

export function ProjectSummary({ snapshot, sourceLabel }: ProjectSummaryProps) {
  return (
    <section className="summary-grid">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" className="summary-card">
            <Statistic value={snapshot.fileCount} title="Файлы" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" className="summary-card">
            <Statistic value={snapshot.folderCount} title="Папки" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" className="summary-card">
            <Statistic value={snapshot.edges.length} title="Связи import" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" className="summary-card">
            <Statistic value={snapshot.violationsCount} title="Нарушения слоёв" />
          </Card>
        </Col>
      </Row>

      <Card className="summary-card summary-card--list" title={<Typography.Title level={5}>Загруженный проект</Typography.Title>}>
        <div className="summary-meta">
          <Tag color="magenta">{sourceLabel}</Tag>
          <Typography.Text className="summary-meta__text">
            Слои: {snapshot.layers.join(', ')}
            {snapshot.fsdWarnings.length > 0 ? (
              <>
                {' '}
                ·{' '}
                <Typography.Text type="warning">предупреждений FSD: {snapshot.fsdWarnings.length}</Typography.Text>
              </>
            ) : null}
          </Typography.Text>
        </div>
      </Card>
    </section>
  )
}
