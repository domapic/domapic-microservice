
const _ = require('lodash')
const Promise = require('bluebird')

const test = require('narval')

const getResult = {
  options: {
    color: false,
    name: 'testing',
    logLevel: 'info',
    path: undefined,
    port: 3000
  },
  defaults: {
    color: true,
    logLevel: 'info',
    port: 3000,
    authDisabled: ['127.0.0.1', '::1/128'],
    saveConfig: false,
    rejectUntrusted: false,
    hostName: '',
    auth: true
  },
  defaultsToStore: {
    color: true,
    logLevel: 'info',
    port: 3000,
    authDisabled: ['127.0.0.1', '::1/128'],
    rejectUntrusted: false,
    hostName: '',
    auth: true
  },
  explicit: {
    name: 'testing'
  }
}

const cliCommandsMethods = function () {
  const config = {
    get: test.sinon.stub().usingPromise(Promise).resolves(_.extend(
      {},
      getResult.defaults,
      getResult.explicit
    ))
  }
  const tracer = {
    error: test.sinon.stub().usingPromise(Promise).resolves()
  }
  return {
    config: config,
    tracer: tracer,
    get: () => {
      return Promise.resolve({
        config: config,
        tracer: tracer
      })
    }
  }
}

const options = {
  name: 'fooService',
  path: '/fooPath',
  logLevel: 'debug'
}

const terminalWidth = 500

const Stub = function () {
  return {
    get: test.sinon.stub().usingPromise(Promise).resolves(_.clone(getResult)),
    runCommand: test.sinon.stub()
  }
}

module.exports = {
  Stub: Stub,
  options: options,
  getResult: getResult,
  terminalWidth: terminalWidth,
  cliCommandsMethods: cliCommandsMethods
}
