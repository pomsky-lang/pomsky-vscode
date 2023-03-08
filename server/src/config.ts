import { TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { capabilities, connection } from './state'
import { Config } from './types/config'

// Cache the settings of all open documents
export const documentSettings: Map<string, Thenable<Config>> = new Map()
export const noExeReported: Map<string, boolean> = new Map()

// The global settings, used when the `workspace/configuration` request is not supported by the client
const defaultSettings: Config = {
  defaultFlavor: 'JavaScript',
  executable: { path: '', extraArgs: '' },
}
let globalSettings: Config = defaultSettings

export function initConfig(
  documents: TextDocuments<TextDocument>,
  onValidate: (document: TextDocument) => void,
) {
  connection.onDidChangeConfiguration(change => {
    noExeReported.clear()
    if (capabilities.config) {
      documentSettings.clear()
    } else {
      globalSettings = (change.settings.pomsky as Config) ?? defaultSettings
    }

    documents.all().forEach(onValidate)
  })
}

export function getDocumentSettings(resource: string | null): Thenable<Config> {
  if (!capabilities.config || resource === null) {
    return Promise.resolve(globalSettings)
  }

  let result = documentSettings.get(resource)
  if (!result) {
    result = connection.workspace.getConfiguration({ scopeUri: resource, section: 'pomsky' })
    documentSettings.set(resource, result)
  }
  return result
}
