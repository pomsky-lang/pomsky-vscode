import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  DiagnosticTag,
  ExtensionContext,
  languages,
  Range,
  TextEditor,
  window,
  workspace,
} from 'vscode'
import { completionItems } from './lang/completionItems'
import { runPomsky } from './pomskyCli'
import { activatePanel } from './previewPanel'

export function activate(context: ExtensionContext) {
  activatePanel(context)

  languages.registerCompletionItemProvider('pomsky', completionItems)

  const coll = languages.createDiagnosticCollection('pomsky')

  window.onDidChangeActiveTextEditor(e => {
    if (e) {
      analyze(coll, e)
    }
  })

  if (window.activeTextEditor) {
    analyze(coll, window.activeTextEditor)
  }
}

function analyze(coll: DiagnosticCollection, editor: TextEditor) {
  if (!/\.pom(?:sky)?$/.test(editor.document.fileName)) {
    return
  }

  workspace.onDidChangeTextDocument(event => {
    if (event.document.fileName === editor.document.fileName) {
      updateContent(coll, editor, editor.document.getText())
    }
  })

  updateContent(coll, editor, editor.document.getText())
}

function updateContent(coll: DiagnosticCollection, editor: TextEditor, content: string) {
  runPomsky('js', content, editor.document.fileName).then(res => {
    if (res) {
      if (res.diagnostics?.length) {
        coll.set(
          editor.document.uri,
          res.diagnostics.map(diagnostic => {
            const span = diagnostic.spans[0]
            const result = new Diagnostic(
              new Range(
                editor.document.positionAt(span.start),
                editor.document.positionAt(span.end),
              ),
              diagnostic.help?.length
                ? `${diagnostic.description}\n\nhelp: ${diagnostic.help[0]}`
                : diagnostic.description,
              diagnostic.severity === 'error'
                ? DiagnosticSeverity.Error
                : DiagnosticSeverity.Warning,
            )
            result.code = `${diagnostic.kind} (${diagnostic.code})`
            if (diagnostic.kind === 'deprecated') {
              result.tags = [DiagnosticTag.Deprecated]
            }
            return result
          }),
        )
      } else {
        coll.set(editor.document.uri, [])
      }
    }
  })
}
