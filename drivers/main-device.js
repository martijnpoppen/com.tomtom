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

    async setTomTomClient(firstCall, overrideSettings = null) {
        const settings = overrideSettings ? overrideSettings : this.getSettings();
        try {
            this.homey.app.log(`[Device] - ${this.getName()} => setTomTomClient Got config`, settings);

            this._TomTomClient = await new TomTom({ ...settings });

            await this.setCapabilityValues(firstCall);
            await this.setAvailable();

            await this.updateTimeSetting(); // <-- update time here

            await this.setCapabilityValuesInterval(settings.update_interval);
        } catch (error) {
            this.homey.app.log(`[Device] ${this.getName()} - setTomTomClient - error =>`, error);
        }
    }

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

                if (perPowerLevel && settings.connectors.includes(rename(connector.type))) {
                    for (let i = 0; i < perPowerLevel.length; i += 1) {
                        const current = perPowerLevel[i];
                        const { powerKW, available, occupied } = current;
                        const get_available_old = this.getCapabilityValue(`get_available.${powerKW}.${rename(connector.type)}`);
                        const get_available_amount_old = this.getCapabilityValue(`measure_amount_available.${powerKW}.${rename(connector.type)}`);

                        await this.setCapabilityValue(`get_available.${powerKW}.${rename(connector.type)}`, !!parseInt(available));
                        await this.setCapabilityValue(`measure_amount_available.${powerKW}.${rename(connector.type)}`, parseInt(available));
                        await this.setCapabilityValue(`measure_occupied.${powerKW}.${rename(connector.type)}`, parseInt(occupied) || 0);

                        if (get_available_old !== !!parseInt(available)) {
                            await this.homey.app.trigger_AVAILABLE.trigger(
                                this,
                                {
                                    available: !!parseInt(available),
                                    occupied: !parseInt(available),
                                    amount_available: parseInt(available),
                                    amount_occupied: parseInt(occupied),
                                    connector: getConnector(connector, powerKW)
                                },
                                { connector: getConnector(connector, powerKW) }
                            );
                        }
                        if (get_available_amount_old !== parseInt(available)) {
                            await this.homey.app.trigger_AVAILABLE_AMOUNT.trigger(
                                this,
                                {
                                    available: !!parseInt(available),
                                    occupied: !parseInt(available),
                                    amount_available: parseInt(available),
                                    amount_occupied: parseInt(occupied),
                                    connector: getConnector(connector, powerKW)
                                },
                                { connector: getConnector(connector, powerKW) }
                            );
                        }
                    }
                } else {
                    this.homey.app.log(`[Device] ${this.getName()} - ${rename(connector.type)} | ${chargingAvailability} - perPowerLevel => ERROR (Nothing found)`, { availability, perPowerLevel });
                }
            }

            await this.updateTimeSetting(); // <-- update time also during interval updates

        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async updateTimeSetting() {
        const currentTime = new Date();
        const timezone = this.homey.clock.getTimezone();

        const parts = new Intl.DateTimeFormat('default', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: timezone
        }).formatToParts(currentTime);

        const dateParts = {};
        for (const part of parts) {
            if (part.type !== 'literal') {
                dateParts[part.type] = part.value;
            }
        }

        const updateTimeString = `${dateParts.day}-${dateParts.month}-${dateParts.year}, ${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;

        await this.setSettings({ update_time: updateTimeString });
        this.homey.app.log(`[Device] ${this.getName()} - update_time updated to: ${updateTimeString}`);
    }

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

                if (perPowerLevel) {
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
                } else {
                    this.homey.app.log(`[Device] ${this.getName()} - ${rename(connector.type)} | perPowerLevel => ERROR (Nothing found)`, { availability, perPowerLevel });
                }
            }
        }
    }

    onDeleted() {
        this.clearIntervals();
    }
};