import { TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { connection, getInfo } from '../state'
import { findDefinition, findUsages } from './variableUtils'

export function initReferences(documents: TextDocuments<TextDocument>) {
  // Provides the initial list of the completion items
  connection.onReferences(({ position, textDocument }) => {
    const model = documents.get(textDocument.uri)
    if (model === undefined) {
      return []
    }

    const text = model.getText()
    const { parsed } = getInfo(model.uri, text, 'all')
    if (Array.isArray(parsed)) return

    const span = findDefinition(parsed, model.offsetAt(position))
    if (!span) return

    const usages = findUsages(parsed, text.slice(span[0], span[1]), span)
    return usages.map(usage => ({
      range: {
        start: model.positionAt(usage[0]),
        end: model.positionAt(usage[1]),
      },
      uri: model.uri,
    }))
  })
}
