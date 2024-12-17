import { InlayHint, InlayHintRequest, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { connection, getInfo } from '../state'
import { Token } from '@pomsky-lang/parser'

export function initInlayHints(documents: TextDocuments<TextDocument>) {
  connection.onRequest(InlayHintRequest.method, (async ({ textDocument }) => {
    const model = documents.get(textDocument.uri)
    if (model === undefined) {
      return []
    }

    const text = model.getText()
    const { tokens } = getInfo(model.uri, text, 'tokens')

    const hints: InlayHint[] = []
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token[0] === Token.Colon && tokens[i + 1]?.[0] === Token.OpenParen) {
        const number = hints.length + 1
        hints.push({
          label: String(number),
          position: model.positionAt(token[2]),
          tooltip: `Capturing group #${number}`,
        })
      }
    }

    return hints
  }) satisfies InlayHintRequest.HandlerSignature)
}
