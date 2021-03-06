const { connectorAutoComplete } = require('../helpers');

exports.init = async function (homey) {
    homey.app.trigger_AVAILABLE = homey.flow
        .getDeviceTriggerCard(`trigger_AVAILABLE`)
        .registerArgumentAutocompleteListener('connector', async (query, args) => connectorAutoComplete(query, args.device))
        .registerRunListener(async (args, state) => { homey.app.log('[trigger_AVAILABLE]', state, {...args, device: 'LOG'}); return args.connector.name === state.connector});

    homey.app.trigger_AVAILABLE_AMOUNT = homey.flow
        .getDeviceTriggerCard(`trigger_AVAILABLE_AMOUNT`)
        .registerArgumentAutocompleteListener('connector', async (query, args) => connectorAutoComplete(query, args.device))
        .registerRunListener(async (args, state) => { homey.app.log('[trigger_AVAILABLE_AMOUNT]', state, {...args, device: 'LOG'}); return args.connector.name === state.connector});   
}