import { Uri, workspace } from 'vscode'

export type Flavor = 'JavaScript' | 'DotNet' | 'Java' | 'Rust' | 'Python' | 'PCRE' | 'Rust' | 'Ruby'

export interface Config {
  flavor: Flavor
  exePath: string
  exeArgs: string[]
}

export function getConfig(uri: Uri | undefined) {
  const config = workspace.getConfiguration('pomsky', uri)

  const settings: Config = {
    flavor: config.get<Flavor>('defaultFlavor') ?? 'JavaScript',
    exePath: config.get('executable.path') ?? '',
    exeArgs: parseExtraArgs(config.get<string>('executable.extraArgs')) ?? [],
  }

  return settings
}

function parseExtraArgs(args?: string): string[] {
  if (args == null) {
    return []
  }

  return args
    .split(/(?<=(?<!\\)(\\\\)*) /)
    .map(s => s.replace(/\\(.)/g, '$1'))
    .filter(s => s !== '')
}
