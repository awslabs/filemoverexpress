import { Component, input } from '@angular/core';
import { MatBadge } from '@angular/material/badge';
import { ThemePalette } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { ButtonType } from '@app/components/primitives/buttons/button/button.interfaces';

@Component({
    selector: 'fme-button',
    templateUrl: './button.component.html',
    styleUrls: ['./button.component.scss'],
    imports: [
        MatBadge,
        MatTooltip,
        MatIcon,
    ],
    standalone: true,
})

/**
 * Generic button component. Types can be:
 * - filled: button is a solid color and can hold text with an optional leading icon
 * - stroked: button is stroked and can hold text with an optional leading icon
 * - icon: button is a stroked circle and only holds one icon
 */
export class ButtonComponent {
    public type = input<ButtonType>('filled');
    icon = input<string | null>(null);
    text = input<string | null>(null);
    color = input<ThemePalette | null | undefined>(null);
    disabled = input<boolean>(false);
    tooltip = input<string>('');
    notificationBadge = input<string>('');

    /**
     * The onClick input function should be the return value of a function that returns the function you want to run.
     * For example, if you want to run actuallyDoSomethingHere() on click, pass it in with [onClick]="doSomething()",
     * where doSomething() looks like this:
     * doSomething() {
     *     return () => {
     *         actuallyDoSomethingHere();
     *     };
     * }
     * If you just pass the function reference like [onClick]="actuallyDoSomethingHere", change detection won't run on
     * variables you use in the function, so they may be null or not up to date.
     */
    onClick = input.required<(() => void)>();

    /**
     * Runs the button's click handler function if it exists and the button is not disabled
     */
    onButtonClick() {
        if (!this.disabled() && this.onClick()) {
            this.onClick()();
        }
    }
}
