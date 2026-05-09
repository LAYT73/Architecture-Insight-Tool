import type { ProjectFileNode, ProjectFsdWarning, ProjectSnapshot } from './projectTypes'

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

const SLICE_INDEX_FILES = new Set(['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mts', 'index.cts'])

/**
 * Находит строку с указанным module specifier в исходнике (import / export / require).
 */
export function findImportSpecifierContext(
  source: string,
  specifier: string,
): { lineNumber: number; lineText: string } | null {
  if (!specifier || !source) {
    return null
  }

  const lines = source.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.includes(specifier)) {
      continue
    }

    const hasQuotes =
      raw.includes(`'${specifier}'`) ||
      raw.includes(`"${specifier}"`) ||
      (raw.includes('`') && raw.includes(specifier))
    const looksModuleLine =
      /\b(import|export)\b/.test(raw) ||
      /\b(require|import)\s*\(/.test(raw) ||
      /\bfrom\s+['"`]/.test(raw)

    if (hasQuotes && (looksModuleLine || /export\s+.*\s+from/.test(raw))) {
      return { lineNumber: i + 1, lineText: raw.trimEnd() }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.includes(specifier) && /\b(import|export|require)\b/.test(raw)) {
      return { lineNumber: i + 1, lineText: raw.trimEnd() }
    }
  }

  return null
}

/**
 * Absolute slice root: `<root>/src/<layer>/<segment>` for FSD slice parents.
 */
export function getFsdSliceRoot(path: string): string | null {
  const norm = normalizePath(path)
  const m = norm.match(/^(.+)\/src\/(features|entities|widgets|pages|shared|processes|app)\/([^/]+)/i)
  if (!m) {
    return null
  }
  const sliceSeg = m[3]
  if (sliceSeg.includes('.')) {
    return null
  }
  return `${m[1]}/src/${m[2]}/${m[3]}`.replace(/\/+/g, '/')
}

function isSlicePublicIndexFile(filePath: string, sliceRoot: string): boolean {
  if (!filePath.startsWith(`${sliceRoot}/`)) {
    return false
  }
  const rest = filePath.slice(sliceRoot.length + 1)
  return SLICE_INDEX_FILES.has(rest.toLowerCase())
}

function collectSliceRoots(files: ProjectFileNode[]): Set<string> {
  const roots = new Set<string>()
  for (const f of files) {
    const r = getFsdSliceRoot(f.path)
    if (r) {
      roots.add(r)
    }
  }
  return roots
}

export function computeFsdWarnings(snapshot: ProjectSnapshot, sourceByPath: Map<string, string> = new Map()): ProjectFsdWarning[] {
  const warnings: ProjectFsdWarning[] = []
  const seen = new Set<string>()
  const files = snapshot.nodes.filter((n): n is ProjectFileNode => n.kind === 'file')
  const pathSet = new Set(files.map((f) => f.path))
  const sliceRoots = collectSliceRoots(files)

  for (const sliceRoot of sliceRoots) {
    const hasSourceInSlice = files.some(
      (f) =>
        f.path.startsWith(`${sliceRoot}/`) &&
        (f.extension === 'ts' || f.extension === 'tsx' || f.extension === 'js' || f.extension === 'jsx'),
    )
    if (!hasSourceInSlice) {
      continue
    }

    const hasIndex = [...SLICE_INDEX_FILES].some((name) => pathSet.has(`${sliceRoot}/${name}`))
    if (!hasIndex) {
      const id = `missing-index:${sliceRoot}`
      if (!seen.has(id)) {
        seen.add(id)
        warnings.push({
          id,
          kind: 'missing_slice_index',
          severity: 'warning',
          message: 'Нет публичного API слайса: в корне слайса ожидается index.ts или index.tsx.',
          path: sliceRoot,
        })
      }
    }
  }

  for (const edge of snapshot.edges) {
    const toRoot = getFsdSliceRoot(edge.to)
    if (!toRoot) {
      continue
    }
    if (isSlicePublicIndexFile(edge.to, toRoot)) {
      continue
    }

    const fromRoot = getFsdSliceRoot(edge.from)
    if (fromRoot && fromRoot === toRoot) {
      continue
    }

    const id = `deep:${edge.from}->${edge.to}`
    if (seen.has(id)) {
      continue
    }
    seen.add(id)

    let codeLine: string | undefined
    let codeLineNumber: number | undefined
    const importerSource = edge.specifier ? sourceByPath.get(edge.from) : undefined
    if (importerSource && edge.specifier) {
      const hit = findImportSpecifierContext(importerSource, edge.specifier)
      if (hit) {
        codeLine = hit.lineText
        codeLineNumber = hit.lineNumber
      }
    }

    warnings.push({
      id,
      kind: 'deep_cross_slice_import',
      severity: 'warning',
      message:
        'Импорт во внутреннюю часть другого слайса: по FSD обычно импортируют только из public API (корень слайса / index).',
      path: edge.to,
      relatedPath: edge.from,
      detail: `Слайс назначения: ${toRoot}`,
      specifier: edge.specifier,
      codeLine,
      codeLineNumber,
    })
  }

  return warnings.sort((a, b) => {
    const byKind = a.kind.localeCompare(b.kind)
    if (byKind !== 0) {
      return byKind
    }
    return a.path.localeCompare(b.path)
  })
}
