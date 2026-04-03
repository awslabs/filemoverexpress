import 'cypress-plugin-tab'
import '../support/commands'
import {slowCypressDown} from 'cypress-slow-down'

slowCypressDown(500)

beforeEach(() => {
    cy.viewport(1920, 1080);
    cy.visit('http://localhost:4200/home');
    cy.get('.inputs-row-form-field', {timeout: 10000}).eq(1).invoke('text').then((iconText) => {
        if (iconText.includes('check_circle_outline')) {
            cy.log('Session is connected. Continuing tests.');
        } else {
            cy.log('Session is not connected.');
            cy.get('.button-text').contains('Retry Connection').click();
        }
    });
});

describe('Preferences', () => {
    it('Check disabling notification', () => {
        cy.get('.buttons').contains('menu').click();
        cy.contains('Preferences').click();
        cy.contains('seconds').click();
        cy.contains('Disabled').click();
        cy.contains('Close').click();
    });
});


describe('Info Message', () => {
    it('Check info button', () => {
        cy.get('.buttons').contains('info').click();
        cy.contains('To get started');
        cy.get('.mat-icon').contains('close').click({force: true});
    });
});

describe('Favorite Path Tests', {testIsolation: false}, () => {
    it('Setup and validate favorite path', () => {
        cy.get('.inputs-row-form-field').eq(1).click();
        cy.get('.clickable-dropdown-row').filter(':contains("Add")').eq(0).click();
        cy.get('[formcontrolname="favoritePath"]').clear().type('/builds/nightraven/nightraven/src/cli/testdata');
        cy.get('button.text-button-base:contains("Add")').click();
        cy.get('.inputs-row-form-field').eq(1).click();
        cy.get('.ng-star-inserted').contains('star').should('exist')
                .then(() => {
                    cy.get('.item.clickable-dropdown-row').contains('/builds').should('exist');
                });
    });

    it('Remove favorite path', () => {
        cy.get('.inputs-row-form-field').eq(1).click();
        cy.get('.icon-spacer.ng-star-inserted').contains('delete_outline').click();
        cy.get('.button-text.ng-star-inserted').contains('Delete').click()
        cy.get('.inputs-row-form-field').eq(1).click();
        cy.get('.item.clickable-dropdown-row').contains('/builds').should('not.exist');
        cy.get('body').click(0, 0);
    });
});

describe('Remote Configuration', () => {
    it('Remove unused remote configuration', () => {
        cy.get('.inputs-row-form-field').eq(3).click();
        cy.get('.item.clickable-dropdown-row').contains('e2e-test').parent().parent()
                .find('.ng-star-inserted').contains('delete_outline').click();
        cy.get('.button-text').contains('Delete').click()
        cy.reload();
    });

    it('Validate the removal of e2e-test', () => {
        cy.get('.inputs-row-form-field').eq(3).click();
        cy.get('.row-text').filter((index, element) => element.textContent.trim() === 'e2e-test')
                .should('not.exist');
    });

    it('Add remote configuration with local path', () => {
        cy.get('.inputs-row-form-field').eq(3).click();
        cy.get('.row-text').contains('Add Remote').click();
        cy.get('[formcontrolname="name"]').clear().type('nightraven-gui-e2e-tests');
        cy.get('[formcontrolname="bucket"]').clear().type('nightraven-gui-e2e-tests');
        cy.get('[formcontrolname="region"]').click();
        cy.contains('span.mdc-list-item__primary-text', 'us-west-2').click();
        cy.get('[formcontrolname="profile"]').clear().type('e2e-test').tab();
        cy.get('.mat-expansion-panel-header-title').contains('Advanced').click();
        cy.get('[ng-reflect-name="local"]').click().type("/builds/nightraven/nightraven/src/cli/testdata/");
        cy.get('button.text-button-base:contains("Add")').click();
        cy.reload(true);
    });

    it('Validate newly added remote config', () => {
        cy.get('.inputs-row-form-field').eq(3).click();
        cy.get('.row-text').contains('nightraven-gui-e2e').click();
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').should('exist');
    });
});

