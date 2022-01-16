"use strict";

const Homey = require("homey");
const flowConditions = require('./lib/flows/conditions');
const flowTriggers = require('./lib/flows/triggers');

class App extends Homey.App {
  log() {
    console.log.bind(this, "[log]").apply(this, arguments);
  }

  error() {
    console.error.bind(this, "[error]").apply(this, arguments);
  }

  // -------------------- INIT ----------------------

  async onInit() {
    this.log(`${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);

    await flowConditions.init(this.homey);
    await flowTriggers.init(this.homey);
  }
}

module.exports = App;
