import { Collapse, Empty, Tag, Typography } from 'antd'
import type { ProjectFsdWarning, ProjectSnapshot } from '../../../core/file/projectTypes'

const KIND_LABEL: Record<ProjectFsdWarning['kind'], string> = {
  missing_slice_index: 'Нет public API',
  deep_cross_slice_import: 'Импорт мимо index',
}

interface ProjectFsdWarningsPanelProps {
  snapshot: ProjectSnapshot
}

export function ProjectFsdWarningsPanel({ snapshot }: ProjectFsdWarningsPanelProps) {
  const items = snapshot.fsdWarnings

  if (items.length === 0) {
    return (
      <Empty
        description="По текущим правилам замечаний нет: в слайсах есть index или нет «глубоких» импортов между слайсами."
        className="fsd-warnings-panel fsd-warnings-panel--empty"
      />
    )
  }

  return (
    <div className="fsd-warnings-panel">
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Эвристики: наличие <Typography.Text code>index.ts</Typography.Text> / <Typography.Text code>index.tsx</Typography.Text> в корне слайса (
        <Typography.Text code>src/&#123;features|entities|…&#125;/имяСлайса</Typography.Text>) и импорты из внутренних файлов чужого слайса вместо public API.
      </Typography.Paragraph>

      <Collapse
        ghost
        className="fsd-warnings-collapse"
        expandIconPosition="end"
        items={items.map((w) => ({
          key: w.id,
          classNames: { header: 'fsd-warnings-collapse__header' },
          label: (
            <div className="fsd-warnings-panel__collapse-label">
              <Tag color="gold">{KIND_LABEL[w.kind]}</Tag>
              <Typography.Text copyable={{ text: w.path }} strong className="fsd-warnings-panel__path-inline">
                {w.path}
              </Typography.Text>
            </div>
          ),
          children: (
            <div className="fsd-warnings-panel__body">
              <Typography.Paragraph className="fsd-warnings-panel__message" style={{ marginBottom: 12 }}>
                {w.message}
              </Typography.Paragraph>

              {w.relatedPath ? (
                <Typography.Text type="secondary" copyable={{ text: w.relatedPath }} className="fsd-warnings-panel__meta-line">
                  Импортирует: {w.relatedPath}
                </Typography.Text>
              ) : null}

              {w.specifier ? (
                <Typography.Text type="secondary" className="fsd-warnings-panel__meta-line" style={{ display: 'block' }}>
                  Specifier: <Typography.Text code>{w.specifier}</Typography.Text>
                </Typography.Text>
              ) : null}

              {w.detail ? (
                <Typography.Text type="secondary" className="fsd-warnings-panel__detail-block">
                  {w.detail}
                </Typography.Text>
              ) : null}

              {w.kind === 'deep_cross_slice_import' ? (
                w.codeLine ? (
                  <div className="fsd-warnings-panel__code-wrap">
                    <div className="fsd-warnings-panel__code-toolbar">
                      <span className="fsd-warnings-panel__code-badge">строка {w.codeLineNumber}</span>
                      <Typography.Text type="secondary" className="fsd-warnings-panel__code-hint">
                        фрагмент из файла-импортёра
                      </Typography.Text>
                    </div>
                    <pre className="fsd-warnings-panel__code">
                      <code>{w.codeLine}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="fsd-warnings-panel__code-missing">
                    <Typography.Text type="secondary">
                      Строку с этим импортом в исходнике не нашли (динамический импорт, многострочный import или файл не попал в разбор).
                    </Typography.Text>
                  </div>
                )
              ) : (
                <div className="fsd-warnings-panel__hint-slice">
                  <Typography.Text type="secondary">
                    Добавьте в корень слайса файл public API, например <Typography.Text code>index.ts</Typography.Text>, с реэкспортом нужных модулей.
                  </Typography.Text>
                </div>
              )}
            </div>
          ),
        }))}
      />
    </div>
  )
}
