import type { ProjectFileType } from '../../core/file/projectTypes'

/** Подписи типов файлов для фильтров (слои остаются как в FSD: app, shared, …). */
export const FILE_TYPE_LABEL_RU: Record<ProjectFileType, string> = {
  source: 'Исходники',
  style: 'Стили',
  markup: 'Разметка',
  data: 'Данные',
  doc: 'Документация',
  asset: 'Ресурсы',
  other: 'Прочее',
}
