'use strict';

const Homey = require('homey');
const flowActions = require('./lib/flows/actions');
const flowConditions = require('./lib/flows/conditions');
const flowTriggers = require('./lib/flows/triggers');

const _settingsKey = `${Homey.manifest.id}.settings`;

class App extends Homey.App {
    log() {
        console.log.bind(this, '[log]').apply(this, arguments);
    }

    error() {
        console.error.bind(this, '[error]').apply(this, arguments);
    }

    // -------------------- INIT ----------------------

    async onInit() {
        this.log(`${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);

        await this.initSettings();
        await flowActions.init(this.homey);
        await flowConditions.init(this.homey);
        await flowTriggers.init(this.homey);
    }

    async initSettings() {
        try {
            let settingsInitialized = false;
            this.homey.settings.getKeys().forEach((key) => {
                if (key == _settingsKey) {
                    settingsInitialized = true;
                }
            });

            if (settingsInitialized) {
                this.log('[initSettings] - Found settings key', _settingsKey);
                this.appSettings = this.homey.settings.get(_settingsKey);
            } else {
                this.log(`Initializing ${_settingsKey} with defaults`);
                await this.updateSettings({
                    API_KEY: null
                });
            }

            this.log('[onInit] - Loaded settings', this.appSettings);
        } catch (err) {
            this.error(err);
        }
    }

    async updateSettings(settings) {
        try {
            this.log('[updateSettings] - New settings:', settings);
            this.appSettings = settings;

            await this.homey.settings.set(_settingsKey, this.appSettings);
        } catch (err) {
            this.error(err);
        }
    }

    // ---------------------------- GETTERS/SETTERS ----------------------------------

    getSettings() {
        return this.appSettings;
    }
}

module.exports = App;
