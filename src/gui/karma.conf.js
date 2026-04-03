// Karma configuration
// Generated on Wed Sep 06 2023 12:10:25 GMT-0700 (Pacific Daylight Time)

module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ['jasmine', '@angular-devkit/build-angular'],
        plugins: [
            require('karma-jasmine'),
            require('karma-chrome-launcher'),
            require('karma-jasmine-html-reporter'),
            require('karma-coverage'),
            require('karma-mocha-reporter'),
        ],
        client: {
            clearContext: false, // leave Jasmine Spec Runner output visible in browser
            jasmine: {
                random: false,
            },
        },
        coverageReporter: {
            dir: require('path').join(__dirname, './coverage/gui'),
            reporters: [
                {type: 'lcovonly', subdir: '.'},
                {type: 'html', subdir: '.'},
                {type: 'text-summary', subdir: '.'},
            ],
            fixWebpackSourcePaths: true,
        },
        files: [],
        exclude: [],
        preprocessors: {},
        reporters: ['progress', 'coverage', 'mocha'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        browsers: ['ChromiumHeadlessNoSandbox'],
        customLaunchers: {
            ChromiumHeadlessNoSandbox: {
                base: 'ChromiumHeadless',
                flags: [
                    '--no-sandbox',
                ],
            },
        },
        singleRun: false,
        restartOnFileChange: true,
        captureTimeout: 180000,
        browserDisconnectTimeout: 180000,
        browserDisconnectTolerance: 3,
        browserNoActivityTimeout: 180000,
        mochaReporter: {
            ignoreSkipped: true,
        },
    })
}
