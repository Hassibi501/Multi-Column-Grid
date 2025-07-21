function logUnknownError(e: unknown, context: string) {
    if (e instanceof Error) console.error(`${context}:`, e.message);
    else console.error(`${context}:`, String(e));
}

import {
    Plugin,
    MarkdownPostProcessorContext,
    Editor,
    MarkdownView,
    MarkdownRenderer,
    Component,
    MarkdownFileInfo,
    Notice,
} from "obsidian";

interface GridSettings {
    columns: number;
    rows: number;
    showBorders: boolean;
    cellHeight?: string;
    dynamicHeight?: boolean;
    invisibleMode?: boolean;
    colWidths?: string;
    rowHeights?: string;
}

interface GridCell {
    id: string;
    content: string;
    row: number;
    column: number;
}

export default class MultiColumnGridPlugin extends Plugin {
    private globalInvisible = false;

    async onload() {
        console.log("Multi-Column Grid Plugin loaded successfully");

        /* ---------- render blocks ---------- */
        this.registerMarkdownPostProcessor(
            (el: HTMLElement, ctx: MarkdownPostProcessorContext) =>
                this.processBlocks(el, ctx),
            1000,
        );

        /* ---------- ONLY dynamic template commands ---------- */
        this.addCommand({
            id: "insert-dynamic-2col",
            name: "Insert Dynamic 2-Column Grid",
            editorCallback: (ed: Editor) =>
                ed.replaceSelection(this.makeTemplate(2, 6, true)),
        });
        
        this.addCommand({
            id: "insert-dynamic-3col", 
            name: "Insert Dynamic 3-Column Grid",
            editorCallback: (ed: Editor) =>
                ed.replaceSelection(this.makeTemplate(3, 6, true)),
        });

        /* ---------- invisible-mode toggle ---------- */
        this.addCommand({
            id: "toggle-grid-invisible",
            name: "Toggle Global Invisible Mode",
            callback: () => {
                this.globalInvisible = !this.globalInvisible;
                document.body.classList.toggle(
                    "grid-global-invisible",
                    this.globalInvisible,
                );
                new Notice(
                    `Grid invisible mode ${this.globalInvisible ? "ON" : "OFF"}`,
                );
            },
        });
    }

    onunload() {
        document.body.classList.remove("grid-global-invisible");
        console.log("Multi-Column Grid Plugin unloaded");
    }

    /* ────────── parsing & rendering ────────── */

    private processBlocks(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        el.querySelectorAll("pre > code").forEach(code => {
            const txt = code.textContent ?? "";
            if (txt.includes("=== start-grid:"))
                this.renderGrid(code.parentElement as HTMLElement, txt, ctx);
        });
    }

    private async renderGrid(
        pre: HTMLElement,
        src: string,
        ctx: MarkdownPostProcessorContext,
    ) {
        try {
            const { settings, cells } = this.parse(src);
            const grid = this.buildGrid(settings, cells);
            pre.replaceWith(grid);

            for (const cell of cells) {
                const target = grid.querySelector(
                    `[data-cell='${cell.id}']`,
                ) as HTMLElement;
                if (!target) continue;
                await MarkdownRenderer.renderMarkdown(
                    cell.content,
                    target,
                    ctx.sourcePath,
                    new Component(),
                );
                this.fixImages(target, settings.columns);
            }
        } catch (e) {
            logUnknownError(e, "renderGrid");
        }
    }

    /* ────────── helpers ────────── */

