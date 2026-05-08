import { ChangeDetectionStrategy, Component, inject, Input, Renderer2 } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/list';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { PreferencesModalComponent } from '@app/components/modals/preferences-modal/preferences-modal.component';
import { SUPPORT_PAGE_URL } from '@app/constants/external-links';
import { isPackagedApp } from '@app/utils/utils';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { strSupportFileComplete } from './toolbar-dropdown.constants';
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
        RouterLink,
    ],
})
export class ToolbarDropdownComponent {
    fmeClientService = inject(FmeClientService);
    dialog = inject(MatDialog);
    private renderer = inject(Renderer2);
    private notifications = inject(NotificationsService);
    private wails = inject(WailsService);

    @Input() version = '';
    @Input() connected = false;
    @Input() allowUiConfiguration = false;

    generateSupportFile() {
        this.fmeClientService.generateSupportFile().subscribe({
            next: (result) => {
                if (result.success) {
                    this.notifications.success(strSupportFileComplete);
                    const link = this.renderer.createElement('a');
                    link.href = `data:application/zip;base64,${result.data}`;
                    link.download = result.filename;
                    link.click();
                    link.remove();
                } else {
                    this.notifications.error(result.error);
                }
            },
            error: (error) => {
                this.notifications.error(error);
                console.error(error);
            },
        });
    }

    getSupport() {
        if (isPackagedApp()) {
            this.wails.externalLink(SUPPORT_PAGE_URL);
        }
    }

    openPreferences() {
        this.dialog.open(PreferencesModalComponent, {width: '40%'});
    }
}
