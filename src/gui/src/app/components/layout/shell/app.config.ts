import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { provideRouter } from '@angular/router';
import { appRoutes } from '@app/components/layout/shell/app.routes';
import { metaReducers, reducers } from '@app/state';
import { provideState, provideStore } from '@ngrx/store';
import { StartupService } from '@services/startup/startup.service';
import { TransferService } from '@services/transfer/transfer.service';
import { fmeClientFeature } from '@state/fme-client/fme-client.feature';
import { MetadataService } from '@services/metadata/metadata.service';
import { TransferProfileService } from '@services/transfer-profile/transfer-profile.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { LogsService } from '@services/logs/logs.service';
import { ShutdownService } from '@services/shutdown/shutdown.service';

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection(),
        provideRouter(appRoutes),
        provideStore(reducers, {metaReducers}),
        provideState(fmeClientFeature),
        provideAppInitializer(() => {
            const services = [
                inject(FmeClientService),
                inject(MetadataService),
                inject(TransferService),
                inject(StartupService),
                inject(ShutdownService),
                inject(TransferProfileService),
                inject(LogsService),
            ];

            for (const svc of services) {
                if ('init' in svc) {
                    svc.init();
                }
            }

            return new Promise<void>((resolve) => resolve());
        }),
        {
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                appearance: 'outline',
                subscriptSizing: 'dynamic',
            },
        },
        {
            provide: MAT_ICON_DEFAULT_OPTIONS,
            useValue: {
                fontSet: 'material-icons-outlined',
            },
        },
        {
            provide: MAT_DIALOG_DEFAULT_OPTIONS,
            useValue: {
                autoFocus: false,
                disableClose: true,
            },
        },
        {
            provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
            useValue: {
                showDelay: 250,
            },
        },
    ],
};
