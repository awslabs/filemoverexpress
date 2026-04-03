import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
    BrowserTestingModule,
    platformBrowserTesting(), {
        errorOnUnknownElements: true,
        errorOnUnknownProperties: true,
        teardown: {destroyAfterEach: false},
    },
);
