import { Component, inject, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { HintPopoverService } from '@services/hint-popover/hint-popover.service';
import { EnterSubmitDirective } from '@app/directives/enter-submit.directive';
import { BucketReportForm } from '@app/components/modals/bucket-report-modal/bucket-report-modal.interfaces';
import { concatLatestFrom } from '@ngrx/operators';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { isLocalDaemon } from '@services/bookmarks/bookmarks.utils';
import { NotificationsService } from '@services/notifications/notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { TransferProfileState } from '@services/transfer-profile/transfer-profile.interfaces';
import { TransferProfileService } from '@services/transfer-profile/transfer-profile.service';
import { TrayStateService } from '@services/tray-state/tray-state.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { BehaviorSubject, Subscription } from 'rxjs';

@Component({
    selector: 'fme-bucket-report-modal',
    templateUrl: './bucket-report-modal.component.html',
    styleUrls: ['./bucket-report-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatFormField,
        MatLabel,
        ReactiveFormsModule,
        MatSelect,
        MatOption,
        MatError,
        MatSlideToggle,
        MatDialogActions,
        ButtonComponent,
        EnterSubmitDirective,
    ],
})
export class BucketReportModalComponent implements OnDestroy {
    private fmeClientService = inject(FmeClientService);
    private notifications = inject(NotificationsService);
    private transferProfileService = inject(TransferProfileService);
    private tray = inject(TrayStateService);
    dialogRef = inject<MatDialogRef<BucketReportModalComponent>>(MatDialogRef);
    private hintPopover = inject(HintPopoverService);
    private bookmarks = inject(BookmarksService);

    outputFormats: string[] = [
        'JSON',
        'YAML',
        'XML',
        'CSV',
    ];
    transferProfiles: string[] = [];
    exportForm: FormGroup<BucketReportForm>;
    canDownloadReport = new BehaviorSubject<boolean>(false);
    private subscriptions: Subscription[] = [];

    constructor() {
        this.fmeClientService.connectionState.pipe(concatLatestFrom(() => this.bookmarks.current)).subscribe(
            ([state, currentBookmark]) => {
                if (state === ConnectionState.CONNECTED) {
                    this.canDownloadReport.next(isLocalDaemon(currentBookmark));
                } else {
                    this.canDownloadReport.next(false);
                }
            },
        );
        this.exportForm = this.setupForm();

        this.subscriptions.push(this.transferProfileService.transferProfileState.subscribe({
            next: (transferProfileState: TransferProfileState) => {
                if (transferProfileState.transferProfileList) {
                    this.transferProfiles = transferProfileState.transferProfileList;
                    // Default to the configuration the user is actually connected to, not
                    // the first in the list — otherwise the report silently targets an
                    // unrelated profile (e.g. an unauthenticated OIDC one) and fails. Only
                    // seed the default while the field is untouched, so a manual pick sticks.
                    if (!this.exportForm.controls.remoteConfiguration.dirty) {
                        const current = transferProfileState.currentTransferProfile;
                        const defaultProfile = current && this.transferProfiles.includes(current)
                            ? current
                            : (this.transferProfiles[0] ?? '');
                        this.exportForm.controls.remoteConfiguration.setValue(defaultProfile);
                    }
                }
            },
        }));
    }

    ngOnDestroy() {
        this.subscriptions.map((sub) => sub.unsubscribe());
        this.subscriptions = [];
    }

    close() {
        return () => {
            this.dialogRef.close();
        };
    }

    generateReport() {
        return () => {
            if (!this.exportForm.valid) {
                this.exportForm.markAllAsTouched();
                this.notifications.warning('Choose a remote configuration and format before generating a report.');
                return;
            }
            this.fmeClientService.generateInventoryReport(
                this.exportForm.controls.remoteConfiguration.value,
                this.exportForm.controls.format.value,
                true,
                this.exportForm.controls.includeChecksums.value,
            ).subscribe({
                next: (data) => {
                    if (!data.success) {
                        this.notifications.error(data.message || 'Failed to start bucket report generation.');
                    } else {
                        // The daemon only ACCEPTED the request here — generation runs
                        // asynchronously and may still fail (e.g. auth). Don't claim success;
                        // point the user at the Bucket Reports tab, where the real final
                        // status (including Error) appears.
                        this.notifications.info(
                            `Bucket report requested for "${this.exportForm.controls.remoteConfiguration.value}". ` +
                            'Watch the Bucket Reports tab for its status.',
                        );
                        // Open the tray on the Bucket Reports tab so the new report row is
                        // visible immediately, rather than relying on the user knowing the tab exists.
                        this.tray.showReports();
                    }
                },
                error: (err: unknown) => {
                    const message = err instanceof Error ? err.message : String(err);
                    this.notifications.error(`Failed to generate bucket report: ${message}`);
                },
            });
            this.dialogRef.close();
        };
    }

    toggleHint(event: MouseEvent, message: string) {
        event.stopPropagation();
        event.preventDefault();

        this.hintPopover.open(event.currentTarget as HTMLElement, message);
    }

    private setupForm(): FormGroup<BucketReportForm> {
        return new FormGroup<BucketReportForm>({
            remoteConfiguration: new FormControl<string>(
                '',
                {
                    validators: [Validators.required],
                    nonNullable: true,
                },
            ),
            format: new FormControl<string>(
                'JSON',
                {
                    validators: Validators.required,
                    nonNullable: true,
                },
            ),
            includeChecksums: new FormControl<boolean>(
                false,
                {
                    nonNullable: true,
                },
            ),
        });
    }
}
