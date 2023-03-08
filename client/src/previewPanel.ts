import {
  commands,
  Disposable,
  ExtensionContext,
  TextDocument,
  Uri,
  ViewColumn,
  WebviewOptions,
  WebviewPanel,
  window,
  workspace,
} from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import { getNonce } from './nonce'
import { singleton } from './singleton'
import { CompileHandler, CompileResultHandler } from './types/compileHandler'
import { Flavor } from './types/config'
import { PomskyJsonDiagnostic } from './types/pomskyCli'

export interface State {
  fileName: string
  content: string
  compileResult?: CompileResult
  isCompiling: boolean
  flavor: Flavor
  versionInfo?: string
}

export interface CompileResult {
  output?: string
  exeError?: string
  diagnostics?: PomskyJsonDiagnostic[]
  timings?: { all: number }
  actualLength?: number
}

export type Message = { setState: State } | { setCompiling: boolean }

export function activatePanel(context: ExtensionContext, client: LanguageClient) {
  context.subscriptions.push(
    commands.registerCommand('pomsky.openPreview', () => {
      panelSingleton.getOrInit(context.extensionUri, client)
    }),
  )

  if (window.registerWebviewPanelSerializer) {
    window.registerWebviewPanelSerializer(viewType, {
      async deserializeWebviewPanel(webviewPanel: WebviewPanel, state: unknown) {
        // Reset the webview options so we use latest uri for `localResourceRoots`.
        webviewPanel.webview.options = getWebviewOptions(context.extensionUri)
        panelSingleton.dispose()
        panelSingleton.getOrInit(context.extensionUri, client, webviewPanel)

        webviewPanel.webview.postMessage({ setState: state } as Message)
      },
    })
  }
}

const viewType = 'pomsky.preview'
const defaultColumn = ViewColumn.Beside

const panelSingleton = singleton((extUri: Uri, client: LanguageClient, panel?: WebviewPanel) => {
  if (panel) {
    panel.reveal(defaultColumn)
  } else {
    panel = window.createWebviewPanel(viewType, 'Pomsky', defaultColumn, getWebviewOptions(extUri))
  }

  initPanel({
    extUri,
    panel,
    document: window.activeTextEditor?.document,
    client,
  })
  return panel
})

const getWebviewOptions = (extUri: Uri): WebviewOptions => ({
  enableScripts: true,
  // restrict webview to only loading content from our extension's `media` directory
  localResourceRoots: [Uri.joinPath(extUri, 'media')],
})

interface PanelContext {
  extUri: Uri
  client: LanguageClient
  panel: WebviewPanel
  document?: TextDocument
  content?: string
  compileResult?: CompileResult
}

function initPanel(context: PanelContext) {
  const disposables: Disposable[] = []

  context.panel.webview.html = getHtmlForWebview(context)
  updateContent(context, true)

  setPanelTitle(context)

  // Panel is disposed when the user closes the panel or when the panel is closed programmatically
  context.panel.onDidDispose(() => disposePanel(context, disposables), null, disposables)

  // Update the content based on view changes
  context.panel.onDidChangeViewState(
    () => {
      if (context.panel.visible) {
        updateContent(context)
      }
    },
    null,
    disposables,
  )

  window.onDidChangeActiveTextEditor(
    editor => {
      if (
        editor &&
        editor.document.fileName !== context.document?.fileName &&
        editor.document.languageId === 'pomsky'
      ) {
        context.content = undefined
        context.document = editor.document
        setPanelTitle(context)
        updateContent(context)
      }
    },
    null,
    disposables,
  )

  // Handle messages from the webview
  context.panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'alert':
          window.showErrorMessage(message.text)
          return
      }
    },
    null,
    disposables,
  )

  workspace.onDidChangeTextDocument(
    event => {
      if (event.document.fileName === context.document?.fileName) {
        updateContent(context)
      }
    },
    null,
    disposables,
  )

  disposables.push(
    context.client.onNotification('handler/compileResult', (result: CompileResultHandler) => {
      context.compileResult = {
        output: trimLength(result.output, 100_000),
        actualLength: result.output?.length,
        diagnostics: result.diagnostics,
        timings: result.timings,
      }

      context.panel.webview.postMessage({
        setState: {
          fileName: result.uri,
          content: context.content,
          compileResult: context.compileResult,
          isCompiling: false,
          flavor: result.flavor,
          versionInfo: result.versionInfo,
        },
      } as Message)
    }),
  )
}

function setPanelTitle(context: PanelContext) {
  if (context.document) {
    const { path } = context.document.uri
    const lastSlash = path.replace(/\/+$/, '').lastIndexOf('/')
    const fileName = path.slice(lastSlash + 1)
    context.panel.title = `Pomsky [${fileName}]`
  } else {
    context.panel.title = `Pomsky`
  }
}

function disposePanel(context: PanelContext, disposables: Disposable[]) {
  context.panel.dispose()
  disposables.forEach(d => d.dispose())
  disposables.length = 0
  panelSingleton.dispose()
}

function updateContent(context: PanelContext, forceRefresh = false) {
  const uri = context.document?.uri
  const content = context.document?.getText()

  if (content === context.content && !forceRefresh) {
    // avoid multiple updates when the file content didn't change
    return
  }
  context.content = content

  if (content !== undefined) {
    context.panel.webview.postMessage({
      setCompiling: true,
    } as Message)

    context.client.sendRequest('handler/compile', { content, uri } as CompileHandler)
  }
}

function getHtmlForWebview({ extUri, panel: { webview } }: PanelContext) {
  const scriptPath = Uri.joinPath(extUri, 'media', 'script.js')
  const stylePath = Uri.joinPath(extUri, 'media', 'style.css')

  const scriptUri = webview.asWebviewUri(scriptPath)
  const stylesUri = webview.asWebviewUri(stylePath)

  const nonce = getNonce()

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${stylesUri}" rel="stylesheet">
    <title>Pomsky Preview</title>
  </head>
  <body>
    <div id="exeError"></div>
    <pre id="pre"></pre>

    <details id="diagnostics"></details>

    <div id="footer">
      <div id="version"></div>
      <div id="timing"></div>
    </div>

    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`
}

function trimLength(output: string | undefined, len: number) {
  if (output !== undefined) {
    return output.slice(0, len)
  }
}