describe('Settings', () => {
    beforeEach(() => {
        cy.get('.buttons').contains('menu').click();
        cy.contains('Settings').click();
    });

    it('Test invalid inputs', () => {
        const formControlNames = ["retryCount", "maxActiveTransfers", "maxActiveChecksums", "maxSize", "maxAge"]
        const inputList = ['-1', 'testing', ' ', '@', '1']
        formControlNames.forEach(formControlName => {
            inputList.forEach(singleInput => {
                cy.get(`input[formcontrolname="${formControlName}"]`).clear().type(singleInput);
                if (singleInput === '1') {
                    return;
                }
                cy.get('fme-button[text="Save"]').find('button').should('be.disabled');
            });
        });
    });

    it('Add hot folder', () => {
        //cy.get('file-mover-express-button[text="Delete Hot Folder"]').find('button').click({force: true});
        cy.get('fme-button[text="Add Hot Folder"]').find('button').click();
        cy.get(`input[formcontrolname="name"]`).type('temp_hot_folder');
        cy.get(`input[formcontrolname="localSourceFolder"]`).type('/builds/nightraven/nightraven/src/cli/testdata/utils_sources_data');
        cy.get('mat-select[ng-reflect-name="remoteConfigurationName"]').click().type('nightraven-gui').type('{enter}');
        cy.get('.button-text').contains('Save').click({force: true});
    });

    it('Validate hot folder upload status', () => {
        cy.get('.button-text').contains('Cancel').click();
        cy.clearCompletedJobs();
    });

    it('Remove hot folder', () => {
        cy.get('fme-button[text="Delete Hot Folder"]').find('button').click({force: true});
        cy.contains('temp_hot_folder').should('not.exist');
        cy.get('.button-text').contains('Save').click({force: true});
    });
});

describe('Search', () => {
    it('Search local files', () => {
        cy.get('input[placeholder="Search"]').eq(0).type('sorting');
        cy.get('#daemon-browser').find('.file-name-string').contains('sorting');
    });

    it('Search S3 files', () => {
        cy.get('input[placeholder="Search"]').eq(1).type('1zhao');
        cy.get('#bucket-browser').find('.file-name-string').contains('1zhao');
    });
});

describe('Breadcrumb', () => {
    it('Check file system breadcrumb', () => {
        cy.get('.browser-section').eq(0).find('.breadcrumb-single-clickable').contains('File System').click();
        cy.contains('go').should('be.visible');
    });

    it('Check s3 breadcrumb', () => {
        cy.get('.browser-section').eq(1).find('.breadcrumb-single-clickable').contains('S3').click();
        cy.contains('1zhao').should('be.visible');
    });
});

describe('Folder creation', () => {
    function createLocalFolder(folderName) {
        cy.get('fme-button[ng-reflect-icon="create_new_folder"]').eq(0).click();
        cy.get('.mat-mdc-input-element').type(folderName);
        cy.get('.button-text').contains('Create').click();
    }

    it('Create local folder', () => {
        createLocalFolder('cypress-temp-folder');
        cy.get('#daemon-browser').contains('cypress-temp-folder').should('be.visible');
    });

    it('Verify duplication', () => {
        createLocalFolder('cypress-temp-folder');
        cy.contains('already exists').should('be.visible');
    });
});

describe('Upload', () => {
    it('Upload single file to S3', () => {
        cy.get('.file-browser-container').contains('sorting').scrollIntoView().dblclick();
        cy.uploadLocalFile('clip.mov', '1zhao');
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').should('exist').dblclick().wait(3000);
        cy.get('.file-browser-loading', {timeout: 10000}).should('not.exist');
        cy.get('#bucket-browser').contains('div.file-name-string', 'clip.mov').should('exist');
        cy.clearCompletedJobs();
    });

    it('Upload single folder to s3', () => {
        cy.uploadLocalFile('sorting', '1zhao');
        cy.get('.file-browser-loading', {timeout: 10000}).should('not.exist');
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').should('exist').dblclick().wait(3000);
        cy.wait(10000);
        cy.get('fme-refresh-button').eq(1).click();
        cy.get('#bucket-browser').contains('div.file-name-string', 'sorting').should('exist');
        cy.clearCompletedJobs();
    });

    it('Upload multi files to s3', () => {
        cy.get('#daemon-browser').contains('div.file-name-string', 'sorting').should('exist').dblclick().wait(3000);
        const filenames = ['clip.wav', 'aaa.txt', 'frame.mov'];
        cy.uploadMultiFiles(filenames, '1zhao');
        cy.get('.file-browser-loading', {timeout: 10000}).should('not.exist');
        cy.wait(10000);
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').dblclick();
        cy.get('fme-refresh-button').eq(1).click();
        filenames.forEach(file => {
            cy.get('#bucket-browser').contains('div.file-name-string', file).should('exist');
        });
        cy.clearCompletedJobs();
    });

    it('Upload multi folders to s3', () => {
        const filenames = ['checksums', 'discovery', 'unittests'];
        cy.uploadMultiFiles(filenames, '1zhao');
        cy.get('.file-browser-loading', {timeout: 10000}).should('not.exist');
        cy.wait(10000);
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').dblclick();
        cy.get('fme-refresh-button').eq(1).click();
        filenames.forEach(file => {
            cy.get('#bucket-browser').contains('div.file-name-string', file).should('exist');
        });
        cy.clearCompletedJobs();
    });
});

