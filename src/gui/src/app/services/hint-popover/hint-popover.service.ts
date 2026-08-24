import { ConnectedPosition, Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Injectable, Injector, inject } from '@angular/core';
import { HINT_POPOVER_MODE, HintsPanelComponent } from '@app/components/layout/hints-panel/hints-panel.component';

/**
 * Opens the shared HintsPanelComponent as a compact popover anchored to the clicked
 * "Info" link (replacing the old full-width bottom-sheet). Closes on outside click or
 * Escape. Call from a component's toggleHint handler:
 *
 *   toggleHint(event: MouseEvent, message: string) {
 *       this.hintPopover.open(event.currentTarget as HTMLElement, message);
 *   }
 */
@Injectable({ providedIn: 'root' })
export class HintPopoverService {
    private overlay = inject(Overlay);
    private injector = inject(Injector);

    open(origin: HTMLElement, mode: string): void {
        // Prefer below the link (right edge aligned); fall back to above if there isn't room.
        const below: ConnectedPosition = { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 };
        const above: ConnectedPosition = { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 };
        const positionStrategy = this.overlay
            .position()
            .flexibleConnectedTo(origin)
            .withPositions([below, above])
            .withPush(true);

        const overlayRef = this.overlay.create({
            positionStrategy,
            scrollStrategy: this.overlay.scrollStrategies.reposition(),
            hasBackdrop: true,
            backdropClass: 'cdk-overlay-transparent-backdrop',
            panelClass: 'hint-popover',
        });

        const portalInjector = Injector.create({
            parent: this.injector,
            providers: [{ provide: HINT_POPOVER_MODE, useValue: mode }],
        });
        overlayRef.attach(new ComponentPortal(HintsPanelComponent, null, portalInjector));

        overlayRef.backdropClick().subscribe(() => overlayRef.dispose());
        overlayRef.keydownEvents().subscribe((e) => {
            if (e.key === 'Escape') {
                overlayRef.dispose();
            }
        });
    }
}
