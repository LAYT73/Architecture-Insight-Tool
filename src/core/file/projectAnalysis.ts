import type {
  ProjectEdge,
  ProjectFileNode,
  ProjectFileType,
  ProjectFolderNode,
  ProjectLayer,
  ProjectSnapshot,
  ProjectTreeNode,
} from './projectTypes'
import { computeFsdWarnings } from './projectFsdAnalysis'
import { extractPathMappings, extractViteResolveAliases, parseTsConfig, resolvePathAlias } from './tsConfigResolver'

const ARCHITECTURE_LAYER_ORDER: ProjectLayer[] = ['shared', 'entities', 'features', 'widgets', 'pages', 'processes', 'app']

const TEXT_FILE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'css',
  'scss',
  'sass',
  'less',
  'html',
  'md',
  'mdx',
  'txt',
  'yaml',
  'yml',
])

const IGNORED_SEGMENTS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next', '.turbo', '.cache'])

const FSD_LAYER_TOKENS = new Set(['app', 'pages', 'widgets', 'features', 'entities', 'shared', 'processes'])
const GENERAL_LAYER_TOKENS = new Set(['core', 'ui'])

/** Top-level repo folders (next to src) treated as root/tooling, not architecture layers. */
const ROOT_TOPLEVEL_FOLDERS = new Set([
  'public',
  'static',
  'assets',
  'e2e',
  'docs',
  'scripts',
  'tools',
  'coverage',
  'cypress',
  '.storybook',
])

const FILE_TYPE_BY_EXTENSION: Record<string, ProjectFileType> = {
  ts: 'source',
  tsx: 'source',
  js: 'source',
  jsx: 'source',
  mjs: 'source',
  cjs: 'source',
  json: 'data',
  css: 'style',
  scss: 'style',
  sass: 'style',
  less: 'style',
  html: 'markup',
  md: 'doc',
  mdx: 'doc',
  txt: 'doc',
  yaml: 'data',
  yml: 'data',
}

export const fileTypeOptions: ProjectFileType[] = ['source', 'style', 'markup', 'data', 'doc', 'asset', 'other']

export function shouldIgnorePath(path: string): boolean {
  return path.split('/').some((segment) => IGNORED_SEGMENTS.has(segment))
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

export function getExtension(fileName: string): string {
  const normalized = fileName.toLowerCase()
  const extensionIndex = normalized.lastIndexOf('.')

  return extensionIndex === -1 ? '' : normalized.slice(extensionIndex + 1)
}

export function getFileType(fileName: string): ProjectFileType {
  const extension = getExtension(fileName)

  if (!extension) {
    return 'other'
  }

  return FILE_TYPE_BY_EXTENSION[extension] ?? (TEXT_FILE_EXTENSIONS.has(extension) ? 'other' : 'asset')
}

function isTextLikeFile(fileName: string): boolean {
  const extension = getExtension(fileName)

  return TEXT_FILE_EXTENSIONS.has(extension)
}

function splitSegments(path: string): string[] {
  return normalizePath(path).split('/').filter(Boolean)
}

function stripExtension(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf('.')

  return extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex)
}

function stripProjectRootSegments(segments: string[], rootPath: string): string[] {
  if (!rootPath || segments.length === 0) {
    return segments
  }
  const r = rootPath.toLowerCase()
  if (segments[0] === r) {
    return segments.slice(1)
  }
  return segments
}

export function detectLayer(path: string, rootPath: string): ProjectLayer {
  const segments = stripProjectRootSegments(
    splitSegments(path).map((segment) => segment.toLowerCase()),
    rootPath,
  )

  if (segments.length === 0) {
    return 'root'
  }

  if (segments.includes('src')) {
    const sourceIndex = segments.indexOf('src')
    const afterSource = segments[sourceIndex + 1]

    if (!afterSource) {
      return 'app'
    }

    if (afterSource.includes('.')) {
      return 'app'
    }

    if (FSD_LAYER_TOKENS.has(afterSource as ProjectLayer)) {
      return afterSource as ProjectLayer
    }

    if (GENERAL_LAYER_TOKENS.has(afterSource as ProjectLayer)) {
      return afterSource as ProjectLayer
    }

    if (stripExtension(afterSource) === 'main' || stripExtension(afterSource) === 'app' || stripExtension(afterSource) === 'index') {
      return 'app'
    }

    return 'unknown'
  }

  for (const segment of segments) {
    if (FSD_LAYER_TOKENS.has(segment as ProjectLayer)) {
      return segment as ProjectLayer
    }
    if (GENERAL_LAYER_TOKENS.has(segment as ProjectLayer)) {
      return segment as ProjectLayer
    }
  }

  const firstSegment = segments[0]

  if (!firstSegment) {
    return 'root'
  }

  const fileName = segments[segments.length - 1] ?? ''
  if (fileName.includes('.')) {
    if (stripExtension(fileName) === 'main' || stripExtension(fileName) === 'app' || stripExtension(fileName) === 'index') {
      return 'app'
    }
    return 'root'
  }

  if (ROOT_TOPLEVEL_FOLDERS.has(firstSegment)) {
    return 'root'
  }

  return 'unknown'
}

