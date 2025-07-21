import { 
    Plugin, 
    MarkdownPostProcessorContext, 
    Editor, 
    MarkdownView, 
    MarkdownRenderer, 
    Component,
    MarkdownFileInfo 
} from 'obsidian';

interface GridSettings {
    columns: number;
    rows: number;
    showBorders: boolean;
    cellHeight?: string;
}

interface GridCell {
    id: string;
    content: string;
    row: number;
    column: number;
}

export default class MultiColumnGridPlugin extends Plugin {
    
    async onload() {
        console.log('Loading Multi-Column Grid Plugin');
        
        // Register markdown post processor for reading mode
        this.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {
            this.processGridBlocks(element, context);
        });
        
        // Add command to insert grid template
        this.addCommand({
            id: 'insert-grid-template',
            name: 'Insert Grid Template',
            editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
                const template = this.getGridTemplate(3, 2);
                editor.replaceSelection(template);
            }
        });
    }

    onunload() {
        console.log('Unloading Multi-Column Grid Plugin');
    }

    private processGridBlocks(element: HTMLElement, context: MarkdownPostProcessorContext) {
        const codeBlocks = element.querySelectorAll('pre > code');
        
        codeBlocks.forEach((codeBlock) => {
            const content = codeBlock.textContent || '';
            
            // Look for grid blocks
            if (content.includes('=== start-grid:')) {
                this.renderGrid(codeBlock.parentElement as HTMLElement, content, context);
            }
        });
    }

    private renderGrid(preElement: HTMLElement, content: string, context: MarkdownPostProcessorContext) {
        try {
            const gridData = this.parseGridContent(content);
            if (!gridData) return;

            const gridContainer = this.createGridHTML(gridData);
            preElement.replaceWith(gridContainer);
            
            // Render markdown content in each cell
            gridData.cells.forEach((cell) => {
                const cellElement = gridContainer.querySelector(`[data-cell="${cell.id}"]`) as HTMLElement;
                if (cellElement && cell.content.trim()) {
                    MarkdownRenderer.renderMarkdown(
                        cell.content,
                        cellElement,
                        context.sourcePath,
                        new Component()
                    );
                }
            });
            
        } catch (error) {
            console.error('Error rendering grid:', error);
        }
    }

    private parseGridContent(content: string): { settings: GridSettings; cells: GridCell[] } | null {
        const lines = content.split('\n');
        let settings: GridSettings = { columns: 2, rows: 2, showBorders: true };
        const cells: GridCell[] = [];
        
        let currentCell: GridCell | null = null;
        let inSettings = false;
        let cellContent: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Parse settings section
            if (trimmed === 'grid-settings') {
                inSettings = true;
                continue;
            }
            
            if (inSettings && trimmed === '') {
                inSettings = false;
                continue;
            }
            
            if (inSettings) {
                if (trimmed.startsWith('columns:')) {
                    settings.columns = parseInt(trimmed.split(':')[1].trim()) || 2;
                } else if (trimmed.startsWith('rows:')) {
                    settings.rows = parseInt(trimmed.split(':')[1].trim()) || 2;
                } else if (trimmed.startsWith('show-borders:')) {
                    settings.showBorders = trimmed.split(':')[1].trim() === 'true';
                } else if (trimmed.startsWith('cell-height:')) {
                    settings.cellHeight = trimmed.split(':')[1].trim();
                }
                continue;
            }
            
            // Parse cell blocks
            const cellMatch = trimmed.match(/^=== cell ([A-Z]\d+) ===$/);
            if (cellMatch) {
                // Save previous cell
                if (currentCell) {
                    currentCell.content = cellContent.join('\n').trim();
                    cells.push(currentCell);
                    cellContent = [];
                }
                
                // Start new cell
                const cellId = cellMatch[1];
                const column = cellId.charCodeAt(0) - 'A'.charCodeAt(0);
                const row = parseInt(cellId.substring(1)) - 1;
                
                currentCell = {
                    id: cellId,
                    content: '',
                    row,
                    column
                };
                continue;
            }
            
            // Skip grid control lines
            if (trimmed.startsWith('=== start-grid:') || trimmed === '=== end-grid') {
                continue;
            }
            
            // Collect cell content
            if (currentCell) {
                cellContent.push(line);
            }
        }
        
        // Save last cell
        if (currentCell) {
            currentCell.content = cellContent.join('\n').trim();
            cells.push(currentCell);
        }
        
        return { settings, cells };
    }

    private createGridHTML(gridData: { settings: GridSettings; cells: GridCell[] }): HTMLElement {
        const { settings, cells } = gridData;
        
        const container = document.createElement('div');
        container.className = `grid-container ${settings.showBorders ? '' : 'no-borders'}`;
        container.style.setProperty('--grid-cols', settings.columns.toString());
        container.style.setProperty('--grid-rows', settings.rows.toString());
        
        if (settings.cellHeight) {
            container.style.setProperty('--cell-height', settings.cellHeight);
        }
        
        // Create all grid cells
        for (let row = 0; row < settings.rows; row++) {
            for (let col = 0; col < settings.columns; col++) {
                const cellElement = document.createElement('div');
                cellElement.className = 'grid-cell';
                
                const cellId = String.fromCharCode('A'.charCodeAt(0) + col) + (row + 1);
                cellElement.setAttribute('data-cell', cellId);
                cellElement.style.gridRow = (row + 1).toString();
                cellElement.style.gridColumn = (col + 1).toString();
                
                // Find content for this cell
                const cellData = cells.find(cell => cell.id === cellId);
                if (!cellData || !cellData.content.trim()) {
                    cellElement.innerHTML = '<div class="grid-cell-placeholder"></div>';
                }
                
                container.appendChild(cellElement);
            }
        }
        
        return container;
    }

    private getGridTemplate(columns: number, rows: number): string {
        let template = `\`\`\`
=== start-grid: ID_${Date.now()}

grid-settings
columns: ${columns}
rows: ${rows}
show-borders: true
cell-height: 120px

`;
        
        // Add sample cells
        for (let row = 1; row <= rows; row++) {
            for (let col = 0; col < columns; col++) {
                const cellId = String.fromCharCode('A'.charCodeAt(0) + col) + row;
                template += `=== cell ${cellId} ===\n<!-- Content for ${cellId} -->\n\n`;
            }
        }
        
        template += '=== end-grid\n```'
        return template;
    }
}
