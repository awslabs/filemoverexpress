import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { ShellComponent } from '@app/components/layout/shell/shell.component';
import { appConfig } from '@app/components/layout/shell/app.config';
import { environment } from './environments/environment';

if (environment.production) {
    enableProdMode();
}

bootstrapApplication(ShellComponent, appConfig)
    .catch((err) => console.error(err));
