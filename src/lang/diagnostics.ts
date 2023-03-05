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
import { runPomsky } from '../pomskyCli'

interface DiagnosticsContext {
  contents: Map<string, string>
}

export function activateDiagnostics(_context: ExtensionContext) {
  const coll = languages.createDiagnosticCollection('pomsky')

  const contents = new Map<string, string>()
  const context: DiagnosticsContext = { contents }

  window.onDidChangeActiveTextEditor(e => {
    if (e) {
      analyze(coll, e, context)
    }
  })

  if (window.activeTextEditor) {
    analyze(coll, window.activeTextEditor, context)
  }
}

function analyze(coll: DiagnosticCollection, editor: TextEditor, context: DiagnosticsContext) {
  if (!/\.pom(?:sky)?$/.test(editor.document.fileName)) {
    return
  }

  workspace.onDidChangeTextDocument(event => {
    if (event.document.fileName === editor.document.fileName) {
      const content = event.document.getText()
      if (content !== context.contents.get(editor.document.fileName)) {
        context.contents.set(editor.document.fileName, content)
        updateContent(coll, editor, content)
      }
    }
  })

  const content = editor.document.getText()
  context.contents.set(editor.document.fileName, content)
  updateContent(coll, editor, content)
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
            result.source = 'pomsky'
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
