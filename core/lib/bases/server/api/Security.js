'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const isPromise = require('is-promise')
const ipRangeCheck = require('ip-range-check')

const METHODS_PREFERENCE = ['jwt', 'apiKey']

const Security = function (core, supportedMethods) {
  const templates = core.utils.templates.compiled.server
  let authDisabledRangePromise

  const Authorize = function (authMethod) {
    return function (decoded) {
      return new Promise((resolve, reject) => {
        const result = authMethod(decoded)
        if (isPromise(result)) {
          result.then(() => {
            resolve()
            return Promise.resolve()
          }).catch((err) => {
            reject(err)
          })
        } else if (result === true) {
          resolve()
        } else {
          reject(new Error())
        }
      }).catch(() => {
        return Promise.reject(new core.errors.Forbidden(templates.authorizationFailedError()))
      })
    }
  }

  const getPreferredMethod = function (securityMethods) {
    return _.sortBy(securityMethods, (method) => {
      return METHODS_PREFERENCE.indexOf(method)
    })[0]
  }

  const verifySecurityHeaders = function (headers) {
    const methods = _.keys(headers)
    const methodToUse = methods.length > 1 ? getPreferredMethod(methods) : methods[0]
    const parsedHeader = supportedMethods[methodToUse].parseHeader ? supportedMethods[methodToUse].parseHeader(headers[methodToUse]) : headers[methodToUse]
    return supportedMethods[methodToUse].verify(parsedHeader)
  }

  const getSecurityHeaders = function (req, authMethods) {
    let headers = {}
    _.each(authMethods, (method) => {
      const header = req.headers[supportedMethods[method].header]
      if (header) {
        headers[method] = header
      }
    })
    if (_.isEmpty(headers)) {
      return Promise.reject(new core.errors.Unauthorized(templates.authenticationRequiredError({
        message: templates.authenticationHeadersNotFoundError()
      })))
    }
    return Promise.resolve(headers)
  }

  const getSecurityMethods = function (securityDefinitions) {
    return _.uniq(_.map(securityDefinitions, (security) => {
      const method = _.keys(security)[0]
      if (_.keys(supportedMethods).indexOf(method) < 0) {
        throw new core.errors.BadImplementation(templates.wrongAuthenticationMethod({
          method: method,
          supported: _.keys(supportedMethods)
        }))
      }
      return method
    }))
  }

  const getAuthDisabledRange = function (req) {
    if (!authDisabledRangePromise) {
      authDisabledRangePromise = core.config.get('authDisabled')
    }
    return authDisabledRangePromise
  }

  const authenticationIsDisabled = function (req) {
    return getAuthDisabledRange()
      .then((allowedRange) => {
        if (ipRangeCheck(req.ip, allowedRange)) {
          return core.tracer.warn(templates.disabledAuthenticationRequest({
            req: req
          })).then(() => {
            return Promise.resolve(true)
          })
        }
        return Promise.resolve(false)
      })
  }

  const checkAuth = function (req, res, next, authMethods, auth) {
    return getSecurityHeaders(req, authMethods)
        .then(verifySecurityHeaders)
        .then(auth)
        .then(() => {
          next()
          return Promise.resolve()
        })
  }

  const Middleware = function (securityDefinitions, authorize) {
    const authMethods = getSecurityMethods(securityDefinitions)
    const auth = new Authorize(authorize)
    return function (req, res, next) {
      authenticationIsDisabled(req)
        .then((disabled) => {
          if (disabled) {
            next()
            return Promise.resolve()
          }
          return checkAuth(req, res, next, authMethods, auth)
        })
        .catch((err) => {
          res.set({
            'WWW-Authenticate': 'Bearer realm="Domapic service", charset="utf-8"'
          })
          next(err)
        })
    }
  }

  return {
    Middleware: Middleware
  }
}

module.exports = Security
