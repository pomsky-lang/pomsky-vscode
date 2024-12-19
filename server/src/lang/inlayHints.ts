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
    let nesting = 0
    let index = 1
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      // don't consider colons in character sets and in tests
      if (token[0] === Token.OpenBracket || token[0] === Token.OpenBrace) {
        nesting++
      } else if (token[0] === Token.CloseBracket || token[0] === Token.CloseBrace) {
        nesting--
      } else if (token[0] === Token.Colon && nesting === 0) {
        if (tokens[i + 1]?.[0] === Token.OpenParen) {
          hints.push({
            label: String(index),
            position: model.positionAt(token[2]),
            tooltip: `Capturing group #${index}`,
          })
        } else {
          // don't show number inlay hints if there are both named and unnamed capturing groups
          // because Regex engines count them differently:
          // https://www.regular-expressions.info/named.html#number
          return []
        }
        index++
      }
    }

    return hints
  }) satisfies InlayHintRequest.HandlerSignature)
}
