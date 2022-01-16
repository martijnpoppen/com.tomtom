const { connectorAutoComplete } = require('../helpers');

exports.init = async function (homey) {
    const condition_AVAILABLE = homey.flow.getConditionCard('condition_AVAILABLE')
    condition_AVAILABLE.registerRunListener( async (args, state) =>  {
       homey.app.log('[condition_AVAILABLE]', state, {...args, device: 'LOG'});
       const connector = args.connector.name.replace(' ', '').split('-');
       return await args.device.getCapabilityValue(`measure_amount_available.${connector[1]}.${connector[0]}`) !== 0;
    }).registerArgumentAutocompleteListener('connector', async (query, args) => connectorAutoComplete(query, args.device));

    const condition_OCCUPIED = homey.flow.getConditionCard('condition_OCCUPIED')
    condition_OCCUPIED.registerRunListener( async (args, state) =>  {
       homey.app.log('[condition_OCCUPIED]', state, {...args, device: 'LOG'});
       const connector = args.connector.name.replace(' ', '').split('-');
       return await args.device.getCapabilityValue(`measure_occupied.${connector[1]}.${connector[0]}`) !== 0;
    }).registerArgumentAutocompleteListener('connector', async (query, args) => connectorAutoComplete(query, args.device));
};
