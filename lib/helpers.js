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

module.exports = {
    sleep,
    rename,
    getConnector,
    connectorAutoComplete
};
