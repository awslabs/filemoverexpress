import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { isLocalDaemon } from '@services/bookmarks/bookmarks.utils';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { WailsService } from '@services/wails/wails.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { combineLatest, map } from 'rxjs';

/**
 * A small "Browse…" affordance (folder icon) intended to sit as a `matSuffix` on a path
 * input. Clicking it opens a NATIVE OS file/folder picker (via the Wails bridge) and emits
 * the chosen absolute path through `pathPicked`, which the host wires back into its form
 * control.
 *
 * It renders ONLY when the active daemon is local (connected AND the current bookmark's host
 * is loopback). The native dialog browses the GUI host's filesystem, which is the daemon's
 * filesystem only for a local daemon; for a remote daemon the picked path would be
 * meaningless, so the affordance hides itself and the field stays manually editable
 * (remote/S3 in-app browsing is tracked separately in GitHub issue #123).
 */
@Component({
    selector: 'fme-browse-button',
    templateUrl: './browse-button.component.html',
    styleUrls: ['./browse-button.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatIconButton,
        MatIcon,
        MatTooltip,
    ],
})
export class BrowseButtonComponent {
    private wails = inject(WailsService);
    private bookmarks = inject(BookmarksService);
    private fmeClientService = inject(FmeClientService);

    /** 'directory' picks a folder (default); 'file' picks a single file. */
    mode = input<'directory' | 'file'>('directory');
    /** Native dialog window title. */
    dialogTitle = input<string>('Choose a location');
    /** Seeds the dialog's starting directory (typically the field's current value). */
    startPath = input<string>('');
    /** Optional file-type filter display name (file mode only), e.g. 'PEM certificate'. */
    fileFilterName = input<string>('');
    /** Optional file-type filter glob (file mode only), e.g. '*.pem'. */
    fileFilterPattern = input<string>('');
    /** Hover tooltip / aria-label for the icon button. */
    tooltip = input<string>('Browse…');

    /** Emits the chosen absolute path. Never emits on cancel (empty selection). */
    pathPicked = output<string>();

    /**
     * True only when connected to a LOCAL daemon. Drives whether the button renders at all.
     * Seeded false so the button is hidden until a local connection is confirmed.
     */
    protected readonly isLocal = toSignal(
        combineLatest([this.fmeClientService.connectionState, this.bookmarks.current]).pipe(
            map(([state, bookmark]) => state === ConnectionState.CONNECTED && isLocalDaemon(bookmark)),
        ),
        {initialValue: false},
    );

    /** Opens the native picker and emits the chosen path (ignores an empty/cancelled result). */
    protected browse(): void {
        const picker$ = this.mode() === 'file'
            ? this.wails.openFile(this.dialogTitle(), this.startPath(), this.fileFilterName(), this.fileFilterPattern())
            : this.wails.openDirectory(this.dialogTitle(), this.startPath());

        picker$.subscribe((path) => {
            if (path) {
                this.pathPicked.emit(path);
            }
        });
    }
}
