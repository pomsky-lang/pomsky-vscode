import { TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { connection, getInfo } from '../state'
import { findDefinition, findUsages } from './variableUtils'
import { reserved } from '@pomsky-lang/parser/tokenizer'

export function initRename(documents: TextDocuments<TextDocument>) {
  connection.onPrepareRename(({ position, textDocument }) => {
    const model = documents.get(textDocument.uri)
    if (model === undefined) {
      return
    }

    const text = model.getText()
    const { parsed } = getInfo(model.uri, text, 'all')
    if (Array.isArray(parsed)) return

    const span = findDefinition(parsed, model.offsetAt(position))
    if (span) {
      return {
        start: model.positionAt(span[0]),
        end: model.positionAt(span[1]),
      }
    }
  })

  // Provides the initial list of the completion items
  connection.onRenameRequest(({ position, newName, textDocument }) => {
    const model = documents.get(textDocument.uri)
    if (model === undefined) {
      return
    }

    const text = model.getText()
    const { parsed } = getInfo(model.uri, text, 'all')
    if (Array.isArray(parsed)) {
      return
    }

    const offset = model.offsetAt(position)

    const span = findDefinition(parsed, offset)
    if (!span) return

    const usages = findUsages(parsed, text.slice(span[0], span[1]), span)

    return {
      changes: {
        [model.uri]: [span, ...usages].map(usage => ({
          range: {
            start: model.positionAt(usage[0]),
            end: model.positionAt(usage[1]),
          },
          newText: sanitizeName(newName),
        })),
      },
    }
  })
}

function sanitizeName(name: string) {
  const nameSan = name.replace(/[^\p{Alpha}\p{M}\p{Nd}\p{Pc}]/gu, '')
  if (nameSan in reserved || nameSan === '') {
    return nameSan + '_'
  }
  return nameSan
}