    private parse(src: string): { settings: GridSettings; cells: GridCell[] } {
        const s: GridSettings = {
            columns: 2,
            rows: 2,
            showBorders: true,
            dynamicHeight: true, // default to dynamic
        };
        const cells: GridCell[] = [];
        let cur: GridCell | null = null,
            inSettings = false,
            buf: string[] = [];

        for (const raw of src.split("\n")) {
            const line = raw.trim();

            if (line === "grid-settings") {
                inSettings = true;
                continue;
            }
            if (inSettings && line === "") {
                inSettings = false;
                continue;
            }
            if (inSettings) {
                const [k, v] = line.split(":").map(t => t.trim());
                switch (k) {
                    case "columns":
                        s.columns = Number(v) || 2;
                        break;
                    case "rows":
                        s.rows = Number(v) || 2;
                        break;
                    case "show-borders":
                        s.showBorders = v === "true";
                        break;
                    case "cell-height":
                        s.cellHeight = v;
                        break;
                    case "dynamic-height":
                        s.dynamicHeight = v === "true";
                        break;
                    case "invisible-mode":
                        s.invisibleMode = v === "true";
                        break;
                    case "col-widths":
                        s.colWidths = v;
                        break;
                    case "row-heights":
                        s.rowHeights = v;
                        break;
                }
                continue;
            }

            const m = line.match(/^=== cell ([A-Z]\d+) ===$/);
            if (m) {
                if (cur) {
                    cur.content = buf.join("\n").trim();
                    cells.push(cur);
                    buf = [];
                }
                const id = m[1];
                cur = {
                    id,
                    row: Number(id.slice(1)) - 1,
                    column: id.charCodeAt(0) - 65,
                    content: "",
                };
                continue;
            }

            if (line.startsWith("=== start-grid:") || line === "=== end-grid")
                continue;
            if (cur) buf.push(raw);
        }
        if (cur) {
            cur.content = buf.join("\n").trim();
            cells.push(cur);
        }
        return { settings: s, cells };
    }

    private buildGrid(s: GridSettings, cells: GridCell[]): HTMLElement {
        const c = document.createElement("div");
        c.className = "grid-container" +
            (s.showBorders ? "" : " no-borders") +
            (s.dynamicHeight ? " dynamic-height" : "") +
            (s.invisibleMode ? " invisible-mode" : "") +
            ` grid-cols-${s.columns}`; // Add column-specific class

        c.style.setProperty("--grid-cols", String(s.columns));
        c.style.setProperty("--grid-rows", String(s.rows));

        // Set smart column widths that prevent overflow
        if (s.colWidths) {
            c.style.gridTemplateColumns = s.colWidths;
        } else {
            // Default: flexible but bounded columns
            c.style.gridTemplateColumns = `repeat(${s.columns}, minmax(0, 1fr))`;
        }

        if (s.rowHeights) {
            c.style.gridTemplateRows = s.rowHeights;
        } else if (s.dynamicHeight) {
            c.style.gridTemplateRows = `repeat(${s.rows}, minmax(min-content, max-content))`;
        } else if (s.cellHeight) {
            c.style.setProperty("--cell-height", s.cellHeight);
        }

        for (let r = 0; r < s.rows; r++)
            for (let col = 0; col < s.columns; col++) {
                const id = String.fromCharCode(65 + col) + (r + 1);
                const d = document.createElement("div");
                d.className = "grid-cell";
                d.dataset.cell = id;
                d.style.gridRow = String(r + 1);
                d.style.gridColumn = String(col + 1);
                if (!cells.find(v => v.id === id))
                    d.innerHTML = `<div class="grid-cell-placeholder"></div>`;
                c.append(d);
            }
        return c;
    }

    private fixImages(container: HTMLElement, columns: number) {
        container.querySelectorAll("img").forEach(img => {
            img.addClass("grid-cell-image");
            
            // Apply column-specific sizing
            if (columns === 2) {
                img.addClass("grid-img-2col");
            } else if (columns === 3) {
                img.addClass("grid-img-3col");
            }
            
            img.onerror = () => {
                img.style.display = "none";
                const badge = document.createElement("div");
                badge.className = "grid-image-error";
                badge.textContent = "🖼️ Image not found";
                img.parentElement?.append(badge);
            };
        });
    }

    /* ────────── template generator ────────── */
private makeTemplate(cols: number, rows: number, dyn = false): string {
    const hSetting = dyn ? "dynamic-height: true" : "cell-height: 120px";
    const id = Date.now();
    let out = "```\n";  // Fixed: properly terminated string with newline
    out += `=== start-grid: ID_${id}\n\n`;
    out += `grid-settings\n`;
    out += `columns: ${cols}\nrows: ${rows}\nshow-borders: true\n${hSetting}\n\n`;
    for (let r = 1; r <= rows; r++)
        for (let c = 0; c < cols; c++) {
            const cellId = String.fromCharCode(65 + c) + r;
            out += `=== cell ${cellId} ===\n`;
            out += `<!-- start of ${cellId} -->\n`;
            out += `Content for ${cellId}\n`;
            out += `<!-- end of ${cellId} -->\n\n`;
        }
    return out + "=== end-grid\n```"
}

}
