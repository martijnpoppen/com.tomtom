const { DateTime } = require('luxon');

sleep = async function (ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

rename = function (value) {
    return value.replace('IEC62196Type2', '');
};

getConnector = function (connector, powerKW) {
    return `(${rename(connector.type)}) - ${powerKW}KW`;
};

connectorAutoComplete = function (query, device) {
    let connectorList = device.connectorList.map((c) => ({ name: c }));

    return connectorList.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
};


getCurrentDateTime = function(homeyTimeZone) {
    // const now = DateTime.local({ zone: homeyTimeZone });
    //             const isoDate = this.formatDateToIso(now);
    const isodate = DateTime.local({ zone: homeyTimeZone })
                const date = DateTime.fromISO(`${isodate}`, { zone: homeyTimeZone });

                
    return isodate.toFormat('yyyy/MM/dd HH:mm:ss')
};


module.exports = {
    sleep,
    rename,
    getConnector,
    connectorAutoComplete,
    getCurrentDateTime
};
