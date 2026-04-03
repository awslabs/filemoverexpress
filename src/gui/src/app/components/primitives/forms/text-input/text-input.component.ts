import { NgClass } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'fme-text-input',
    templateUrl: './text-input.component.html',
    styleUrls: ['./text-input.component.scss'],
    imports: [
        NgClass,
        MatIcon,
        FormsModule,
    ],
})
export class TextInputComponent {
    label = input<string>('');
    disabled = input<boolean>(false);
    textChange = output<string>();
    focused = false;

    private text = '';

    onFocus() {
        this.focused = true;
    }

    onBlur() {
        this.focused = false;
    }

    reset() {
        this.text = '';
        this.textChange.emit('');
    }

    get inputtedText(): string {
        return this.text;
    }

    set inputtedText(text: string) {
        this.text = text;
        this.textChange.emit(text);
    }
}
