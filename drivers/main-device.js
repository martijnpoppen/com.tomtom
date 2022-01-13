const Homey = require('homey');
const TomTom = require('../lib/tomtom');
const { sleep } = require('../lib/helpers');

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
        try {
            this.homey.app.log('[Device] - init =>', this.getName());
            this.setUnavailable(`Initializing ${this.getName()}`);

            await this.checkCapabilities();
            await this.setTomTomClient();

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

            await this.setTomTomClient(newSettings);
        }
    }

    // ------------- API -------------
    async setTomTomClient(overrideSettings = null) {
        const settings = overrideSettings ? overrideSettings : this.getSettings();

        try {
            this.homey.app.log(`[Device] - ${this.getName()} => setTomTomClient Got config`, settings);

            this._TomTomClient = await new TomTom({ ...settings });

            await this.setCapabilityValues(true);
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

            for(const connector of connectors) {
                const { availability } = connector;
                const { current } = availability;
                const { perPowerLevel } = availability;
                const [power] = perPowerLevel
                
                if(settings.connectors.includes(connector.type)) {
                    this.homey.app.log(`[Device] ${this.getName()} - ${connector.type} | ${chargingAvailability} - connector =>`, connector);
                    this.homey.app.log(`[Device] ${this.getName()} - ${connector.type} | ${chargingAvailability} - perPowerLevel =>`, perPowerLevel);    

                    await this.setCapabilityValue(`get_available.${connector.type}`, !!parseInt(current.available));
                    await this.setCapabilityValue(`measure_amount_available.${connector.type}`, parseInt(current.available));
                    await this.setCapabilityValue(`measure_occupied.${connector.type}`, parseInt(current.occupied) || 0);
                    await this.setCapabilityValue(`measure_kwh.${connector.type}`, power.powerKW || 0);
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
            deviceCapabilities.forEach((c) => {
                this.removeCapability(c);
            });
            await sleep(2000);
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

        for(const connector of connectors) {
            if(settings.connectors.includes(connector.type)) {
                if (!this.hasCapability(`measure_amount_available.${connector.type}`)) {
                    await this.addCapability(`measure_amount_available.${connector.type}`);
                    await this.setCapabilityOptions(`measure_amount_available.${connector.type}`, {
                        title: {
                            en: `Aantal (${connector.type})`,
                            nl: `Aantal (${connector.type})`
                        }
                    });
                    await sleep(1000);
                }

                if (!this.hasCapability(`get_available.${connector.type}`)) {
                    await this.addCapability(`get_available.${connector.type}`);
                    await this.setCapabilityOptions(`get_available.${connector.type}`, {
                        title: {
                            en: `Vrij (${connector.type})`,
                            nl: `Vrij (${connector.type})`
                        }
                    });
                    await sleep(1000);
                }

                if (!this.hasCapability(`measure_occupied.${connector.type}`)) {
                    await this.addCapability(`measure_occupied.${connector.type}`);
                    await this.setCapabilityOptions(`measure_occupied.${connector.type}`, {
                        title: {
                            en: `Occupied (${connector.type})`,
                            nl: `Bezet (${connector.type})`
                        }
                    });
                    await sleep(1000);
                }

                if (!this.hasCapability(`measure_kwh.${connector.type}`)) {
                    await this.addCapability(`measure_kwh.${connector.type}`);
                    await this.setCapabilityOptions(`measure_kwh.${connector.type}`, {
                        title: {
                            en: `KWH (${connector.type})`,
                            nl: `KWH (${connector.type})`
                        }
                    });
                    await sleep(1000);
                }
            }
        }
    }

    onDeleted() {
        this.clearIntervals();
    }
};
