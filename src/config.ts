import { Uri, workspace } from 'vscode'

export type Flavor = 'JavaScript' | 'DotNet' | 'Java' | 'Rust' | 'Python' | 'PCRE' | 'Rust' | 'Ruby'

export interface Config {
  flavor: Flavor
  exePath: string
}

export function getConfig(uri: Uri | undefined) {
  const config = workspace.getConfiguration('pomsky', uri)

  const settings: Config = {
    flavor: config.get<Flavor>('defaultFlavor') ?? 'JavaScript',
    exePath: config.get('exePath') ?? '',
  }

  return settings
}
