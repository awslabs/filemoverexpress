import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FavoritePathModalComponent } from './favorite-path-modal.component';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { of } from 'rxjs';
import { WailsService } from '@services/wails/wails.service';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { ConnectionState } from '@state/models/connection-state-model';

describe('FavoritePathModalComponent', () => {
    let component: FavoritePathModalComponent;
    let fixture: ComponentFixture<FavoritePathModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                MatFormFieldModule,
                ReactiveFormsModule,
                MatInputModule,
                MatTooltipModule,
                MatBadgeModule,
            ],
            providers: [
                MatDialog,
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {},
                },
                {
                    provide: MatDialogRef,
                    useValue: {},
                },
                {provide: WailsService, useValue: {openDirectory: () => of(''), openFile: () => of('')}},
                {provide: BookmarksService, useValue: {current: of(null)}},
                {provide: FmeClientService, useValue: {connectionState: of(ConnectionState.DISCONNECTED)}},
            ],
        });
        fixture = TestBed.createComponent(FavoritePathModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
