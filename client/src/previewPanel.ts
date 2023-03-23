import {
  commands,
  Disposable,
  ExtensionContext,
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
  ThemeColor,
  Uri,
  ViewColumn,
  WebviewOptions,
  WebviewPanel,
  window,
  workspace,
} from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import { getDocumentSettings } from './config'
import { getNonce } from './nonce'
import { singleton } from './singleton'
import { CompileHandler, CompileResultHandler } from './types/compileHandler'
import { Config, Flavor } from './types/config'
import { PomskyJsonDiagnostic } from './types/pomskyCli'

export interface State {
  fileName: string
  content: string
  compileResult?: CompileResult
  flavor: Flavor
  versionInfo?: string
}

export interface CompileResult {
  output?: string
  diagnostics?: PomskyJsonDiagnostic[]
  timings?: { all: number }
  actualLength?: number
}

export type Message = { setState: State } | { setError: boolean }

let cancelCompilation: (() => string) | undefined

export function activatePanel(context: ExtensionContext, client: LanguageClient) {
  context.subscriptions.push(
    commands.registerCommand('pomsky.preview.open', () => {
      panelSingleton.getOrInit(context.extensionUri, client)
    }),
  )
  context.subscriptions.push(
    commands.registerCommand('pomsky.compilation.cancel', () => {
      if (cancelCompilation) {
        const uri = cancelCompilation()
        client.sendRequest('handler/cancelCompile', { uri })
      }
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
    panel.reveal(defaultColumn, true)
  } else {
    panel = window.createWebviewPanel(
      viewType,
      'Pomsky',
      {
        viewColumn: defaultColumn,
        preserveFocus: true,
      },
      getWebviewOptions(extUri),
    )
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
  flavor?: Flavor
  compileResult?: CompileResult
  statusBarVersion?: StatusBarItem
  statusBarActivity?: StatusBarItem
}

function initPanel(context: PanelContext) {
  const disposables: Disposable[] = []

  const config = getDocumentSettings(context.document?.uri)
  context.panel.webview.html = getHtmlForWebview(config, context)
  updateContent(context, true)

  setPanelTitle(context)

  context.statusBarActivity = window.createStatusBarItem(StatusBarAlignment.Right)
  context.statusBarVersion = window.createStatusBarItem(StatusBarAlignment.Right)
  setStatusBarItemsActive(context)

  // Panel is disposed when the user closes the panel or when the panel is closed programmatically
  context.panel.onDidDispose(() => disposePanel(context, disposables), null, disposables)

  // Update the content based on view changes
  context.panel.onDidChangeViewState(
    () => {
      if (context.panel.visible) {
        updateContent(context)
      }
      setStatusBarItemsActive(context)
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
      if ('setFlavor' in message) {
        context.flavor = message.setFlavor
        updateContent(context, true)
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
    context.client.onNotification(
      'handler/compileResult',
      (result: CompileResultHandler | 'error') => {
        if (result === 'error') {
          context.panel.webview.postMessage({ setError: true } as Message)
          return
        }

        context.compileResult = {
          output: trimLength(result.output, 100_000),
          actualLength: result.output?.length,
          diagnostics: result.diagnostics,
          timings: result.timings,
        }

        context.panel.webview.postMessage({
          setState: {
            fileName: result.uri,
            content: context.content ?? '',
            compileResult: context.compileResult,
            flavor: result.flavor,
            versionInfo: result.versionInfo,
          },
        } satisfies Message)

        setStatusBarItems(context, result)

        cancelCompilation = () => 'global:'
      },
    ),
  )
}

function setStatusBarItemsActive(context: PanelContext) {
  if (context.statusBarVersion && context.statusBarActivity) {
    if (context.panel.active) {
      context.statusBarActivity.show()
      context.statusBarVersion.show()
    } else {
      context.statusBarActivity.hide()
      context.statusBarVersion.hide()
    }
  }
}

function setStatusBarItems(context: PanelContext, result: CompileResultHandler) {
  if (context.statusBarVersion && context.statusBarActivity) {
    const micros = result.timings.all
    const isSlow = micros > 100_000

    const hasErrors = result.diagnostics.some(d => d.severity === 'error')
    const hasWarnings = !hasErrors && result.diagnostics.length > 0
    const icon = isSlow || hasErrors || hasWarnings ? 'warning' : 'check'

    context.statusBarVersion.text = result.versionInfo.replace(/^pomsky/i, 'Pomsky')
    context.statusBarActivity.text = `$(${icon}) compiled in ${displayTime(micros)}`
    if (hasErrors) {
      context.statusBarActivity.tooltip = 'Pomsky found some errors during compilation!'
      context.statusBarActivity.backgroundColor = new ThemeColor('statusBarItem.errorBackground')
      context.statusBarActivity.command = {
        command: 'workbench.action.problems.focus',
        title: 'Show problems',
      }
    } else if (hasWarnings) {
      context.statusBarActivity.tooltip = 'Pomsky found some warnings during compilation!'
      context.statusBarActivity.backgroundColor = new ThemeColor('statusBarItem.warningBackground')
      context.statusBarActivity.command = {
        command: 'workbench.action.problems.focus',
        title: 'Show problems',
      }
    } else if (isSlow) {
      context.statusBarActivity.tooltip =
        'Compilation took longer than expected. Consider simplifying the expression.'
      context.statusBarActivity.backgroundColor = new ThemeColor('statusBarItem.warningBackground')
      context.statusBarActivity.command = undefined
    }
  }
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
  context.statusBarVersion?.dispose()
  context.statusBarActivity?.dispose()
}

function updateContent(context: PanelContext, forceRefresh = false) {
  if (!context.document) return

  const uri = context.document.uri
  const content = context.document.getText()

  if (content === context.content && !forceRefresh) {
    // avoid multiple updates when the file content didn't change
    return
  }
  context.content = content

  if (content !== undefined) {
    if (context.statusBarActivity) {
      context.statusBarActivity.text = '$(stop) compiling...'
      context.statusBarActivity.tooltip = 'click to abort'
      context.statusBarActivity.backgroundColor = undefined
      context.statusBarActivity.command = {
        command: 'pomsky.compilation.cancel',
        title: 'Cancel compilation',
        arguments: [`${uri.toString()}?preview`],
      }
    }

    context.client.sendRequest('handler/compile', {
      content,
      // Without the query parameter, some requests would be dropped, because a CLI process is
      // cancelled when a new process for the same URI is spawned. This causes problems because the
      // CLI is invoked for both diagnostics and the preview. This query parameter ensures they
      // don't interfere with one another
      uri: `${uri.toString()}?preview`,
      flavor: context.flavor,
    } satisfies CompileHandler)

    cancelCompilation = () => {
      if (context.statusBarActivity) {
        context.statusBarActivity.text = 'compilation aborted'
        context.statusBarActivity.tooltip = undefined
        context.statusBarActivity.backgroundColor = undefined
        context.statusBarActivity.command = undefined
      }
      return `${uri.toString()}?preview`
    }
  }
}

function getHtmlForWebview(config: Config, { extUri, panel: { webview } }: PanelContext) {
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
    <div id="header">
      Flavor:
      <select id="flavorSelect" value="${config.defaultFlavor}">
        <option value="JavaScript">JavaScript</option>
        <option value="Pcre">PCRE</option>
        <option value="Rust">Rust</option>
        <option value="Java">Java</option>
        <option value="DotNet">.NET</option>
        <option value="Python">Python</option>
        <option value="Ruby">Ruby</option>
      </select>
    </div>
    <pre id="pre"></pre>
    <details id="diagnostics"></details>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`
}

function trimLength(output: string | undefined, len: number) {
  if (output !== undefined) {
    return output.slice(0, len)
  }
}

function displayTime(micros: number): string {
  if (micros >= 1_000_000) {
    const secs = micros / 1_000_000
    if (secs < 9.5) {
      return `${secs.toFixed(1)} s`
    }

    let time = `${Math.round(secs % 60)} s`
    const mins = (secs / 60) | 0
    if (mins > 0) {
      time = `${mins} min ${time}`
    }
    return time
  } else if (micros >= 1000) {
    const millis = micros / 1000
    return `${millis >= 9.5 ? Math.round(millis) : millis.toFixed(1)} ms`
  } else {
    return `${(micros / 1000).toFixed(2)} ms`
  }
}
