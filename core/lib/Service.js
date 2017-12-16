'use strict'

const Promise = require('bluebird')

const Arguments = require('./bases/Arguments')
const Client = require('./bases/Client')
const Core = require('./bases/Core')
const Server = require('./bases/Server')

const serviceArguments = require('./arguments/service')

const Service = function () {
  // TODO, remove promise from constructor. Now it is useful only for error handling, implement it later, in upper layer

  return new Arguments(serviceArguments).get()
    .then((args) => {
      const core = new Core(args, 'service')
      const server = new Server(core)
      const client = new Client(core)

      return Promise.resolve({
        tracer: core.tracer,
        server: server,
        client: client
      })
    })
}

module.exports = Service