export function compareLayers(leftLayer: ProjectLayer, rightLayer: ProjectLayer): number {
  const leftIndex = ARCHITECTURE_LAYER_ORDER.indexOf(leftLayer)
  const rightIndex = ARCHITECTURE_LAYER_ORDER.indexOf(rightLayer)

  const normalizedLeft = leftIndex === -1 ? Number.POSITIVE_INFINITY : leftIndex
  const normalizedRight = rightIndex === -1 ? Number.POSITIVE_INFINITY : rightIndex

  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft - normalizedRight
  }

  return leftLayer.localeCompare(rightLayer)
}

function isViolation(fromLayer: ProjectLayer, toLayer: ProjectLayer): boolean {
  const fromIndex = ARCHITECTURE_LAYER_ORDER.indexOf(fromLayer)
  const toIndex = ARCHITECTURE_LAYER_ORDER.indexOf(toLayer)

  if (fromIndex === -1 || toIndex === -1) {
    return false
  }

  return fromIndex < toIndex
}

export function parseImports(sourceText: string): string[] {
  const importStatements = new Set<string>()

  // remove line and block comments to avoid false matches
  let cleanedText = sourceText
    .replace(/\/\/.*$/gm, '') // remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments

  // static imports and re-exports: import/export with multiple line formats
  // handles: import x from 'y', import { x } from 'y', import type { x } from 'y', export * from 'y'
  const staticImportRegex = /(?:import|export)(?:\s+type)?\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|from\s+['"]([^'"]+)['"]\s*;/g
  
  // dynamic imports: import('x'), import.meta.url
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  
  // commonjs require: require('x'), require.resolve('x')
  const requireRegex = /require(?:\.resolve)?\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  
  // legacy typescript reference comments
  const referenceRegex = /\/\/\s*<reference\s+path=['"]([^'"]+)['"]\s*\/>/g

  for (const regex of [staticImportRegex, dynamicImportRegex, requireRegex, referenceRegex]) {
    let match: RegExpExecArray | null = null
    while ((match = regex.exec(cleanedText))) {
      // capture group can be at 1, 2, or 3 depending on which part matched
      const specifier = match[1] || match[2] || match[3]
      if (specifier && specifier.trim()) {
        importStatements.add(specifier.trim())
      }
    }
  }

  return [...importStatements]
}

function getRelativePath(file: File): string {
  const relativePath = normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)

  return relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
}

function joinSegments(segments: string[]): string {
  return segments.filter(Boolean).join('/')
}

function resolveRelativeImport(sourcePath: string, specifier: string, knownPaths: Set<string>): string | null {
  if (!specifier.startsWith('.')) {
    return null
  }

  const sourceSegments = splitSegments(sourcePath)
  const baseSegments = sourceSegments.slice(0, -1)
  const candidateSegments = [...baseSegments]

  for (const segment of specifier.split('/')) {
    if (!segment || segment === '.') {
      continue
    }

    if (segment === '..') {
      candidateSegments.pop()
      continue
    }

    candidateSegments.push(segment)
  }

  const basePath = joinSegments(candidateSegments)
  const rawCandidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    `${basePath}.json`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
    `${basePath}/index.js`,
    `${basePath}/index.jsx`,
    `${basePath}/index.mts`,
    `${basePath}/index.cts`,
  ]

  return rawCandidates.find((candidate) => knownPaths.has(candidate)) ?? null
}

