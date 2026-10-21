import {
  App,
  FuzzySuggestModal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
// The Redacted Script weights, inlined as data URLs at build time
// (esbuild's dataurl loader), so the plugin ships as the standard
// three release files with the font inside main.js itself.
// Font by Christian Naths and contributors, SIL Open Font License;
// see font-files/OFL.txt in the repository.
import redactedLight from "./font-files/RedactedScript-Light.ttf";
import redactedRegular from "./font-files/RedactedScript-Regular.ttf";
import redactedBold from "./font-files/RedactedScript-Bold.ttf";

// A font entry is a full CSS font-family stack. The label shown in menus
// is derived from the first family in the stack.
interface FontSwapData {
  fonts: string[];
  // The stack currently applied, or null for the theme default.
  current: string | null;
}

// Kept alphabetical by label; the theme default is not an entry here,
// it always rides on top of the picker and the cycle separately.
const DEFAULT_FONTS: string[] = [
  '"Avenir Next", Avenir, "Segoe UI", sans-serif',
  'Charter, "Bitstream Charter", Georgia, serif',
  '"Comic Sans MS", "Comic Neue", cursive',
  'Georgia, "Times New Roman", serif',
  'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
  '"Iowan Old Style", Palatino, Georgia, serif',
  '"New York", ui-serif, Georgia, serif',
  // A scribble font for drafting: the words are there, but you cannot
  // read them back, so you keep writing instead of editing. The font
  // itself is Redacted Script (its Google Fonts name, SIL Open Font
  // License), bundled with the plugin and aliased to "Scribble" by
  // registerBundledFonts, which is the name shown everywhere. The real
  // family name stays in the stack so a system install also matches.
  '"Scribble", "Redacted Script", cursive',
];

export function fontLabel(stack: string): string {
  const first = stack.split(",")[0]?.trim() ?? stack;
  return first.replace(/^["']|["']$/g, "") || stack;
}

class FontPicker extends FuzzySuggestModal<string | null> {
  constructor(
    app: App,
    private fonts: string[],
    private choose: (stack: string | null) => void,
  ) {
    super(app);
    this.setPlaceholder("Pick a document font");
  }

  getItems(): (string | null)[] {
    return [null, ...this.fonts];
  }

  getItemText(item: string | null): string {
    return item === null ? "Theme default" : fontLabel(item);
  }

  onChooseItem(item: string | null): void {
    this.choose(item);
  }
}

export default class QuickFontSwap extends Plugin {
  data: FontSwapData = { fonts: [...DEFAULT_FONTS], current: null };
  private statusEl: HTMLElement | null = null;
  private fontStyleEl: HTMLStyleElement | null = null;

  async onload(): Promise<void> {
    const raw = (await this.loadData()) as Partial<FontSwapData> | null;
    if (raw) {
      if (Array.isArray(raw.fonts) && raw.fonts.length > 0) {
        this.data.fonts = raw.fonts.filter(
          (f): f is string => typeof f === "string" && f.trim() !== "",
        );
      }
      this.data.current =
        typeof raw.current === "string" ? raw.current : null;
    }

    this.registerBundledFonts();
    this.applyFont(this.data.current, false);

    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("quick-font-swap-status");
    this.statusEl.setAttr("aria-label", "Document font: click to cycle");
    this.statusEl.addEventListener("click", () => void this.cycle(1));
    this.refreshStatus();

    this.addCommand({
      id: "cycle-document-font",
      name: "Cycle document font",
      callback: () => void this.cycle(1),
    });
    this.addCommand({
      id: "cycle-document-font-back",
      name: "Cycle document font (backwards)",
      callback: () => void this.cycle(-1),
    });
    this.addCommand({
      id: "pick-document-font",
      name: "Pick document font...",
      callback: () => {
        new FontPicker(this.app, this.data.fonts, (stack) => {
          void this.setFont(stack, true);
        }).open();
      },
    });
    this.addCommand({
      id: "reset-document-font",
      name: "Reset document font to theme default",
      callback: () => void this.setFont(null, true),
    });
    this.registerFontCommands();

    this.addSettingTab(new FontSwapSettings(this.app, this));
  }

  onunload(): void {
    // Leave the chosen font in place? No: unloading the plugin should
    // hand the appearance back to the theme untouched.
    document.body.style.removeProperty("--font-text-theme");
    this.fontStyleEl?.remove();
    this.fontStyleEl = null;
  }

  // The bundled scribble font (Redacted Script, embedded in main.js at
  // build time) is registered with @font-face at load, so it works with
  // no system install and no extra files next to the plugin. It is
  // registered under its real family name and under the friendlier
  // alias "Scribble", which is what the font list calls it.
  private registerBundledFonts(): void {
    const bundled: [string, number][] = [
      [redactedLight, 300],
      [redactedRegular, 400],
      [redactedBold, 700],
    ];
    const rules: string[] = [];
    for (const [url, weight] of bundled) {
      for (const family of ["Redacted Script", "Scribble"]) {
        rules.push(
          `@font-face { font-family: "${family}"; ` +
            `src: url("${url}") format("truetype"); ` +
            `font-weight: ${weight}; font-display: swap; }`,
        );
      }
    }
    this.fontStyleEl = document.createElement("style");
    this.fontStyleEl.id = "quick-font-swap-bundled-fonts";
    this.fontStyleEl.textContent = rules.join("\n");
    document.head.appendChild(this.fontStyleEl);
  }

  // One command per font, so each can get its own hotkey in Obsidian's
  // Hotkeys settings. Re-registered when the list changes; commands
  // from a previous list that no longer exists simply disappear on
  // the next reload, which is acceptable for an edited list.
  private registerFontCommands(): void {
    this.data.fonts.forEach((stack, i) => {
      this.addCommand({
        id: `set-document-font-${i}`,
        name: `Set document font: ${fontLabel(stack)}`,
        callback: () => void this.setFont(stack, true),
      });
    });
  }

  async cycle(step: 1 | -1): Promise<void> {
    const list: (string | null)[] = [null, ...this.data.fonts];
    const idx = list.indexOf(this.data.current);
    const next = list[(idx + step + list.length) % list.length];
    await this.setFont(next, true);
  }

  async setFont(stack: string | null, announce: boolean): Promise<void> {
    this.data.current = stack;
    this.applyFont(stack, announce);
    this.refreshStatus();
    await this.saveData(this.data);
  }

  private applyFont(stack: string | null, announce: boolean): void {
    if (stack === null) {
      document.body.style.removeProperty("--font-text-theme");
      if (announce) new Notice("Document font: theme default");
    } else {
      document.body.style.setProperty("--font-text-theme", stack);
      if (announce) new Notice(`Document font: ${fontLabel(stack)}`);
    }
  }

  private refreshStatus(): void {
    if (!this.statusEl) return;
    const label =
      this.data.current === null
        ? "Theme default"
        : fontLabel(this.data.current);
    this.statusEl.setText(`Font: ${label}`);
  }

  async setFontList(fonts: string[]): Promise<void> {
    this.data.fonts = fonts;
    if (
      this.data.current !== null &&
      !this.data.fonts.includes(this.data.current)
    ) {
      this.data.current = null;
      this.applyFont(null, false);
    }
    this.refreshStatus();
    await this.saveData(this.data);
  }
}

class FontSwapSettings extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: QuickFontSwap,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Fonts")
      .setDesc(
        "One font per line, as a CSS font stack (for example: Georgia, \"Times New Roman\", serif). " +
          "The first name on each line is what menus and the status bar show. " +
          "Reordering lines changes the cycle order. Reload the plugin after editing to refresh the per-font commands.",
      )
      .addTextArea((ta) => {
        ta.setValue(this.plugin.data.fonts.join("\n"));
        ta.inputEl.rows = 8;
        ta.inputEl.cols = 48;
        ta.onChange(async (value) => {
          const fonts = value
            .split("\n")
            .map((f) => f.trim())
            .filter((f) => f !== "");
          if (fonts.length > 0) await this.plugin.setFontList(fonts);
        });
      });

    new Setting(containerEl)
      .setName("Current font")
      .setDesc(
        this.plugin.data.current === null
          ? "Theme default"
          : fontLabel(this.plugin.data.current),
      )
      .addButton((b) => {
        b.setButtonText("Reset to theme default");
        b.onClick(async () => {
          await this.plugin.setFont(null, true);
          this.display();
        });
      });
  }
}
