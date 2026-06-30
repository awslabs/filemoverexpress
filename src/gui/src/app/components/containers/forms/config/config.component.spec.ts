import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfigComponent } from './config.component';
import { AppState } from '@app/state';
import { FmeConfig } from '@app/classes/config';
import { ReactiveFormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatExpansionModule } from '@angular/material/expansion';
import { RouterTestingModule } from '@angular/router/testing';
import { HistoryService } from '@services/history/history.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { provideMockStore } from '@ngrx/store/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { MetadataEvent } from '@events/core/metadata';
import { initialTestState } from '@state/test.state';
import { MatBadgeModule } from '@angular/material/badge';
import { create } from '@bufbuild/protobuf';
import { appRoutes } from '@app/components/layout/shell/app.routes';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { SetConfigurationResponse, SetConfigurationResponseSchema } from '@gen/es/fme/v1/config_pb';
import Spy = jasmine.Spy;

const FORM_DATA = FmeConfig.fromJson({
    general: {
        noSleep: true,
        retryCount: 3,

        maxActiveChecksums: 10,
        maxActiveTransfers: 10,
        targetBandwidth: 0,
    },
    logging: {
        maxSize: 50,
        compress: true,
        maxAge: 31,
        severity: 'info',
        directory: 'logs',
    },
    reports: {
        directory: 'reports',
    },
    protocols: {
        s3: {
            transferProfiles: {
                xyz: {
                    name: 'xyz',
                    bucket: 'bucket-1',
                    region: 'us-west-2',
                    profile: 'default',
                    accelerated: true,
                    fileOrder: [],
                    enableMetadataFilter: false,
                    storageClass: 'standard',
                    paths: {
                        local: '/',
                        remote: '/',
                    },
                    autoTuning: true,
                    threads: 10,
                    chunkSize: 5,
                    checksums: {
                        enabled: true,
                        algorithm: 'xxhash',
                    },
                    maxAge: '5d',
                    filter: '.mov',
                    endpoint: '',
                },
                abc: {
                    name: 'abc',
                    bucket: 'bucket-2',
                    region: 'us-east-2',
                    profile: 'default',
                    accelerated: true,
                    fileOrder: [],
                    enableMetadataFilter: false,
                    storageClass: 'standard-ia',
                    paths: {
                        local: '/',
                        remote: '/',
                    },
                    autoTuning: true,
                    threads: 10,
                    chunkSize: 5,
                    checksums: {
                        enabled: true,
                        algorithm: 'xxhash',
                    },
                    maxAge: '5d',
                    filter: '.mov',
                    endpoint: '',
                },
                mno: {
                    name: 'mno',
                    bucket: 'bucket-2',
                    region: 'us-east-2',
                    profile: 'default',
                    accelerated: true,
                    fileOrder: [],
                    enableMetadataFilter: false,
                    storageClass: 'glacier',
                    paths: {
                        local: '/',
                        remote: '/',
                    },
                    autoTuning: true,
                    threads: 10,
                    chunkSize: 5,
                    checksums: {
                        enabled: true,
                        algorithm: 'xxhash',
                    },
                    maxAge: '5d',
                    filter: '.mov',
                    endpoint: '',
                },
            },
        },
    },
    uploadHotFolders: [],
});

describe('ConfigComponent', () => {
    let component: ConfigComponent;
    let fixture: ComponentFixture<ConfigComponent>;
    let redirectSpy: Spy;
    let submitSpy: Spy;
    const defTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                ReactiveFormsModule,
                MatTooltipModule,
                MatSelectModule,
                NoopAnimationsModule,
                MatTableModule,
                MatSnackBarModule,
                MatDialogModule,
                MatIconModule,
                MatCardModule,
                MatSlideToggleModule,
                MatFormFieldModule,
                MatInputModule,
                MatChipsModule,
                MatBottomSheetModule,
                MatExpansionModule,
                RouterTestingModule.withRoutes(appRoutes),
                MatBadgeModule,
            ],
            providers: [
                HistoryService,
                NotificationsService,
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        })
            .compileComponents();
    });

    beforeEach(() => {
        // Setup spies as needed
        const fmeClientService = TestBed.inject(FmeClientService);
        const historyService = TestBed.inject(HistoryService);
        const notificationsService = TestBed.inject(NotificationsService);

        // Spy on the notifications service to prevent hangups due to running threads
        spyOn(notificationsService, 'info').and.callFake(() => null);
        spyOn(notificationsService, 'warning').and.callFake(() => null);
        spyOn(notificationsService, 'success').and.callFake(() => null);

        // Spy on the metadata getter and return a faked value
        spyOnProperty(fmeClientService, 'metadata', 'get').and.callFake(() => {
            const sub = new Subject<MetadataEvent>();
            sub.next(new MetadataEvent(
                false,
                {
                    ['transfer-profile-test']: {
                        local: '/',
                        remote: '/',
                    },
                },
                1,
                '0.1.2',
                {
                    allowUiConfiguration: false,
                    allowLocalRenameDelete: true,
                    allowRemoteRenameDelete: true,
                },
            ));

            return sub.asObservable();
        });

        // Return the configuration object from the static content instead of using grpc
        spyOn(fmeClientService, 'getConfiguration').and.returnValue(new BehaviorSubject(FORM_DATA).asObservable());

        // Fake the setConfiguration call to simply succeed
        const setConfigurationResponse = create(SetConfigurationResponseSchema);
        setConfigurationResponse.success = true;
        setConfigurationResponse.message = '';
        spyOn(fmeClientService, 'setConfiguration')
            .and
            .returnValue(new BehaviorSubject<SetConfigurationResponse>(setConfigurationResponse).asObservable());

        // Fake the redirect call from history service, to not trigger any navigation events
        redirectSpy = spyOn(historyService, 'redirectToPrevious').and.callFake(() => {
            /* intentionally empty */
        });

        fixture = TestBed.createComponent(ConfigComponent);
        component = fixture.componentInstance;
        submitSpy = spyOn(component, 'onSubmit').and.callThrough();
        fixture.detectChanges();
    });

    beforeAll(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;
    });

    afterAll(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = defTimeout;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('form should submit without errors', (done) => {
        fixture.whenStable().then(() => {
            component.onSubmit();
            fixture.detectChanges();
            expect(submitSpy).toHaveBeenCalled();
            done();
        });
    });

    it('cancel should redirect', (done) => {
        fixture.whenStable().then(() => {
            component.onCancel();
            expect(redirectSpy).toHaveBeenCalled();
            done();
        });
    });
});
