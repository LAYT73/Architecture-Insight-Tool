export interface TsConfigPaths {
  [alias: string]: string[]
}

export interface TsConfig {
  compilerOptions?: {
    baseUrl?: string
    paths?: TsConfigPaths
  }
  extends?: string
}

export function parseTsConfig(configText: string): TsConfig {
  try {
    const cleaned = configText
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
    return JSON.parse(cleaned)
  } catch {
    return {}
  }
}

/** Parent path of a config file (POSIX, relative to upload root). */
export function dirname(configFilePath: string): string {
  const parts = configFilePath.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 1) {
    return ''
  }
  return parts.slice(0, -1).join('/')
}

/** Resolve POSIX relative path segments against a base directory path. */
export function resolvePathRelativeToBase(basePath: string, relative: string): string {
  const baseSegs = basePath.split('/').filter(Boolean)
  const rel = relative.replace(/^\.\//, '').replace(/\/$/, '')
  if (!rel || rel === '.') {
    return baseSegs.join('/')
  }
  const relSegs = rel.split('/').filter(Boolean)
  const stack = [...baseSegs]
  for (const s of relSegs) {
    if (s === '..') {
      stack.pop()
    } else if (s !== '.') {
      stack.push(s)
    }
  }
  return stack.join('/')
}

/**
 * Maps path alias prefix → absolute logical directory (relative to repo upload root),
 * using the tsconfig file location and compilerOptions.baseUrl / paths (TypeScript semantics).
 */
export function extractPathMappings(config: TsConfig, configFilePath: string): Record<string, string> {
  const paths = config.compilerOptions?.paths
  if (!paths) {
    return {}
  }

  const configDir = dirname(configFilePath)
  const baseUrlOpt = (config.compilerOptions?.baseUrl ?? '.').replace(/\/$/, '') || '.'
  const physicalBase = resolvePathRelativeToBase(configDir, baseUrlOpt === '.' ? '' : baseUrlOpt)

  const mappings: Record<string, string> = {}

  for (const [aliasPattern, targetPaths] of Object.entries(paths)) {
    if (targetPaths.length === 0) {
      continue
    }

    let cleanAlias = aliasPattern.replace(/\/\*$/, '').replace(/\/$/, '')
    let target = targetPaths[0]?.replace(/\/\*$/, '') ?? ''
    target = target.replace(/^\.\//, '')

    if (!cleanAlias) {
      continue
    }

    const physicalTarget = target && target !== '.' ? resolvePathRelativeToBase(physicalBase, target) : physicalBase

    mappings[cleanAlias] = physicalTarget
  }

  return mappings
}

/**
 * Longest alias first so e.g. @components wins over @.
 */
export function resolvePathAlias(specifier: string, pathMappings: Record<string, string>): string | null {
  const entries = Object.entries(pathMappings).sort((a, b) => b[0].length - a[0].length)

  for (const [alias, target] of entries) {
    if (!alias) {
      continue
    }

    if (specifier === alias) {
      return target
    }

    if (specifier.startsWith(`${alias}/`)) {
      const rest = specifier.slice(alias.length)
      return `${target}${rest}`.replace(/\/+/g, '/')
    }
  }

  return null
}

/**
 * Best-effort: read `resolve.alias` from Vite config source when paths only live there.
 */
export function extractViteResolveAliases(sourceText: string, configFilePath: string): Record<string, string> {
  const cleaned = sourceText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const configDir = dirname(configFilePath)
  const out: Record<string, string> = {}

  const patterns: RegExp[] = [
    /['"](@[^'"]+)['"]\s*:\s*path\.resolve\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/g,
    /['"](@[^'"]+)['"]\s*:\s*path\.join\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/g,
    /['"](@[^'"]+)['"]\s*:\s*fileURLToPath\(\s*new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)\s*\)/g,
  ]

  for (const re of patterns) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(cleaned))) {
      let aliasKey = match[1].trim()
      const rel = match[2].replace(/^\.\//, '')
      aliasKey = aliasKey.replace(/\/\*$/, '').replace(/\/$/, '')
      if (!aliasKey || !rel) {
        continue
      }
      const physical = resolvePathRelativeToBase(configDir, rel)
      out[aliasKey] = physical
    }
  }

  return out
}
