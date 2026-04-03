import { Route } from '@angular/router';
import { MainComponent } from '@app/components/layout/main/main.component';
import { configRouteGuard } from '@app/guards/auth.guard';
import { configEditSaveGuard } from '@app/guards/config-edit-save.guard';
import { ConfigComponent } from '@containers/forms/config/config.component';

export const appRoutes: Route[] = [
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
    }, {
        path: 'home',
        children: [
            {
                path: '',
                component: MainComponent,
            }, {
                path: 'config',
                component: ConfigComponent,
                canActivate: [
                    configRouteGuard,
                ],
                canDeactivate: [
                    configEditSaveGuard,
                ],
            },
        ],
    },
];
