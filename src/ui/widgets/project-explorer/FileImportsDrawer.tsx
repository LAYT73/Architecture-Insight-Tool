import { Badge, Drawer, List, Space, Tag, Typography } from 'antd'
import { useMemo } from 'react'
import type { ProjectFileNode, ProjectSnapshot } from '../../../core/file/projectTypes'
import { FILE_TYPE_LABEL_RU } from '../../locale/ru'

function fileById(snapshot: ProjectSnapshot, id: string): ProjectFileNode | undefined {
  const node = snapshot.nodes.find((n) => n.id === id)
  return node?.kind === 'file' ? node : undefined
}

interface FileImportsDrawerProps {
  open: boolean
  fileId: string | null
  snapshot: ProjectSnapshot
  onClose: () => void
  onOpenImportedFile: (fileId: string) => void
}

export function FileImportsDrawer({ open, fileId, snapshot, onClose, onOpenImportedFile }: FileImportsDrawerProps) {
  const file = fileId ? fileById(snapshot, fileId) : undefined
  const outgoing = fileId ? snapshot.edges.filter((e) => e.from === fileId) : []

  const incoming = useMemo(() => {
    if (!fileId) {
      return []
    }
    return [...snapshot.edges.filter((e) => e.to === fileId)].sort((a, b) => a.from.localeCompare(b.from))
  }, [fileId, snapshot.edges])

  return (
    <Drawer
      title={file ? `Файл: ${file.name}` : 'Файл'}
      placement="right"
      width={440}
      open={open && Boolean(file)}
      onClose={onClose}
      className="file-imports-drawer"
    >
      {file ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Путь
            </Typography.Text>
            <Typography.Paragraph copyable={{ text: file.path }} style={{ marginBottom: 0, wordBreak: 'break-all' }}>
              {file.path}
            </Typography.Paragraph>
          </div>

          <Space size={8} wrap>
            <Tag color="magenta">слой {file.layer}</Tag>
            <Tag color="volcano">{FILE_TYPE_LABEL_RU[file.fileType]}</Tag>
            <Badge count={file.imports.length} showZero color="rgba(255, 77, 125, 0.85)" title="Исходящих импортов в коде" />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              исходящих import
            </Typography.Text>
            <Badge count={incoming.length} showZero color="rgba(82, 196, 26, 0.85)" title="Входящих импортов из проекта" />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              входящих из проекта
            </Typography.Text>
          </Space>

          <div>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Исходящие импорты
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              Строки из этого файла; если путь сопоставлен с загруженным файлом — можно открыть цель.
            </Typography.Text>

            {file.imports.length === 0 ? (
              <Typography.Text type="secondary">Нет статических импортов или файл не разбирался как исходник.</Typography.Text>
            ) : (
              <List
                size="small"
                rowKey="key"
                dataSource={file.imports.map((spec, index) => ({ spec, key: `${index}-${spec}` }))}
                renderItem={({ spec }) => {
                  const edge = outgoing.find((e) => e.specifier === spec)
                  const target = edge ? fileById(snapshot, edge.to) : undefined

                  return (
                    <List.Item className="file-imports-drawer__row">
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Typography.Text code className="file-imports-drawer__spec">
                          {spec}
                        </Typography.Text>
                        {edge && target ? (
                          <Space wrap size={8}>
                            <Typography.Link onClick={() => onOpenImportedFile(edge.to)} className="file-imports-drawer__link">
                              → {target.name}
                            </Typography.Link>
                            {edge.isViolation ? <Tag color="red">нарушение слоёв</Tag> : <Tag color="green">ok</Tag>}
                          </Space>
                        ) : (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            Внешний пакет или путь не сопоставлен с загруженными файлами
                          </Typography.Text>
                        )}
                      </Space>
                    </List.Item>
                  )
                }}
              />
            )}
          </div>

          <div>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Кто импортирует этот файл
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              Прямые import из других файлов загруженного проекта (incoming edges).
            </Typography.Text>

            {incoming.length === 0 ? (
              <Typography.Text type="secondary">
                Ни один из загруженных файлов не импортирует этот файл напрямую.
              </Typography.Text>
            ) : (
              <List
                size="small"
                rowKey="id"
                dataSource={incoming}
                renderItem={(edge) => {
                  const importer = fileById(snapshot, edge.from)
                  if (!importer) {
                    return null
                  }
                  return (
                    <List.Item className="file-imports-drawer__row">
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Typography.Link onClick={() => onOpenImportedFile(edge.from)} className="file-imports-drawer__link">
                          ← {importer.name}
                        </Typography.Link>
                        <Typography.Text type="secondary" copyable={{ text: edge.from }} style={{ fontSize: 11, wordBreak: 'break-all' }}>
                          {edge.from}
                        </Typography.Text>
                        {edge.specifier ? (
                          <Typography.Text code className="file-imports-drawer__spec" style={{ fontSize: 11 }}>
                            {edge.specifier}
                          </Typography.Text>
                        ) : null}
                        {edge.isViolation ? <Tag color="red">нарушение слоёв</Tag> : null}
                      </Space>
                    </List.Item>
                  )
                }}
              />
            )}
          </div>

          {outgoing.length > 0 && outgoing.some((e) => !e.specifier) ? (
            <div>
              <Typography.Title level={5}>Связи без specifier</Typography.Title>
              <List
                size="small"
                dataSource={outgoing.filter((e) => !e.specifier)}
                renderItem={(edge) => {
                  const target = fileById(snapshot, edge.to)
                  if (!target) {
                    return null
                  }
                  return (
                    <List.Item>
                      <Typography.Link onClick={() => onOpenImportedFile(edge.to)}>→ {target.name}</Typography.Link>
                      {edge.isViolation ? <Tag color="red">нарушение</Tag> : null}
                    </List.Item>
                  )
                }}
              />
            </div>
          ) : null}
        </Space>
      ) : null}
    </Drawer>
  )
}
