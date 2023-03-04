"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activatePanel = void 0;
const vscode_1 = require("vscode");
const nonce_1 = require("./nonce");
const singleton_1 = require("./singleton");
const pomskyCli_1 = require("./pomskyCli");
function activatePanel(context) {
    context.subscriptions.push(vscode_1.commands.registerCommand('pomsky.openPreview', () => {
        panelSingleton.getOrInit(context.extensionUri);
    }));
    if (vscode_1.window.registerWebviewPanelSerializer) {
        vscode_1.window.registerWebviewPanelSerializer(viewType, {
            async deserializeWebviewPanel(webviewPanel, state) {
                console.log(`Got state:`, state);
                // Reset the webview options so we use latest uri for `localResourceRoots`.
                webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
                panelSingleton.dispose();
                panelSingleton.getOrInit(context.extensionUri, webviewPanel);
            },
        });
    }
}
exports.activatePanel = activatePanel;
const viewType = 'pomsky.preview';
const defaultColumn = vscode_1.ViewColumn.Beside;
const panelSingleton = (0, singleton_1.singleton)((extUri, panel) => {
    if (panel) {
        panel.reveal(defaultColumn);
    }
    else {
        panel = vscode_1.window.createWebviewPanel(viewType, 'Pomsky', defaultColumn, getWebviewOptions(extUri));
    }
    initPanel({
        extUri,
        panel,
        document: vscode_1.window.activeTextEditor?.document,
    });
    return panel;
});
const getWebviewOptions = (extUri) => ({
    enableScripts: true,
    // restrict webview to only loading content from our extension's `media` directory
    localResourceRoots: [vscode_1.Uri.joinPath(extUri, 'media')],
});
function initPanel(context) {
    const disposables = [];
    updatePanel(context);
    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    context.panel.onDidDispose(() => {
        context.panel.dispose();
        disposables.forEach(d => d.dispose());
        disposables.length = 0;
        panelSingleton.dispose();
    }, null, disposables);
    // Update the content based on view changes
    context.panel.onDidChangeViewState(() => {
        if (context.panel.visible) {
            updatePanel(context);
        }
    }, null, disposables);
    // Handle messages from the webview
    context.panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'alert':
                vscode_1.window.showErrorMessage(message.text);
                return;
        }
    }, null, disposables);
    vscode_1.workspace.onDidChangeTextDocument(event => {
        if (event.document.fileName === context.document?.fileName) {
            updateContent(context);
        }
    }, null, disposables);
    if (context.document) {
        const { path } = context.document.uri;
        const lastSlash = path.replace(/\/+$/, '').lastIndexOf('/');
        const fileName = path.slice(lastSlash + 1);
        context.panel.title = `Pomsky [${fileName}]`;
    }
    else {
        context.panel.title = `Pomsky`;
    }
}
function updatePanel(context) {
    context.panel.webview.html = getHtmlForWebview(context);
    updateContent(context);
}
function updateContent(context) {
    const fileName = context.document?.fileName;
    context.content = context.document?.getText();
    if (context.content !== undefined) {
        (0, pomskyCli_1.runPomsky)('js', context.content)
            .then(res => {
            context.compileResult = {
                output: res.output,
                diagnostics: res.diagnostics,
                timings: res.timings,
            };
        }, (e) => {
            context.compileResult = { exeError: e.message };
        })
            .finally(() => {
            context.panel.webview.postMessage({
                setState: {
                    fileName,
                    content: context.content,
                    compileResult: context.compileResult,
                },
            });
        });
    }
}
function getHtmlForWebview({ extUri, panel: { webview } }) {
    const scriptPath = vscode_1.Uri.joinPath(extUri, 'media', 'script.js');
    const stylePath = vscode_1.Uri.joinPath(extUri, 'media', 'style.css');
    const scriptUri = webview.asWebviewUri(scriptPath);
    const stylesUri = webview.asWebviewUri(stylePath);
    const nonce = (0, nonce_1.getNonce)();
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

    <div id="warnings"></div>
    <pre id="diagnostics"></pre>

    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`;
}
//# sourceMappingURL=previewPanel.js.map