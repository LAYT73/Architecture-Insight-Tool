import { Checkbox, Input, Space, Switch, Typography } from 'antd'
import type { ProjectFileType, ProjectLayer } from '../../../core/file/projectTypes'
import { FILE_TYPE_LABEL_RU } from '../../locale/ru'

interface ProjectFiltersProps {
  search: string
  layers: ProjectLayer[]
  types: ProjectFileType[]
  violationsOnly: boolean
  availableLayers: ProjectLayer[]
  availableTypes: ProjectFileType[]
  onSearchChange: (value: string) => void
  onLayersChange: (value: ProjectLayer[]) => void
  onTypesChange: (value: ProjectFileType[]) => void
  onViolationsOnlyChange: (value: boolean) => void
}

export function ProjectFilters({
  search,
  layers,
  types,
  violationsOnly,
  availableLayers,
  availableTypes,
  onSearchChange,
  onLayersChange,
  onTypesChange,
  onViolationsOnlyChange,
}: ProjectFiltersProps) {
  return (
    <Space direction="vertical" size={16} className="filters-card__content">
      <div>
        <Typography.Text className="filters-label">Поиск</Typography.Text>
        <Input
          allowClear
          value={search}
          placeholder="Файл, папка или фрагмент пути"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div>
        <Typography.Text className="filters-label">Слои (FSD)</Typography.Text>
        <Checkbox.Group
          options={availableLayers.map((layer) => ({ label: layer, value: layer }))}
          value={layers}
          onChange={(value) => onLayersChange(value as ProjectLayer[])}
        />
      </div>

      <div>
        <Typography.Text className="filters-label">Тип файла</Typography.Text>
        <Checkbox.Group
          options={availableTypes.map((type) => ({ label: FILE_TYPE_LABEL_RU[type], value: type }))}
          value={types}
          onChange={(value) => onTypesChange(value as ProjectFileType[])}
        />
      </div>

      <div className="filters-switch-row">
        <div>
          <Typography.Text className="filters-label">Только нарушения</Typography.Text>
          <Typography.Paragraph className="filters-help">Показывать только рёбра, нарушающие порядок слоёв.</Typography.Paragraph>
        </div>
        <Switch checked={violationsOnly} onChange={onViolationsOnlyChange} />
      </div>
    </Space>
  )
}