function resolveAliasOrAbsoluteImport(
  specifier: string,
  knownPaths: Set<string>,
  rootPath: string,
  pathMappings: Record<string, string> = {},
): string | null {
  if (specifier.startsWith('.') || specifier.includes('node_modules')) {
    return null
  }

  const tryCandidates = (base: string) => {
    const norm = normalizePath(base.replace(/^\.\//, '')).replace(/\/+/g, '/')
    const rawCandidates = [
      norm,
      `${norm}.ts`,
      `${norm}.tsx`,
      `${norm}.js`,
      `${norm}.jsx`,
      `${norm}.mjs`,
      `${norm}.cjs`,
      `${norm}.mts`,
      `${norm}.cts`,
      `${norm}.json`,
      `${norm}/index.ts`,
      `${norm}/index.tsx`,
      `${norm}/index.js`,
      `${norm}/index.jsx`,
      `${norm}/index.mts`,
      `${norm}/index.cts`,
    ]

    return rawCandidates.find((candidate) => knownPaths.has(candidate)) ?? null
  }

  const tryLogicalProjectPath = (logicalPath: string): string | null => {
    const norm = normalizePath(logicalPath.replace(/^\.\//, '')).replace(/\/+/g, '/')
    const withRoot =
      !rootPath || norm === rootPath || norm.startsWith(`${rootPath}/`) ? norm : `${rootPath}/${norm}`.replace(/\/+/g, '/')
    return tryCandidates(norm) ?? (withRoot !== norm ? tryCandidates(withRoot) : null)
  }

  const aliasResolved = resolvePathAlias(specifier, pathMappings)
  if (aliasResolved) {
    const hit = tryLogicalProjectPath(aliasResolved)
    if (hit) {
      return hit
    }
  }

  if (specifier.startsWith('@/')) {
    const tail = specifier.slice(2)
    for (const base of [`${rootPath}/src/${tail}`, `src/${tail}`, `${rootPath}/${tail}`, tail]) {
      const hit = tryLogicalProjectPath(base)
      if (hit) {
        return hit
      }
    }
  }

  if (/^@[a-z0-9-]+\/[^/]+/i.test(specifier)) {
    return null
  }

  if (specifier.startsWith('@') || /^[a-z0-9-]+(\/[a-z0-9-]+)*$/i.test(specifier)) {
    const pkgName = specifier.split('/')[0]
    if (!['src', 'lib', 'components', 'utils', 'helpers', 'hooks', 'services'].includes(pkgName)) {
      // fall through to absolute / rooted / fuzzy
    } else {
      const hit = tryLogicalProjectPath(specifier)
      if (hit) {
        return hit
      }
    }
  }

  if (specifier.startsWith('/')) {
    const candidate = tryCandidates(specifier.replace(/^\//, ''))
    if (candidate) {
      return candidate
    }
  }

  if (specifier.startsWith('src/')) {
    const candidate = tryCandidates(specifier)
    if (candidate) {
      return candidate
    }
    const withoutSrc = tryCandidates(specifier.replace(/^src\//, ''))
    if (withoutSrc) {
      return withoutSrc
    }
  }

  const rootedCandidate = tryCandidates(`${rootPath}/${specifier}`.replace(/\/+/g, '/'))
  if (rootedCandidate) {
    return rootedCandidate
  }

  for (const p of knownPaths) {
    const pNorm = normalizePath(p)
    if (pNorm.endsWith(`/${specifier}`) || pNorm.endsWith(specifier)) {
      return p
    }
    if (
      pNorm.endsWith(`/${specifier}.ts`) ||
      pNorm.endsWith(`/${specifier}.tsx`) ||
      pNorm.endsWith(`/${specifier}.js`) ||
      pNorm.endsWith(`/${specifier}.jsx`)
    ) {
      return p
    }
  }

  return null
}

export function sortTreeNode(node: ProjectFolderNode): ProjectFolderNode {
  const sortedChildren = [...node.children].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'folder' || left.kind === 'project' ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })

  return {
    ...node,
    children: sortedChildren.map((child) => (child.kind === 'file' ? child : sortTreeNode(child as ProjectFolderNode))),
  }
}

export async function loadProjectFromFiles(files: File[]): Promise<ProjectSnapshot> {
  const acceptedFiles = files
    .map((file) => ({ file, path: getRelativePath(file) }))
    .filter(({ path }) => path.length > 0 && !shouldIgnorePath(path))

  const rootName = acceptedFiles[0]?.path.split('/')[0] ?? 'project'
  const rootPath = rootName

  const rootNode: ProjectFolderNode = {
    id: rootPath,
    name: rootName,
    path: rootPath,
    kind: 'project',
    layer: detectLayer(rootPath, rootPath),
    children: [],
  }

  const nodeByPath = new Map<string, ProjectTreeNode>()
  nodeByPath.set(rootNode.path, rootNode)

  for (const { path } of acceptedFiles) {
    const segments = splitSegments(path)
    const folderSegments = segments.slice(0, -1)
    const fileName = segments[segments.length - 1] ?? ''

    let currentFolder = rootNode

    for (const [index, segment] of folderSegments.entries()) {
      // skip the root segment since it's already represented by rootNode
      if (index === 0 && segment.toLowerCase() === rootName.toLowerCase()) {
        continue
      }

      const currentPath = joinSegments(folderSegments.slice(0, index + 1))
      const cachedNode = nodeByPath.get(currentPath)

      if (cachedNode && cachedNode.kind !== 'file') {
        currentFolder = cachedNode
        continue
      }

      const folderNode: ProjectFolderNode = {
        id: currentPath,
        name: segment,
        path: currentPath,
        kind: 'folder',
        layer: detectLayer(currentPath, rootPath),
        children: [],
      }

      currentFolder.children.push(folderNode)
      nodeByPath.set(currentPath, folderNode)
      currentFolder = folderNode
    }

    const filePath = joinSegments(segments)
    const fileNode: ProjectFileNode = {
      id: filePath,
      name: fileName,
      path: filePath,
      kind: 'file',
      layer: detectLayer(filePath, rootPath),
      extension: getExtension(fileName),
      fileType: getFileType(fileName),
      imports: [],
    }

    currentFolder.children.push(fileNode)
    nodeByPath.set(filePath, fileNode)
  }

  const textFiles = acceptedFiles.filter(({ file, path }) => isTextLikeFile(file.name) && !shouldIgnorePath(path))
  const sourceContents = new Map<string, string>()

  await Promise.all(
    textFiles.map(async ({ file, path }) => {
      sourceContents.set(path, await file.text())
    }),
  )

  let pathMappings: Record<string, string> = {}
  const tsconfigFiles = acceptedFiles
    .filter(({ path }) => /(^|\/)tsconfig(\.[^/]+)?\.json$/i.test(path))
    .sort((a, b) => {
      const depth = (p: string) => p.split('/').length
      const da = depth(a.path)
      const db = depth(b.path)
      if (da !== db) {
        return da - db
      }
      return a.path.localeCompare(b.path)
    })

  for (const { path: cfgPath } of tsconfigFiles) {
    const text = sourceContents.get(cfgPath)
    if (!text) {
      continue
    }
    const merged = extractPathMappings(parseTsConfig(text), cfgPath)
    pathMappings = { ...pathMappings, ...merged }
  }

  const viteConfigFiles = acceptedFiles.filter(({ path }) => /(^|\/)vite\.config\.(ts|mts|cts|js|mjs)$/i.test(path))
  for (const { path: cfgPath } of viteConfigFiles) {
    const text = sourceContents.get(cfgPath)
    if (!text) {
      continue
    }
    pathMappings = { ...pathMappings, ...extractViteResolveAliases(text, cfgPath) }
  }

  const allPaths = new Set(acceptedFiles.map(({ path }) => path))
  const edges: ProjectEdge[] = []

  for (const [sourcePath, content] of sourceContents.entries()) {
    const sourceNode = nodeByPath.get(sourcePath)

    if (!sourceNode || sourceNode.kind !== 'file') {
      continue
    }

    const imports = parseImports(content)
    sourceNode.imports = imports

    for (const specifier of imports) {
      // try relative first
      let resolvedPath = resolveRelativeImport(sourcePath, specifier, allPaths)

      // try alias/absolute/root imports
      if (!resolvedPath) {
        resolvedPath = resolveAliasOrAbsoluteImport(specifier, allPaths, rootPath, pathMappings)
      }

      if (!resolvedPath) {
        continue
      }

      const targetNode = nodeByPath.get(resolvedPath)

      if (!targetNode || targetNode.kind !== 'file') {
        continue
      }

      edges.push({
        id: `${sourcePath} -> ${resolvedPath}`,
        from: sourcePath,
        to: resolvedPath,
        fromLayer: sourceNode.layer,
        toLayer: targetNode.layer,
        isViolation: isViolation(sourceNode.layer, targetNode.layer),
        specifier,
      })
    }
  }

  const flattenedNodes = [...nodeByPath.values()]
  const folderCount = flattenedNodes.filter((node) => node.kind !== 'file').length
  const fileCount = flattenedNodes.filter((node) => node.kind === 'file').length
  const violationsCount = edges.filter((edge) => edge.isViolation).length
  const layers = [...new Set(flattenedNodes.map((node) => node.layer))].sort(compareLayers)
  const fileTypes = [...new Set(flattenedNodes.filter((node): node is ProjectFileNode => node.kind === 'file').map((node) => node.fileType))].sort()

  const snapshotBase: ProjectSnapshot = {
    rootName,
    rootPath,
    tree: sortTreeNode(rootNode),
    nodes: flattenedNodes,
    edges,
    layers,
    fileTypes,
    violationsCount,
    fileCount,
    folderCount,
    fsdWarnings: [],
  }

  return {
    ...snapshotBase,
    fsdWarnings: computeFsdWarnings(snapshotBase, sourceContents),
  }
}
