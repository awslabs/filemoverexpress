// TODO: Fix these after migrating to vitest
// import { Location } from '@angular/common';
// import { ComponentFixture, fakeAsync, TestBed, tick, waitForAsync } from '@angular/core/testing';
// import { provideRouter, Router } from '@angular/router';
// import { AppState } from '@app/state';
// import { StoreModule } from '@ngrx/store';
// import { provideMockStore } from '@ngrx/store/testing';
// import { initialTestState } from '@state/test.state';
// import { ShellComponent } from './shell.component';
// import { FmeClientService } from '@services/fme-client/fme-client.service';
// import { Observable, of } from 'rxjs';
// import { MetadataService } from '@services/metadata/metadata.service';
// import { ConnectionState } from '@state/models/connection-state-model';
// import { FSFolder } from '@classes/grpc';
// import { VersionService } from '@services/version/version.service';
// import { appRoutes } from '@app/components/layout/shell/app.routes';
//
// describe('ShellComponent', () => {
//     let router: Router;
//     let location: Location;
//     let fixture: ComponentFixture<ShellComponent>;
//
//     beforeEach(waitForAsync(() => {
//         TestBed.configureTestingModule({
//             imports: [StoreModule],
//             providers: [
//                 provideMockStore<AppState>({initialState: initialTestState}),
//                 provideRouter(appRoutes),
//                 {
//                     provide: FmeClientService,
//                     useValue: {
//                         connectionState: of(ConnectionState.CONNECTED),
//                         metadata: of(),
//                         events$: of([]),
//                         listJobs: () => of(),
//                         listDaemonFolder: (): Observable<FSFolder> => of(),
//                         listS3Prefix: () => of(),
//                     },
//                 },
//                 {
//                     provide: MetadataService,
//                     useValue: {
//                         onUpdate: of(),
//                         onUpdateTransferProfileNames: of(),
//                     },
//                 },
//                 {
//                     provide: VersionService,
//                     useValue: {
//                         ignoredUpdates: [],
//                     },
//                 },
//             ],
//         }).compileComponents();
//
//         router = TestBed.inject(Router);
//         location = TestBed.inject(Location);
//         TestBed.inject(FmeClientService);
//
//         fixture = TestBed.createComponent(ShellComponent);
//         router.initialNavigation();
//     }));
//
//     it('should create the shell', () => {
//         const app = fixture.componentInstance;
//         console.log(`App: ${app}`);
//         expect(app).toBeTruthy();
//     });
//
//     it('fakeAsync works', fakeAsync(() => {
//         const promise = new Promise((resolve) => {
//             setTimeout(resolve, 10);
//         });
//         let done = false;
//         promise.then(() => (done = true));
//         tick(50);
//         expect(done).toBeTruthy();
//     }));
//
//     it('navigate to "" redirects you to /home', fakeAsync(() => {
//         router.navigate(['']);
//         tick();
//         fixture.detectChanges();
//         expect(location.path()).toBe('/home');
//     }));
// });
