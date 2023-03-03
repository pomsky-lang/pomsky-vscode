"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('pomsky.openPreview', () => {
        PomskyPreviewPanel.createOrShow(context.extensionUri);
    }));
    if (vscode.window.registerWebviewPanelSerializer) {
        // Make sure we register a serializer in activation event
        vscode.window.registerWebviewPanelSerializer(PomskyPreviewPanel.viewType, {
            async deserializeWebviewPanel(webviewPanel, state) {
                console.log(`Got state: ${state}`);
                // Reset the webview options so we use latest uri for `localResourceRoots`.
                webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
                PomskyPreviewPanel.revive(webviewPanel, context.extensionUri);
            },
        });
    }
}
exports.activate = activate;
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
    };
}
class PomskyPreviewPanel {
    static createOrShow(extensionUri) {
        // If we already have a panel, show it.
        if (PomskyPreviewPanel.currentPanel) {
            PomskyPreviewPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(PomskyPreviewPanel.viewType, 'Compiled RegExp', vscode.ViewColumn.Beside, getWebviewOptions(extensionUri));
        PomskyPreviewPanel.currentPanel = new PomskyPreviewPanel(panel, extensionUri);
    }
    static revive(panel, extensionUri) {
        PomskyPreviewPanel.currentPanel = new PomskyPreviewPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Set the webview's initial html content
        this._update();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Update the content based on view changes
        this._panel.onDidChangeViewState(() => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showErrorMessage(message.text);
                    return;
            }
        }, null, this._disposables);
    }
    _update() {
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }
    dispose() {
        PomskyPreviewPanel.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _getHtmlForWebview(webview) {
        // Local path to main script run in the webview
        const scriptPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'script.js');
        // Local path to css styles
        const stylePath = vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css');
        // Uri to load styles into webview
        const scriptUri = webview.asWebviewUri(scriptPath);
        const stylesUri = webview.asWebviewUri(stylePath);
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesUri}" rel="stylesheet">
				<title>Cat Coding</title>
			</head>
			<body>
				<h1>Hello Pomsky</h1>
        <script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
PomskyPreviewPanel.viewType = 'pomsky.preview';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=extension.js.map