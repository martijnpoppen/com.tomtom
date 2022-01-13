const Homey = require('homey');
const TomTom = require('../lib/tomtom');

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

                return true;
            } catch (error) {
                console.log(error);
                throw new Error(this.homey.__('pair.error'));
            }
        });

        session.setHandler('lookup', async (data) => {
            try {
                this.homey.app.log(`[Driver] ${this.id} - got data`, data);
                const address = data.search;

                this.config = { ...this.config, ...data };

                this.homey.app.log(`[Driver] ${this.id} - got data`, data);

                this.addressData = await this._TomTomClient.searchAddress(address);

                if (this.addressData && this.addressData.results && this.addressData.results.length) {
                    const address = this.addressData.results[0];

                    this.searchData = await this._TomTomClient.searchLatLong(address.position);

                    return this.searchData;
                }

                return false;
            } catch (error) {
                console.log(error);
                throw new Error(this.homey.__('pair.error'));
            }
        });

        session.setHandler('list_devices', async () => {
            this.homey.app.log(`[Driver] ${this.id} - this.searchData`, this.searchData);

            if (!this.searchData && !this.searchData.results) {
                return false;
            }

            const results = this.searchData.results.map((result) => ({
                name: result.poi.name,
                data: {
                    id: result.dataSources.chargingAvailability.id
                },
                settings: {
                    ...this.config,
                    chargingAvailability: result.dataSources.chargingAvailability.id
                }
            }));

            this.homey.app.log(`[Driver] ${this.id} - Found devices - `, results);

            return results;
        });
    }
};
