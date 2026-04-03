// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
Cypress.Commands.add('uploadLocalFile', (filename, destination) => {
    const dataTransfer = new DataTransfer();
    cy.contains('div.file-name-string', filename)
            .trigger('dragstart', {dataTransfer});
    cy.get('#bucket-browser').contains('div.file-name-string', destination)
            .should('be.visible')
            .trigger('drop', {dataTransfer});
    cy.get('button[role="switch"]').click();
    cy.contains('button', 'Upload').click();
});

Cypress.Commands.add('uploadMultiFiles', (filenames, destination) => {
    const dataTransfer = new DataTransfer();
    cy.get('body').type('{ctrl}', {release: false}); // hold ctrl
    filenames.forEach(filename => {
        cy.get('#daemon-browser').contains('div.file-name-string', filename)
                .should('be.visible').click().then(() => {
            dataTransfer.items.add(new File([''], filename));
        });
    });
    cy.get('body').type('{ctrl}'); // release ctrl
    cy.get('#daemon-browser').contains('div.file-name-string', filenames[0])
            .trigger('dragstart', {dataTransfer});
    cy.get('#bucket-browser').contains('div.file-name-string', destination)
            .should('be.visible')
            .trigger('drop', {dataTransfer});
    cy.get('button[role="switch"]').click();
    cy.contains('button', 'Upload').click();
});

Cypress.Commands.add('downloadS3File', (filename) => {
    const dataTransfer = new DataTransfer();
    cy.get('#bucket-browser').contains('div.file-name-string', filename)
            .should('be.visible').trigger('dragstart', {dataTransfer});
    cy.get('#daemon-browser').find('.mat-mdc-header-row').trigger('drop', {dataTransfer});
    cy.get('button[role="switch"]').click();
    cy.contains('button', 'Download').click();
});


Cypress.Commands.add('downloadMultiFiles', (filenames) => {
    const dataTransfer = new DataTransfer();
    cy.get('body').type('{ctrl}', {release: false}); // hold ctrl
    filenames.forEach(filename => {
        cy.get('#bucket-browser').contains('div.file-name-string', filename)
                .should('be.visible').click().then(() => {
            dataTransfer.items.add(new File([''], filename));
        });
    });
    cy.get('body').type('{ctrl}'); // release ctrl
    cy.get('#bucket-browser').contains('div.file-name-string', filenames[0])
            .trigger('dragstart', {dataTransfer});
    cy.get('#daemon-browser .mat-mdc-header-row')
            .trigger('drop', {dataTransfer});
    cy.get('button[role="switch"]').click();
    cy.contains('button', 'Download').click();
});

Cypress.Commands.add('clearCompletedJobs', () => {
    cy.get('.status-completed').contains('Completed').should('exist');
    cy.get('.mat-icon').contains('keyboard_double_arrow_down').click({force: true});
    cy.contains('button', 'Clear All Completed Jobs').click();
});


// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

