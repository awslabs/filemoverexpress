import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Submits a dialog's primary action when the user presses Enter/Return, mirroring the
 * standard desktop convention. Place it on the dialog's content element and bind the same
 * action + disabled state as the primary button:
 *
 *   <div mat-dialog-content
 *        (fmeEnterSubmit)="save()()"
 *        [enterSubmitDisabled]="myForm.invalid">
 *
 * Enter is ignored inside a textarea or contenteditable (so newlines still work), when the
 * focused element is itself a button/link (native activation handles it), while an IME
 * composition is in progress, and whenever the primary action is disabled (invalid form).
 */
@Directive({
    selector: '[fmeEnterSubmit]',
})
export class EnterSubmitDirective {
    /** Truthy = do not submit — mirror the primary button's [disabled] expression. */
    @Input() enterSubmitDisabled = false;

    /** Fires when Enter is pressed in a submittable context. */
    @Output() fmeEnterSubmit = new EventEmitter<void>();

    @HostListener('keydown.enter', ['$event'])
    onEnter(event: Event): void {
        const keyEvent = event as KeyboardEvent;
        if (keyEvent.isComposing) {
            return;
        }
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'textarea' || tag === 'button' || tag === 'a' || target?.isContentEditable) {
            return;
        }
        if (this.enterSubmitDisabled) {
            return;
        }
        event.preventDefault();
        this.fmeEnterSubmit.emit();
    }
}
