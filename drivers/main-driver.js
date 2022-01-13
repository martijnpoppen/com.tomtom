const Homey = require('homey');
const TomTom = require('../lib/tomtom');
const { rename } = require('../lib/helpers');

module.exports = class mainDriver extends Homey.Driver {
    onInit() {
        this.homey.app.log('[Driver] - init', this.id);
        this.homey.app.log(`[Driver] - version`, Homey.manifest.version);
    }

    deviceType() {
        return 'other';
    }

    async onPair(session) {
        session.setHandler('login', async (data) => {
            try {
                this.homey.app.log(`[Driver] ${this.id} - got data`, data);
                this.config = { ...data };

                this._TomTomClient = await new TomTom({ ...data });
                this.selectedDevice = null;
                this.errorMsg = false;

                return true;
            } catch (error) {
                console.log(error);
                throw new Error(this.homey.__('pair.error'));
            }
        });

        session.setHandler('lookup', async (data) => {
            try {
                this.homey.app.log(`[Driver] ${this.id} - got data`, data);

                if(this.errorMsg) {
                    session.emit('lookup_error', this.errorMsg);
                    this.errorMsg = false;
                }

                const address = data.search;
                this.config = { ...this.config, ...data };

                this.addressData = await this._TomTomClient.searchAddress(address);

                if (this.addressData && this.addressData.results && this.addressData.results.length) {
                    const address = this.addressData.results[0];

                    this.searchData = await this._TomTomClient.searchLatLong(address.position);

                    if (!this.searchData || !this.searchData.results) {
                        return null;
                    } else {
                        return this.searchData;
                    }
                }

               return null;
            } catch (error) {
                console.log(error);
            }
        });

        session.setHandler('list_devices', async () => {
            this.homey.app.log(`[Driver] ${this.id} - this.searchData`, this.searchData);

            if (!this.searchData || !this.searchData.results || !this.searchData.results.length) {
                this.errorMsg = this.homey.__('pair.error_empty');
                return await session.prevView();
            }

            const results = this.searchData.results.map((result) => ({
                name: result.poi.name,
                data: {
                    id: result.dataSources.chargingAvailability.id
                },
                settings: {
                    ...this.config,
                    chargingAvailability: result.dataSources.chargingAvailability.id,
                    connectors: []
                }
            }));

            this.homey.app.log(`[Driver] ${this.id} - Found devices - `, results);

            return results;
        });

        session.setHandler('list_devices_selection', async (data) => {
            this.homey.app.log(`[Driver] ${this.id} - list_devices_selection - `, data);
            this.selectedDevice = data[0];
            return this.selectedDevice;
        });

        session.setHandler('get_device', async () => {
            return await session.showView('list_connectors');
        });


        session.setHandler('list_connectors', async () => {
            this.homey.app.log(`[Driver] ${this.id} - this.selectedDevice`, this.selectedDevice);

            if (!this.selectedDevice) {
                return false;
            }

            const chargingAvailability = await this._TomTomClient.getChargingAvailability(this.selectedDevice.data.id);

            this.homey.app.log(`[Driver] ${this.id} - chargingAvailability - `, chargingAvailability.connectors);

            if (chargingAvailability && chargingAvailability.connectors) {
                const results = chargingAvailability.connectors.map((connector) => rename(connector.type));

                session.emit('get_connectors', results);
                return results;
            }

            return false;
        });

        session.setHandler('list_connectors_selection', async (data) => {
            this.homey.app.log(`[Driver] ${this.id} - list_connectors_selection - `, data);

           this.selectedDevice.settings.connectors = [...data.selectedConnectors];

           return this.selectedDevice;
        });

        session.setHandler('add_device', async (data) => {
            try {
                return this.selectedDevice;
            } catch (error) {
                return Promise.reject(error);
            }
        });
    }
};
