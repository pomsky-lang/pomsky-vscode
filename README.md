<div align="center">

![Logo](./media/icon.png)

# pomsky-vscode

</div>

The official extension for the [Pomsky](https://pomsky-lang.org) regular expression language. It is
still in development and incomplete; expect some bugs.

## Features

- Syntax highlighting
- Live preview of compiled expression
  - Right-click and select `Open compiled RegExp on the right` or click the icon in the top right
    corner

Missing IDE features:

- Autocomplete
- Highlight errors/warnings directly in the source code (you can see them in the live preview for
  now)
- Go to definition / find usages / rename variable
- Code formatting
- Extend selection
- Documentation tooltips
- Quick fixes

Missing Regex-specific features:

- Select regex flavor
- Find and replace

If you need a feature not yet provided by this extension, check out the
[playground](https://playground.pomsky-lang.org/). It is more feature-complete at this point.

## Requirements

You need to have the `pomsky` executable installed locally. Get it from the
[Releases](https://github.com/pomsky-lang/pomsky/releases) page, move it to a folder that's in your
PATH, and rename it to `pomsky`.

In the future we'll add a setting to specify a path to the executable. We might also embed an
executable compiled to WASM, so no setup is needed.

## Extension Settings

There aren't any settings yet. If you need something to be configurable, please
[open an issue](https://github.com/pomsky-lang/pomsky-vscode/issues).

<!--
## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

-->
