import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BucketReportModalComponent } from './bucket-report-modal.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { BehaviorSubject, of } from 'rxjs';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { TransferProfileService } from '@services/transfer-profile/transfer-profile.service';
import { TransferProfileState } from '@services/transfer-profile/transfer-profile.interfaces';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { TrayStateService } from '@services/tray-state/tray-state.service';
import { HintPopoverService } from '@services/hint-popover/hint-popover.service';
import { ConnectionState } from '@state/models/connection-state-model';

describe('BucketReportModalComponent', () => {
    let component: BucketReportModalComponent;
    let fixture: ComponentFixture<BucketReportModalComponent>;

    let profileState$: BehaviorSubject<TransferProfileState>;
    let connectionState$: BehaviorSubject<ConnectionState>;
    let notifications: Record<string, ReturnType<typeof vi.fn>>;
    let showReports: ReturnType<typeof vi.fn>;
    let generateInventoryReport: ReturnType<typeof vi.fn>;

    function state(list: string[] | null, current: string | null): TransferProfileState {
        return {transferProfileList: list, currentTransferProfile: current, currentProfileIsOIDC: false};
    }

    function build() {
        notifications = {success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn()};
        showReports = vi.fn();
        generateInventoryReport = vi.fn(() => of({success: true, message: ''}));

        TestBed.configureTestingModule({
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
                {provide: MAT_DIALOG_DATA, useValue: {}},
                {provide: MatDialogRef, useValue: {close: vi.fn()}},
                {provide: TransferProfileService, useValue: {transferProfileState: profileState$.asObservable()}},
                {provide: FmeClientService, useValue: {connectionState: connectionState$.asObservable(), generateInventoryReport}},
                {provide: BookmarksService, useValue: {current: of(null)}},
                {provide: NotificationsService, useValue: notifications},
                {provide: TrayStateService, useValue: {showReports}},
                {provide: HintPopoverService, useValue: {open: vi.fn()}},
            ],
        });
        fixture = TestBed.createComponent(BucketReportModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    beforeEach(() => {
        // fme-oidc is first in the list — the old code defaulted here regardless of connection.
        profileState$ = new BehaviorSubject<TransferProfileState>(state(['fme-oidc', 'fme-test'], 'fme-test'));
        connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.CONNECTED);
    });

    it('should create', () => {
        build();
        expect(component).toBeTruthy();
    });

    it('defaults the remote configuration to the currently-connected profile, not the first in the list', () => {
        build();
        expect(component.exportForm.controls.remoteConfiguration.value).toBe('fme-test');
    });

    it('falls back to the first profile when there is no current profile', () => {
        profileState$ = new BehaviorSubject<TransferProfileState>(state(['fme-oidc', 'fme-test'], null));
        build();
        expect(component.exportForm.controls.remoteConfiguration.value).toBe('fme-oidc');
    });

    it('does not overwrite a manual selection when the profile state re-emits', () => {
        build();
        component.exportForm.controls.remoteConfiguration.setValue('fme-oidc');
        component.exportForm.controls.remoteConfiguration.markAsDirty();

        profileState$.next(state(['fme-oidc', 'fme-test'], 'fme-test'));

        expect(component.exportForm.controls.remoteConfiguration.value).toBe('fme-oidc');
    });

    it('shows a pending (info) toast on request rather than claiming success', () => {
        build();
        component.exportForm.controls.format.setValue('JSON');

        component.generateReport()();

        expect(generateInventoryReport).toHaveBeenCalled();
        expect(notifications.success).not.toHaveBeenCalled();
        expect(notifications.info).toHaveBeenCalledWith(expect.stringContaining('Watch the Bucket Reports tab'));
        expect(showReports).toHaveBeenCalled();
    });
});
