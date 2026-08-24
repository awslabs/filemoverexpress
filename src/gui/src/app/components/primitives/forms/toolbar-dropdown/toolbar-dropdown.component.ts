import { ChangeDetectionStrategy, Component, inject, Input, Renderer2 } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/list';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { ConfigComponent } from '@containers/forms/config/config.component';
import { isPackagedApp } from '@app/utils/utils';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { strSupportFileComplete } from './toolbar-dropdown.constants';
import { docsLinks } from '@app/constants/external-links';
import { WailsService } from '@services/wails/wails.service';

@Component({
    selector: 'fme-toolbar-dropdown',
    templateUrl: './toolbar-dropdown.component.html',
    styleUrls: ['./toolbar-dropdown.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatMenu,
        MatIconButton,
        MatMenuTrigger,
        MatIcon,
        MatMenuItem,
        MatDivider,
    ],
})
export class ToolbarDropdownComponent {
    fmeClientService = inject(FmeClientService);
    private renderer = inject(Renderer2);
    private notifications = inject(NotificationsService);
    private wails = inject(WailsService);
    private dialog = inject(MatDialog);

    @Input() version = '';
    @Input() connected = false;
    @Input() allowUiConfiguration = false;

    /**
     * Open Settings as a modal over the app (instead of navigating to the full-page
     * /home/config route, which blacked out the whole window). ConfigComponent detects
     * the dialog host and closes itself on Save/Cancel.
     */
    openSettings() {
        if (!this.connected || !this.allowUiConfiguration) {
            return;
        }
        this.dialog.open(ConfigComponent, {
            width: '60%',
            maxWidth: '900px',
            minHeight: '40vh',
            maxHeight: '85%',
            autoFocus: 'dialog',
            panelClass: 'settings-dialog',
        });
    }

    generateSupportFile() {
        this.fmeClientService.generateSupportFile().subscribe({
            next: (result) => {
                if (!result.success) {
                    this.notifications.error(result.error);
                    return;
                }
                if (isPackagedApp()) {
                    // The packaged Wails webview ignores anchor / `data:` URL downloads, but the
                    // daemon has already written the .zip to disk. Reveal it in the OS file manager
                    // and tell the user where it was saved. See issue #14.
                    this.wails.systemShowItemInFolder(this.joinPath(result.outputDir, result.filename)).subscribe();
                    this.notifications.success(`${strSupportFileComplete}. Saved to ${result.outputDir}`);
                    return;
                }
                // Dev / browser mode: the anchor `data:` URL download works here.
                this.notifications.success(strSupportFileComplete);
                const link = this.renderer.createElement('a');
                link.href = `data:application/zip;base64,${result.data}`;
                link.download = result.filename;
                link.click();
                link.remove();
            },
            error: (error) => {
                this.notifications.error(error);
                console.error(error);
            },
        });
    }

    /**
     * Joins a directory and file name using the directory's native path separator
     * (Windows paths use a backslash, POSIX paths use a forward slash).
     */
    private joinPath(directory: string, filename: string): string {
        // The daemon returns an absolute OS-native directory, so we infer the separator
        // from it (backslash on Windows, otherwise forward slash). A separator-less
        // relative path would default to '/', but that case shouldn't occur here.
        const separator = directory.includes('\\') ? '\\' : '/';
        const trimmedDirectory = directory.replace(/[/\\]+$/, '');
        return `${trimmedDirectory}${separator}${filename}`;
    }

    getSupport() {
        if (isPackagedApp()) {
            this.wails.externalLink(docsLinks.USER_GUIDE_PAGE_URL).subscribe();
        }
    }
}
