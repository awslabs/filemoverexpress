import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotFolderFormComponent } from './hot-folder-form.component';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HotFolders, HotFoldersTransferConfigurations } from '@classes/config';
import { HotFolderFormGroup } from './hot-folder-form.interfaces';
import { MetadataService } from '@services/metadata/metadata.service';
import { of } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

describe('HotFolderFormComponent', () => {
    let component: HotFolderFormComponent;
    let fixture: ComponentFixture<HotFolderFormComponent>;

    beforeEach(() => {
        // Rendering a hot folder's destinations reads transferProfiles, which throws until
        // metadata has loaded. Same stub as configure-hot-folder-modal's spec.
        const metadataStub = {onUpdate: of(false), transferProfiles: {}};
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
                MatExpansionModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatBadgeModule,
                MatTooltipModule,
            ],
            providers: [provideMockStore<AppState>({initialState: initialTestState}), {provide: MetadataService, useValue: metadataStub}],
        });
        fixture = TestBed.createComponent(HotFolderFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    // forceInitialUpload is set in the config file and not shown in the form. The modal saves
    // getRawValue(), so the hidden control is what carries it through, including a rename.
    it('carries forceInitialUpload through getRawValue(), including after a rename', () => {
        fixture.componentRef.setInput('hotFolders', [
            new HotFolders('dailies', true, '/footage', [new HotFoldersTransferConfigurations('txp', 'prefix')], true),
        ]);
        fixture.detectChanges();
        const form = (component as unknown as {
            hotFolderFormArray: () => FormArray<FormGroup<HotFolderFormGroup>>;
        }).hotFolderFormArray();

        form.at(0).controls.name.setValue('renamed');

        const saved = form.getRawValue();
        expect(saved[0].name).toBe('renamed');
        expect(saved[0].forceInitialUpload).toBe(true);
    });
});
