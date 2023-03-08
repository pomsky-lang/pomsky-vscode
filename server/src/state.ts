import { Connection } from 'vscode-languageserver'

interface Capabilities {
  readonly config: boolean
  readonly workspaceFolders: boolean
  readonly diagnosticRelatedInformation: boolean
}

export let capabilities: Capabilities = {
  config: false,
  workspaceFolders: false,
  diagnosticRelatedInformation: false,
}

export function setCapabilities(capabilities_: Capabilities) {
  capabilities = capabilities_
}

export let connection: Connection

export function setConnection(connection_: Connection) {
  connection = connection_
}
