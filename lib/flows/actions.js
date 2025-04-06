exports.init = async function (homey) {
  homey.flow.getActionCard('action_update_chargepoints_flow').registerRunListener(async (args, state) => {
    try {
      // Get the driver with ID "charging_availability" from app.json
      const driver = homey.drivers.getDriver('charging_availability');

      // Retrieve all devices associated with the driver
      const devices = driver.getDevices();

      if (!devices || devices.length === 0) {
        throw new Error("No devices found");
      }

      // Loop over each device and trigger an update
      for (const device of devices) {
        console.log(`Updating device: ${device.getName()}`);
        // Call the update method implemented in the device (setTomTomClient)
        await device.setTomTomClient(false);
      }

      return true;
    } catch (error) {
      console.error("Error updating devices:", error);
      throw error;
    }
  });
};
