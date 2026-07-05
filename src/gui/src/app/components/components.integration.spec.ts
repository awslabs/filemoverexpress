/**
 * Component Integration Tests
 *
 * These tests verify component INTERACTION patterns work correctly in Vitest's jsdom environment:
 * - Event emission: trigger actions, verify output EventEmitters emit correct values
 * - Input/output binding: set input signals, run change detection, verify template reflects updates
 * - Template rendering: verify Angular Material components render correctly in jsdom
 *
 * Validates: Requirements 11.1, 11.3
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatListModule } from '@angular/material/list';

import { BreadcrumbsComponent } from './primitives/breadcrumbs/breadcrumbs.component';
import { ButtonComponent } from './primitives/buttons/button/button.component';
import { TextInputComponent } from './primitives/forms/text-input/text-input.component';

describe('Component Integration Tests', () => {

    describe('BreadcrumbsComponent - Event Emission', () => {
        let component: BreadcrumbsComponent;
        let fixture: ComponentFixture<BreadcrumbsComponent>;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [
                    BreadcrumbsComponent,
                    MatIconModule,
                    MatTooltipModule,
                    MatMenuModule,
                    MatListModule,
                ],
            }).compileComponents();

            fixture = TestBed.createComponent(BreadcrumbsComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should emit navigate event with root path when clicking root breadcrumb', () => {
            const navigateSpy = vi.spyOn(component.navigate, 'emit');

            component.clickBreadcrumb(-1);

            expect(navigateSpy).toHaveBeenCalledWith('/');
        });

        it('should emit navigate event with correct folder path when clicking a child breadcrumb', () => {
            component.breadcrumbPath.set('folder1/folder2/folder3');
            fixture.detectChanges();
            const navigateSpy = vi.spyOn(component.navigate, 'emit');

            component.clickBreadcrumb(1);

            expect(navigateSpy).toHaveBeenCalledWith('/folder1/folder2');
        });

        it('should emit navigate event when clicking root element in the template', async () => {
            component.breadcrumbPath.set('some/path');
            fixture.detectChanges();
            await fixture.whenStable();

            const navigateSpy = vi.spyOn(component.navigate, 'emit');
            const rootElement = fixture.debugElement.query(By.css('#root-folder'));
            rootElement.nativeElement.click();
            fixture.detectChanges();

            expect(navigateSpy).toHaveBeenCalledWith('/');
        });

        it('should reset breadcrumbPath to root when navigating to root', () => {
            component.breadcrumbPath.set('folder1/folder2');
            fixture.detectChanges();

            component.clickBreadcrumb(-1);

            expect(component.breadcrumbPath()).toEqual('/');
        });
    });

    describe('BreadcrumbsComponent - Input/Output Binding', () => {
        let component: BreadcrumbsComponent;
        let fixture: ComponentFixture<BreadcrumbsComponent>;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [
                    BreadcrumbsComponent,
                    MatIconModule,
                    MatTooltipModule,
                    MatMenuModule,
                    MatListModule,
                ],
            }).compileComponents();

            fixture = TestBed.createComponent(BreadcrumbsComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should reflect updated breadcrumbPath in the template', async () => {
            component.breadcrumbPath.set('testFolder');
            fixture.detectChanges();
            await fixture.whenStable();

            const currentFolder = fixture.debugElement.query(By.css('#current-folder'));
            expect(currentFolder).toBeTruthy();
            expect(currentFolder.nativeElement.textContent).toContain('testFolder');
        });

        it('should display root element name from root input signal', async () => {
            fixture.componentRef.setInput('root', 'my-bucket');
            fixture.detectChanges();
            await fixture.whenStable();

            const rootElement = fixture.debugElement.query(By.css('#root-folder'));
            expect(rootElement.nativeElement.textContent).toContain('my-bucket');
        });

        it('should show breadcrumb arrows when path has multiple segments', async () => {
            component.breadcrumbPath.set('folder1/folder2/folder3');
            fixture.detectChanges();
            await fixture.whenStable();

            const arrows = fixture.debugElement.queryAll(By.css('.arrow-icon'));
            expect(arrows.length).toBe(3);
        });

        it('should hide child breadcrumbs when path is root', () => {
            component.breadcrumbPath.set('/');
            fixture.detectChanges();

            const validPath = fixture.debugElement.query(By.css('#validBreadcrumbPath'));
            expect(validPath).toBeFalsy();
        });
    });

    describe('ButtonComponent - Input Rendering and Click Interaction', () => {
        let fixture: ComponentFixture<ButtonComponent>;
        let clickHandler: ReturnType<typeof vi.fn>;

        beforeEach(async () => {
            clickHandler = vi.fn();

            await TestBed.configureTestingModule({
                imports: [
                    ButtonComponent,
                    MatIconModule,
                    MatTooltipModule,
                ],
            }).compileComponents();

            fixture = TestBed.createComponent(ButtonComponent);
            fixture.componentRef.setInput('onClick', clickHandler);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should render button text when text input is provided', async () => {
            fixture.componentRef.setInput('text', 'Submit');
            fixture.detectChanges();
            await fixture.whenStable();

            const textEl = fixture.debugElement.query(By.css('.button-text'));
            expect(textEl).toBeTruthy();
            expect(textEl.nativeElement.textContent).toContain('Submit');
        });

        it('should render icon when icon input is provided', async () => {
            fixture.componentRef.setInput('icon', 'upload');
            fixture.detectChanges();
            await fixture.whenStable();

            const iconEl = fixture.debugElement.query(By.css('mat-icon'));
            expect(iconEl).toBeTruthy();
            expect(iconEl.nativeElement.textContent).toContain('upload');
        });

        it('should invoke onClick handler when button is clicked and not disabled', () => {
            fixture.componentRef.setInput('disabled', false);
            fixture.detectChanges();

            const button = fixture.debugElement.query(By.css('button'));
            button.nativeElement.click();

            expect(clickHandler).toHaveBeenCalledTimes(1);
        });

        it('should not invoke onClick handler when button is disabled', () => {
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();

            const button = fixture.debugElement.query(By.css('button'));
            button.nativeElement.click();

            expect(clickHandler).not.toHaveBeenCalled();
        });

        it('should apply filled button class for default type', () => {
            fixture.detectChanges();

            const button = fixture.debugElement.query(By.css('button'));
            expect(button.nativeElement.classList.contains('button-type-filled')).toBe(true);
        });

        it('should apply stroked button class when type is stroked', async () => {
            fixture.componentRef.setInput('type', 'stroked');
            fixture.detectChanges();
            await fixture.whenStable();

            const button = fixture.debugElement.query(By.css('button'));
            expect(button.nativeElement.classList.contains('button-type-stroked')).toBe(true);
        });
    });

    describe('TextInputComponent - Input/Output Binding and Template Rendering', () => {
        let component: TextInputComponent;
        let fixture: ComponentFixture<TextInputComponent>;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [
                    TextInputComponent,
                    FormsModule,
                    MatIconModule,
                ],
            }).compileComponents();

            fixture = TestBed.createComponent(TextInputComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should emit textChange event when text is set programmatically', () => {
            const textChangeSpy = vi.spyOn(component.textChange, 'emit');

            component.inputtedText = 'hello world';

            expect(textChangeSpy).toHaveBeenCalledWith('hello world');
        });

        it('should emit empty string when reset is called', () => {
            component.inputtedText = 'some text';
            const textChangeSpy = vi.spyOn(component.textChange, 'emit');

            component.reset();

            expect(textChangeSpy).toHaveBeenCalledWith('');
            expect(component.inputtedText).toBe('');
        });

        it('should render placeholder from label input signal', async () => {
            fixture.componentRef.setInput('label', 'Search files...');
            fixture.detectChanges();
            await fixture.whenStable();

            const input = fixture.debugElement.query(By.css('input'));
            expect(input.nativeElement.getAttribute('placeholder')).toBe('Search files...');
        });

        it('should disable the input element when disabled input is true', async () => {
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();
            await fixture.whenStable();

            const input = fixture.debugElement.query(By.css('input'));
            expect(input.nativeElement.disabled).toBe(true);
        });

        it('should apply focused class when input gains focus', async () => {
            const input = fixture.debugElement.query(By.css('input'));
            input.nativeElement.dispatchEvent(new Event('focus'));
            fixture.detectChanges();
            await fixture.whenStable();

            const container = fixture.debugElement.query(By.css('.focused-input-form-field'));
            expect(container).toBeTruthy();
        });

        it('should render search icon in the template', () => {
            const icon = fixture.debugElement.query(By.css('mat-icon'));
            expect(icon).toBeTruthy();
            expect(icon.nativeElement.textContent).toContain('search');
        });
    });
});
