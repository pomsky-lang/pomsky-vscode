import { Uri, workspace } from 'vscode'

import { Config } from './types/config'

export function getDocumentSettings(uri?: Uri): Config {
  const result = workspace.getConfiguration('pomsky', uri)
  const config: Config = {
    defaultFlavor: result.get('defaultFlavor') ?? 'JavaScript',
    executable: {
      path: result.get('executable.path') ?? 'pomsky',
      extraArgs: result.get('executable.extraArgs') ?? '',
    },
  }
  return config
}
