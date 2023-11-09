<div align="center">

![Logo](./media/icon.png)

# pomsky-vscode

</div>

The official extension for the [Pomsky](https://pomsky-lang.org) regular expression language. It is
still in development and lacks some features.

## Features

- Syntax highlighting
- Underlined errors and warnings
- Auto-completion of variables and character classes
- Running tests (enable with the `pomsky.runTests`) configuration
- Live preview of compiled expression
  - Right-click and select `Open compiled RegExp on the right` or click the icon in the top right
    corner
- Hover tooltips for keywords and built-ins
- Embedded syntax highlighting in Markdown code blocks

Missing IDE features:

- Go to definition / find usages / rename variable
- Code formatting
- Extend selection
- Quick fixes
- Compiled Regex: find and replace

## Requirements

You need to have the `pomsky` executable installed locally. Get it from the
[Releases](https://github.com/pomsky-lang/pomsky/releases) page. Then you need to either

- go to the settings, search for `pomsky.exePath` and enter the path to the executable, _or_

- rename the executable to `pomsky` and move it to `/usr/bin` or `~/.cargo/bin` so it can be
  detected automatically

In the future we'll add a setting to specify a path to the executable. We might also embed an
executable compiled to WASM, so no setup is needed.

## Extension Settings

The following configurations are available:

- `pomsky.defaultFlavor`: Specifies the default regex flavor

- `pomsky.runTests`: Enable to conveniently run tests and see test failures on every change

- `pomsky.executable.path`: Points to the Pomsky executable

- `pomsky.executable.extraArgs`: Additional arguments to pass to `pomsky`. For example, setting it
  to `-Wcompat=0` disables compatibility warnings.

## Issues

This extension is an alpha stage, so expect some bugs. Please report any problems you encounter
[here](https://github.com/pomsky-lang/pomsky-vscode/issues)!
