'use strict'

const serviceArguments = require('../arguments/service')

const start = function (config, cli) {
  const templates = cli.utils.templates.compiled.cli

  return cli.tracer.info(templates.startingService({
    name: config.name
  }))
    .then(() => {
      return cli.process.start(config)
    })
    .then(() => {
      const templatesData = {
        customName: cli.utils.cli.usedCustomName(config.name, cli.info),
        usedCommand: cli.utils.cli.usedCommand()
      }
      return cli.tracer.group([
        {info: templates.stopServiceHelp(templatesData)},
        {info: templates.displayLogsHelp(templatesData)},
        {debug: ['Config:', config]}
      ])
    })
}

module.exports = {
  processName: 'service',
  describe: 'Start the service',
  cli: 'start [name]',
  options: serviceArguments,
  command: start
}
