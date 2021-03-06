'use strict'

const _ = require('lodash')
const Promise = require('bluebird')

const bases = require('./bases')
const utils = require('./utils')
const serviceArguments = require('./arguments/service')
const coreArguments = require('./arguments/core')
const AboutOperations = require('./api/about/Operations')
const aboutOpenApi = require('./api/about/openapi.json')
const ConfigOperations = require('./api/config/Operations')
const configOpenApi = require('./api/config/openapi.json')

const extendServiceArguments = function (customConfig) {
  const allServiceArguments = _.extend({}, coreArguments, serviceArguments)
  let error
  customConfig = customConfig || {}
  _.each(customConfig, (optionProperties, optionName) => {
    if (allServiceArguments[optionName]) {
      error = new Error(utils.templates.compiled.cli.overwriteOptionError({
        optionName: optionName
      }))
    }
  })
  if (error) {
    return Promise.reject(error)
  }
  return Promise.resolve(_.extend({}, serviceArguments, customConfig))
}

const Service = function (options = {}) {
  return extendServiceArguments(options.customConfig)
    .then(bases.Arguments)
    .then((baseArgs) => {
      return baseArgs.get()
    })
    .then((args) => {
      const core = new bases.Core(args, 'service', options.packagePath, options.type)
      const server = new bases.Server(core)
      const client = new bases.Client(core)

      const logCreated = function () {
        return core.config.get()
          .then((configuration) => {
            return core.tracer.debug(core.utils.templates.compiled.service.serviceCreated({
              config: configuration
            }))
          })
      }

      return Promise.all([
        server.extendOpenApi(aboutOpenApi),
        server.addOperations(new AboutOperations(core)),
        server.extendOpenApi(configOpenApi),
        server.addOperations(new ConfigOperations(core)),
        client.init()
      ]).then(() => {
        return logCreated()
          .then(() => {
            return Promise.resolve({
              client: {
                Connection: client.Connection
              },
              config: core.config,
              errors: core.errors,
              info: core.info,
              server: server,
              storage: core.storage,
              tracer: core.tracer,
              utils: core.utils
            })
          })
      })
    })
}

module.exports = Service
