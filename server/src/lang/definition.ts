import { Definition, TextDocumentPositionParams, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { connection, getInfo } from '../state'
import { findDefinition } from './variableUtils'

export function initDefinition(documents: TextDocuments<TextDocument>) {
  // Provides the initial list of the completion items
  connection.onDefinition(
    ({ position, textDocument }: TextDocumentPositionParams): Definition | undefined => {
      const model = documents.get(textDocument.uri)
      if (model === undefined) {
        return []
      }

      const text = model.getText()
      const { parsed } = getInfo(model.uri, text, 'all')
      if (Array.isArray(parsed)) return

      const spanOrString = findDefinition(parsed, model.offsetAt(position))
      if (spanOrString) {
        return {
          range: {
            start: model.positionAt(spanOrString[0]),
            end: model.positionAt(spanOrString[1]),
          },
          uri: model.uri,
        }
      }
    },
  )
}
