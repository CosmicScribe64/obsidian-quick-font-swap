# Quick Font Swap

An Obsidian plugin that changes the font your notes are shown in. Swap fonts without opening settings.

## Swap fonts

- Bind "Cycle document font" under Settings, Hotkeys, and press it to step to the next font. A backwards cycle exists too.
- Run "Pick document font..." from the command palette and choose from a list.
- Click the font name in the status bar to cycle.
- Give a favourite its own hotkey. Each font gets a "Set document font" command.

Reading view and editing view both change. The plugin remembers your pick across restarts.

## The fonts

The cycle starts at your theme's default font, then runs alphabetically: Avenir Next, Charter, Comic Sans MS, Georgia, Inter, Iowan Old Style, New York, Scribble.

Scribble makes your words unreadable on purpose, so you draft without stopping to edit. The font is Redacted Script by Christian Naths. It ships inside the plugin, so there is nothing to install.

Edit the list under Settings, Quick Font Swap. One line per font, written as a CSS font stack:

    Georgia, "Times New Roman", serif

The first name on a line is the label the menus show. If that font is missing on a machine, the next name in the stack is used instead.

## Install

On this repository's main page, click Code, then Download ZIP. Unzip it. Copy main.js, manifest.json, and styles.css into your vault at .obsidian/plugins/quick-font-swap/. You may need to create that folder first. Then turn the plugin on under Settings, Community plugins.

To build from source instead, run `npm install`, then `npm run build`.

## License

The plugin code is MIT; see LICENSE. The bundled font is under the SIL Open Font License 1.1; see font-files/OFL.txt.
