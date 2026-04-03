import { Component } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'fme-welcome-modal',
    templateUrl: './welcome-modal.component.html',
    styleUrls: ['./welcome-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatIconButton,
        MatDialogClose,
        MatIcon,
        MatDialogContent,
    ],
})
export class WelcomeModalComponent {
}