describe('Download', () => {
    it('Download multi files from s3', () => {
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').dblclick();
        cy.get('#bucket-browser').contains('div.file-name-string', 'sorting').dblclick();
        const filenames = ['clip.wav', 'aaa.txt', 'frame.mov'];
        cy.downloadMultiFiles(filenames);
        cy.wait(10000);
        cy.get('.file-browser-loading', {timeout: 10000}).should('not.exist');
        filenames.forEach(file => {
            cy.get('#daemon-browser').contains('div.file-name-string', file).should('exist');
        });
        cy.clearCompletedJobs();
    });

    it('Download single file from s3', () => {
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').dblclick();
        cy.downloadS3File('clip.mov');
        cy.wait(100);
        cy.get('.file-browser-loading', {timeout: 10000}).should('not.exist');
        cy.get('#daemon-browser').contains('div.file-name-string', 'clip.mov').should('exist');
        cy.clearCompletedJobs();
    });

    it('Download single folder from s3', () => {
        cy.contains('#root-folder', 'S3').click({force: true});
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').dblclick();
        cy.get('#daemon-browser').contains('div.file-name-string', 'sorting').dblclick();
        cy.downloadS3File('sorting');
        cy.wait(10000);
        cy.get('.file-browser-loading', {timeout: 10000}).should('not.exist');
        cy.get('#daemon-browser').contains('div.file-name-string', 'sorting').should('exist');
        cy.clearCompletedJobs();
    });

    it('Download multi folders from s3', () => {
        cy.get('#daemon-browser').contains('div.file-name-string', 'sorting').dblclick();
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').dblclick();
        const filenames = ['checksums', 'discovery', 'unittests'];
        cy.downloadMultiFiles(filenames);
        cy.wait(10000);
        cy.get('fme-refresh-button').eq(0).click();
        cy.get('.file-browser-loading', {timeout: 10000}).should('not.exist');
        filenames.forEach(file => {
            cy.get('#daemon-browser').contains('div.file-name-string', file).should('exist');
        });
        cy.clearCompletedJobs();
    });
});

describe('Bucket Report', () => {
    it('Generate bucket report', () => {
        cy.get('fme-button[text="Bucket Report"]').click();
        cy.get('.button-text').contains('Generate Bucket Report').click()
    });
});

describe('Delete S3 files', () => {
    it('Delete temp files', () => {
        const temp_filenames = ['file.mhl', 'file1', 'file2', '1zhao'];
        temp_filenames.forEach(filename => {
            cy.contains(filename).rightclick();
            cy.get('.context-menu-row-label').contains('Delete').click();
            cy.get('[formcontrolname="confirmDelete"]').click().type('permanently delete');
            cy.get('.button-text.ng-star-inserted').contains('Delete').click();
            cy.wait(10000);
            cy.get('#bucket-browser').contains('div.file-name-string', filename).should('not.exist', {timeout: 10000});
        });
    });

    it('Create new folder for next run and clear notifications', () => {
        cy.get('fme-button[ng-reflect-icon="create_new_folder"]').eq(1).click();
        cy.get('.mat-mdc-input-element').type('1zhao');
        cy.get('.button-text').contains('Create').click();
        cy.wait(10000);
        cy.get('#bucket-browser').contains('div.file-name-string', '1zhao').should('exist');
        cy.contains('notifications_active').click({force: true});
        cy.get('fme-button[ng-reflect-text="Clear All"]').click();
    });

    it('Check notification status', () => {
        cy.contains('notifications').click({force: true});
        cy.get('fme-button[ng-reflect-text="Clear All"]').should('have.attr', 'ng-reflect-disabled', 'true');
    });
});














