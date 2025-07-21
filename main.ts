import { App, Editor, MarkdownView, Modal, Notice, Plugin, Menu } from 'obsidian';

export default class ImageContextMenu extends Plugin {
    async onload() {
        console.log('Loading Image Context Menu plugin');

        // Register context menu event for images
        this.registerDomEvent(document, 'contextmenu', (evt: MouseEvent) => {
            const target = evt.target as HTMLElement;
            
            // Check if right-clicked element is an image
            if (target.tagName === 'IMG') {
                evt.preventDefault();
                this.showImageContextMenu(evt, target);
            }
        });
    }

    private showImageContextMenu(event: MouseEvent, imgElement: HTMLElement) {
        const menu = new Menu();

        // Position submenu
        menu.addItem((item) => {
            item
                .setTitle("📍 Float Left")
                .onClick(() => {
                    this.applyImagePosition(imgElement, 'float-left');
                    new Notice('Image positioned left');
                });
        });

        menu.addItem((item) => {
            item
                .setTitle("📍 Float Right")
                .onClick(() => {
                    this.applyImagePosition(imgElement, 'float-right');
                    new Notice('Image positioned right');
                });
        });

        menu.addItem((item) => {
            item
                .setTitle("🎯 Center Image")
                .onClick(() => {
                    this.applyImagePosition(imgElement, 'center');
                    new Notice('Image centered');
                });
        });

        menu.addSeparator();

        // Size submenu
        menu.addItem((item) => {
            item
                .setTitle("🔍 Small")
                .onClick(() => {
                    this.applyImageSize(imgElement, 'small');
                    new Notice('Image resized to small');
                });
        });

        menu.addItem((item) => {
            item
                .setTitle("⚖️ Medium")
                .onClick(() => {
                    this.applyImageSize(imgElement, 'medium');
                    new Notice('Image resized to medium');
                });
        });

        menu.addItem((item) => {
            item
                .setTitle("📏 Large")
                .onClick(() => {
                    this.applyImageSize(imgElement, 'large');
                    new Notice('Image resized to large');
                });
        });

        menu.addSeparator();

        menu.addItem((item) => {
            item
                .setTitle("🔄 Clear Positioning")
                .onClick(() => {
                    this.clearImageStyles(imgElement);
                    new Notice('Image styling cleared');
                });
        });

        menu.showAtMouseEvent(event);
    }

    private applyImagePosition(imgElement: HTMLElement, position: string) {
        // Find the actual markdown source and update it
        this.updateImageMarkdownInEditor(imgElement, position, null);
    }

    private applyImageSize(imgElement: HTMLElement, size: string) {
        // Find the actual markdown source and update it
        this.updateImageMarkdownInEditor(imgElement, null, size);
    }

    private clearImageStyles(imgElement: HTMLElement) {
        // Clear all positioning by removing modifiers from markdown
        this.updateImageMarkdownInEditor(imgElement, 'clear', null);
    }

    private updateImageMarkdownInEditor(imgElement: HTMLElement, position: string | null, size: string | null) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;
        const cursor = editor.getCursor();
        
        // Get the current line
        const currentLine = editor.getLine(cursor.line);
        
        // Look for image syntax in current line or nearby lines
        const imageRegex = /!\[\[([^\]]*)\]\]/g;
        let match;
        let foundImage = false;
        
        // Check current line and a few lines around cursor
        for (let i = Math.max(0, cursor.line - 2); i <= Math.min(editor.lastLine(), cursor.line + 2); i++) {
            const line = editor.getLine(i);
            imageRegex.lastIndex = 0;
            
            while ((match = imageRegex.exec(line)) !== null) {
                const fullMatch = match[0];
                const innerContent = match[1];
                
                // Parse existing modifiers
                let parts = innerContent.split('|');
                let filename = parts[0];
                let modifiers = parts.slice(1);
                
                // Remove existing position and size modifiers
                modifiers = modifiers.filter(mod => 
                    !['left', 'right', 'center', 'float-left', 'float-right', 'small', 'medium', 'large'].includes(mod.trim())
                );
                
                // Add new position modifier
                if (position && position !== 'clear') {
                    modifiers.push(position);
                }
                
                // Add new size modifier
                if (size) {
                    modifiers.push(size);
                }
                
                // Reconstruct the image syntax
                let newImageSyntax;
                if (modifiers.length > 0) {
                    newImageSyntax = `![[${filename}|${modifiers.join('|')}]]`;
                } else {
                    newImageSyntax = `![[${filename}]]`;
                }
                
                // Replace in the line
                const newLine = line.replace(fullMatch, newImageSyntax);
                editor.setLine(i, newLine);
                
                foundImage = true;
                break;
            }
            
            if (foundImage) break;
        }
        
        if (!foundImage) {
            new Notice('Could not find image to modify');
        }
    }

    onunload() {
        console.log('Unloading Image Context Menu plugin');
    }
}
