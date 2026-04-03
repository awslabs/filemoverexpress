import { DebugElement } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { BreadcrumbsComponent } from './breadcrumbs.component';

const folderStr = 'testFolder';
const ellipse = '...';

describe('BreadcrumbsComponent', () => {
    let component: BreadcrumbsComponent;
    let fixture: ComponentFixture<BreadcrumbsComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                BreadcrumbsComponent,
                MatIconModule,
                MatTooltipModule,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(BreadcrumbsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('should create the BreadCrumb component', () => {
        expect(component).toBeTruthy();
    });

    /**
     * SplitBreadCrumb test suits
     **/
    it('should return expected split string array from the breadcrumb string when the folder string has leading and trailing slash', () => {
        component.breadcrumbPath.set('/folder1/folder2/folder3/');

        const actualRes = component.breadcrumbs();
        const expectedRes = [
            'folder1',
            'folder2',
            'folder3',
        ];
        expect(actualRes).toEqual(expectedRes);
    });

    it(
        'should return expected split string array from the breadcrumb string when the folder string does not have leading and trailing slash',
        () => {
            component.breadcrumbPath.set('folder1/folder2/folder3');
            const actualRes = component.breadcrumbs();
            const expectedRes = [
                'folder1',
                'folder2',
                'folder3',
            ];
            expect(actualRes).toEqual(expectedRes);
        },
    );

    it('should return empty string array from the breadcrumb string when the folder string is empty', () => {
        component.breadcrumbPath.set('');
        const actualRes = component.breadcrumbs();
        const expectedRes: string[] = [];
        expect(actualRes).toEqual(expectedRes);
    });

    // Since empty string with split("/") will return an array with an empty string, this test is to validate the method handle this case
    it('should return empty string array from the breadcrumb string when the folder string is /', () => {
        component.breadcrumbPath.set('/');

        const actualRes: string[] = component.breadcrumbs();
        const expectedRes: string[] = [];
        expect(actualRes).toEqual(expectedRes);
    });

    /**
     * constructFolderLayersWithEllipse test suits
     **/
    it('should return expected breadcrumb without ellipse when the array size is less than 6', () => {
        const numOfFolders = 5;
        const testFolders = generateTestFolderPath(numOfFolders);
        component.breadcrumbPath.set(testFolders.path);
        expect(component.breadcrumbs()).toEqual(testFolders.parts);
    });

    it('should return expected breadcrumb with ellipse when the array size is greater than 5', () => {
        const numOfFolders = 10;
        const testFoldersArr = generateTestFolderPath(numOfFolders);
        const lastTestFiveFoldersArr = testFoldersArr.parts.slice(-5);
        component.breadcrumbPath.set(testFoldersArr.path);
        const expectedRes: string[] = [ellipse];
        expectedRes.push(...lastTestFiveFoldersArr);
        expect(component.breadcrumbs()).toEqual(expectedRes);
    });

    it('should return expected breadcrumb without ellipse when the array size is 0', () => {
        const numOfFolders = 0;
        const testFolders = generateTestFolderPath(numOfFolders);
        component.breadcrumbPath.set(testFolders.path);
        expect(component.breadcrumbs()).toEqual([]);
    });

    /**
     * reconstructFolderLayersWhenClickingEllipse test suits
     **/
    it('should return expected breadcrumb without ellipse when the array size is less than 6 when calling reconstructFolderLayersWhenClickingEllipse', () => {
        const numOfFolders = 5;
        const testFoldersArr = generateTestFolderPath(numOfFolders);
        component.breadcrumbPath.set(testFoldersArr.path);
        expect(component.breadcrumbs()).toEqual(testFoldersArr.parts);
    });

    it('should return expected breadcrumb with ellipse when the array size is greater than 5 when calling reconstructFolderLayersWhenClickingEllipse', () => {
        const numOfFolders = 10;
        const testFoldersArr = generateTestFolderPath(numOfFolders);
        component.breadcrumbPath.set(testFoldersArr.path);
        const expectedRes: string[] = [
            ellipse, ...testFoldersArr.parts.slice(testFoldersArr.parts.length - 5),
        ];
        expect(component.breadcrumbs()).toEqual(expectedRes);
    });

    it(
        'should return expected breadcrumb without ellipse when the array size is 0 when calling reconstructFolderLayersWhenClickingEllipse',
        () => {
            const numOfFolders = 0;
            const testFolders = generateTestFolderPath(numOfFolders);
            component.breadcrumbPath.set(testFolders.path);
            expect(component.breadcrumbs()).toEqual([]);
        },
    );


    /**
     * hasEllipse is assigned to correct boolean
     */
    it('should set hasEllipse to true when the length of folder path arr is greater than upperbound', fakeAsync(() => {
        const numOfFolders = 6;
        const testFolders = generateTestFolderPath(numOfFolders);
        component.breadcrumbPath.set(testFolders.path);
        tick();
        expect(component.hasEllipse()).toBeTruthy();
    }));

    /**
     * HTML render correctly for different input
     */
    it('should show the valid child folder path when the input path is valid', fakeAsync(() => {
        component.breadcrumbPath.set('testFolderPath');
        // component.breadCrumbArr = ['testFolderPath'];
        fixture.detectChanges();
        tick();
        const element = fixture.debugElement.query(By.css('#current-folder'));
        expect(element).toBeTruthy();
        expect(element.nativeElement.textContent).toEqual('testFolderPath');
    }));

    it('should not show child folder breadcrumb when the input path is the root', () => {
        component.breadcrumbPath.set('/');
        fixture.detectChanges();
        let element: DebugElement = fixture.debugElement.query(By.css('#validBreadcrumbPath'));
        expect(element).toBeFalsy();
        element = fixture.debugElement.query(By.css('#root-folder'));
        expect(element).toBeTruthy();
        expect(element.nativeElement.textContent).toEqual('root');
    });

    it('should call emit with root path when calling clickBreadcrumb with -1 idx', () => {
        const breadcrumbNavSpy = spyOn(component.navigate, 'emit');
        component.clickBreadcrumb(-1);
        expect(breadcrumbNavSpy).toHaveBeenCalledWith('/');
        expect(component.breadcrumbPath()).toEqual('/');
    });

    it('should emit folder path being called when calling clickBreadcrumb', () => {
        component.breadcrumbPath.set('folder1/folder2/folder3');
        const breadcrumbNavSpy = spyOn(component.navigate, 'emit');
        component.clickBreadcrumb(1);
        expect(breadcrumbNavSpy).toHaveBeenCalledWith('/folder1/folder2');
    });

    it('should click event method be called when the single breadcrumb is clicked', fakeAsync(() => {
        component.breadcrumbPath.set('testFolderPath1/testFolderPath2');
        fixture.detectChanges();
        spyOn(component, 'clickBreadcrumb');
        const singleBreadcrumb = fixture.debugElement.query(By.css('.breadcrumb-single-clickable'));
        singleBreadcrumb.nativeElement.click();
        fixture.detectChanges();
        tick();
        expect(component.clickBreadcrumb).toHaveBeenCalled();
    }));
});

interface TestFolder {
    path: string;
    parts: string[];
}

/**
 * Test function to generate test folder array in the length of the given number of layers.
 * @param numOfFolders The number of folders the folder path need to have
 * @returns array with test folders
 */
function generateTestFolderPath(numOfFolders: number): TestFolder {
    if (numOfFolders <= 0) {
        return {path: '', parts: []};
    }
    const testFoldersArr: string[] = [];
    for (let i = 1; i <= numOfFolders; i++) {
        const folderStrWithIdx = folderStr + i.toString();
        testFoldersArr.push(folderStrWithIdx);
    }
    return {path: testFoldersArr.join('/'), parts: testFoldersArr};
}
