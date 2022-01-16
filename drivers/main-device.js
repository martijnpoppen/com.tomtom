const Homey = require('homey');
const TomTom = require('../lib/tomtom');
const { sleep, rename, getConnector } = require('../lib/helpers');

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
        try {
            this.homey.app.log('[Device] - init =>', this.getName());
            this.setUnavailable(`Initializing ${this.getName()}`);

            await this.checkCapabilities();
            await this.setTomTomClient(true);

            await this.setAvailable();
        } catch (error) {
            this.homey.app.log(`[Device] ${this.getName()} - OnInit Error`, error);
        }
    }

    // ------------- Settings -------------
    async onSettings({ oldSettings, newSettings, changedKeys }) {
        this.homey.app.log(`[Device] ${this.getName()} - oldSettings`, oldSettings);
        this.homey.app.log(`[Device] ${this.getName()} - newSettings`, newSettings);

        if (changedKeys.length) {
            if (this.pollInterval) {
                this.clearIntervals();
            }

            await this.setTomTomClient(false, newSettings);
        }
    }

    // ------------- API -------------
    async setTomTomClient(firstCall, overrideSettings = null) {
        const settings = overrideSettings ? overrideSettings : this.getSettings();

        try {
            this.homey.app.log(`[Device] - ${this.getName()} => setTomTomClient Got config`, settings);

            this._TomTomClient = await new TomTom({ ...settings });

            await this.setCapabilityValues(firstCall);
            await this.setAvailable();
            await this.setCapabilityValuesInterval(settings.update_interval);
        } catch (error) {
            this.homey.app.log(`[Device] ${this.getName()} - setTomTomClient - error =>`, error);
        }
    }

    // ------------- CapabilityListeners -------------
    async setCapabilityValues(checkCapabilities = false) {
        this.homey.app.log(`[Device] ${this.getName()} - setCapabilityValues`);

        try {
            const settings = this.getSettings();
            const deviceInfo = await this._TomTomClient.getChargingAvailability(settings.chargingAvailability);

            this.homey.app.log(`[Device] ${this.getName()} - deviceInfo =>`, deviceInfo);

            const { connectors, chargingAvailability } = deviceInfo;

            if (checkCapabilities) {
                await this.checkSubCapabilities(connectors);
            }

            this.homey.app.log(`[Device] ${this.getName()}  - connectorList =>`, this.connectorList);

            for (const connector of connectors) {
                const { availability } = connector;
                const { perPowerLevel } = availability;

                if (settings.connectors.includes(rename(connector.type))) {
                    this.homey.app.log(`[Device] ${this.getName()} - ${rename(connector.type)} | ${chargingAvailability} - connector =>`, connector);
                    this.homey.app.log(`[Device] ${this.getName()} - ${rename(connector.type)} | ${chargingAvailability} - perPowerLevel =>`, perPowerLevel);

                    for (let i = 0; i < perPowerLevel.length; i += 1) {
                        const current = perPowerLevel[i];
                        const { powerKW, available, occupied } = current;
                        const get_available_old = this.getCapabilityValue(`get_available.${powerKW}.${rename(connector.type)}`);

                        await this.setCapabilityValue(`get_available.${powerKW}.${rename(connector.type)}`, !!parseInt(available));
                        await this.setCapabilityValue(`measure_amount_available.${powerKW}.${rename(connector.type)}`, parseInt(available));
                        await this.setCapabilityValue(`measure_occupied.${powerKW}.${rename(connector.type)}`, parseInt(occupied) || 0);

                        if (get_available_old !== !!parseInt(available)) {
                            await this.homey.app.trigger_AVAILABLE.trigger(
                                this,
                                { available: !!parseInt(available), amount_available: parseInt(available), amount_occupied: parseInt(occupied), connector: getConnector(connector, powerKW) },
                                { connector: getConnector(connector, powerKW) }
                            );
                        }
                    }
                }
            }
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    // ------------- Intervals -------------
    async setCapabilityValuesInterval(update_interval) {
        try {
            const REFRESH_INTERVAL = 1000 * update_interval;

            this.homey.app.log(`[Device] ${this.getName()} - pollInterval =>`, REFRESH_INTERVAL, update_interval);

            await sleep(3000);

            this.pollInterval = this.homey.setInterval(this.setCapabilityValues.bind(this), REFRESH_INTERVAL);
        } catch (error) {
            this.setUnavailable(error);
            this.homey.app.log(error);
        }
    }

    async clearIntervals() {
        this.homey.app.log(`[Device] ${this.getName()} - clearIntervals`);
        await this.homey.clearInterval(this.pollInterval);
    }

    // ------------- Capabilities -------------
    async checkCapabilities() {
        const driverManifest = this.driver.manifest;
        const driverCapabilities = driverManifest.capabilities;

        const deviceCapabilities = this.getCapabilities();

        this.homey.app.log(`[Device] ${this.getName()} - Found capabilities =>`, deviceCapabilities);
        this.homey.app.log(`[Device] ${this.getName()} - Driver capabilities =>`, driverCapabilities);

        if (deviceCapabilities.length !== driverCapabilities.length) {
            await this.updateCapabilities(driverCapabilities, deviceCapabilities);
        }

        return deviceCapabilities;
    }

    async updateCapabilities(driverCapabilities, deviceCapabilities) {
        this.homey.app.log(`[Device] ${this.getName()} - Add new capabilities =>`, driverCapabilities);
        try {
            // deviceCapabilities.forEach((c) => {
            //     this.removeCapability(c);
            // });
            // await sleep(2000);
            driverCapabilities.forEach((c) => {
                this.addCapability(c);
            });
            await sleep(2000);
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async checkSubCapabilities(connectors) {
        const settings = this.getSettings();
        this.homey.app.log(`[Device] ${this.getName()} - checkSubCapabilities`);

        this.connectorList = [];

        for (const connector of connectors) {
            if (settings.connectors.includes(rename(connector.type))) {
                const { availability } = connector;
                const { perPowerLevel } = availability;

                for (let i = 0; i < perPowerLevel.length; i += 1) {
                    const current = perPowerLevel[i];
                    const { powerKW } = current;

                    await this.addCapability(`measure_amount_available.${powerKW}.${rename(connector.type)}`);
                    await this.setCapabilityOptions(`measure_amount_available.${powerKW}.${rename(connector.type)}`, {
                        title: {
                            en: `Vrij ${getConnector(connector, powerKW)}`,
                            nl: `Vrij ${getConnector(connector, powerKW)}`
                        }
                    });

                    await this.addCapability(`get_available.${powerKW}.${rename(connector.type)}`);
                    await this.setCapabilityOptions(`get_available.${powerKW}.${rename(connector.type)}`, {
                        title: {
                            en: `Vrij ${getConnector(connector, powerKW)}`,
                            nl: `Vrij ${getConnector(connector, powerKW)}`
                        }
                    });

                    await this.addCapability(`measure_occupied.${powerKW}.${rename(connector.type)}`);
                    await this.setCapabilityOptions(`measure_occupied.${powerKW}.${rename(connector.type)}`, {
                        title: {
                            en: `Occupied ${getConnector(connector, powerKW)}`,
                            nl: `Bezet ${getConnector(connector, powerKW)}`
                        }
                    });

                    await sleep(1000);
                    this.connectorList = [...this.connectorList, `${getConnector(connector, powerKW)}`];
                }
            }
        }
    }

    onDeleted() {
        this.clearIntervals();
    }
};
