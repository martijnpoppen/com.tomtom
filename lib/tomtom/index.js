const https = require('https');
const axios = require('axios');


class TomTom {
    constructor(params) {
        this.timeout = parseInt(params.timeout) || 5000; //request timeout

        this.api_key = params.apikey;

        this._isDebugMode = params.debug || false;

        this.axiosClient = axios.create({
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            }),
            timeout: 0
        });
    }

    async searchAddress(value) {
        const encodedValue = encodeURIComponent(value.trim())

        const apiUrl = `https://api.tomtom.com/search/2/geocode/${encodedValue}.json`

        const params = new URLSearchParams({
            storeResult: false,
            view: 'Unified',
            key: this.api_key
        }).toString();


        const req = await this.axiosClient.get(`${apiUrl}?${params}`);


        if (req.status === 200) {
            if(req.data && req.data.results && !req.data.results.length) {
                return this.searchPoi(value);
            }

            return req.data;
        }

        return false;
    }

    async searchPoi(value) {
        const encodedValue = encodeURIComponent(value.trim())

        const apiUrl = `https://api.tomtom.com/search/2/poiSearch/${encodedValue}.json`

        const params = new URLSearchParams({
            storeResult: false,
            view: 'Unified',
            relatedPois: 'off',
            key: this.api_key
        }).toString();


        const req = await this.axiosClient.get(`${apiUrl}?${params}`);


        if (req.status === 200) {
            return req.data;
        }

        return false;
    }

    searchLatLong = async function (value, categorySet = 7309) {
        const apiUrl = 'https://api.tomtom.com/search/2/nearbySearch/.json';

        const params = new URLSearchParams({
            lat: value.lat,
            lon: value.lon,
            radius: 10000,
            categorySet,
            relatedPois: 'off',
            view: 'Unified',
            key: this.api_key
        }).toString();


        const req = await this.axiosClient.get(`${apiUrl}?${params}`);


        if (req.status === 200) {
            return req.data;
        }

        return false;
    };

    getChargingAvailability = async function (id) {
        const apiUrl = 'https://api.tomtom.com/search/2/chargingAvailability.json';

        const params = new URLSearchParams({
            chargingAvailability: id,
            key: this.api_key
        }).toString();


        const req = await this.axiosClient.get(`${apiUrl}?${params}`);


        if (req.status === 200) {
            return req.data;
        }

        return false;
    };
}

module.exports = TomTom;
