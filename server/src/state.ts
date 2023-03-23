import { Connection } from 'vscode-languageserver'
import { TokenOrError } from './lang/tokenizePomsky'

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

export const documentInfo: Record<string, DocumentInfo> = {}

export interface DocumentInfo {
  lastContent: string
  tokens: [TokenOrError, number, number][]
}
