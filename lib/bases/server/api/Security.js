'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const isPromise = require('is-promise')
const ipRangeCheck = require('ip-range-check')

const METHODS_PREFERENCE = ['jwt', 'apiKey']
const ANONYMOUS_USER = {
  user: 'anonymous'
}

const anonymousData = function () {
  return _.clone(ANONYMOUS_USER)
}

const Security = function (core, supportedMethods, authorizationRoles, disabledMethod) {
  const templates = core.utils.templates.compiled.server
  let authDisabledRangePromise
  let authEnabledPromise

  const applyAuthorizationRole = function (roleName, decoded) {
    if (authorizationRoles[roleName]) {
      return authorizationRoles[roleName](decoded)
    }
    return core.tracer.error(templates.authorizationRoleNotDefinedError({
      roleName: roleName
    })).then(() => {
      return Promise.reject(new Error())
    })
  }

  const Authorize = function (authMethod) {
    if (!authMethod) {
      return function (decoded) {
        return Promise.resolve(decoded)
      }
    }
    return function (decoded, params, body) {
      return new Promise((resolve, reject) => {
        const result = _.isFunction(authMethod) ? authMethod(decoded, params, body) : applyAuthorizationRole(authMethod, decoded)
        if (isPromise(result)) {
          result.then(() => {
            resolve(decoded)
          }).catch((err) => {
            reject(err)
          })
        } else if (result === true) {
          resolve(decoded)
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

  const getSecurityMethods = function (securityDefinitions, routePath, httpMethod) {
    const securityMethods = _.compact(_.uniq(_.map(securityDefinitions, (security) => {
      const method = _.keys(security)[0]
      if (_.keys(supportedMethods).indexOf(method) < 0) {
        core.tracer.trace(templates.notImplementedAuthenticationMethod({
          method: method,
          supported: _.keys(supportedMethods)
        }), templates.securityMethodDisabledForRoute({
          securityMethod: method,
          routePath: routePath,
          method: httpMethod
        }))
        return null
      }
      return method
    })))

    if (!securityMethods.length) {
      core.tracer.warn(templates.securityDisabledForRoute({
        routePath: routePath,
        method: httpMethod
      }))
    }

    return securityMethods
  }

  const getAuthEnabled = function () {
    if (!authEnabledPromise) {
      authEnabledPromise = core.config.get('auth')
    }
    return authEnabledPromise
  }

  const getAuthDisabledRange = function () {
    if (!authDisabledRangePromise) {
      authDisabledRangePromise = core.config.get('authDisabled')
    }
    return authDisabledRangePromise
  }

  const authenticationIsDisabled = function (req) {
    return Promise.props({
      disabledRange: getAuthDisabledRange(),
      authEnabled: getAuthEnabled()
    }).then(securityConfig => {
      if (!securityConfig.authEnabled) {
        return Promise.resolve(true)
      } else if (ipRangeCheck(req.ip, securityConfig.disabledRange)) {
        return core.tracer.warn(templates.disabledAuthenticationRequest({
          req: req
        })).then(() => {
          return Promise.resolve(true)
        })
      }
      return Promise.resolve(false)
    })
  }

  const executeAuthHandler = (req, res, next, userData, auth) => {
    return auth(userData, {
      path: req.params,
      query: req.query
    }, req.body).then((userData) => {
      req.user = userData
      next()
      return Promise.resolve()
    })
  }

  const checkAuth = function (req, res, next, authMethods, auth) {
    return getSecurityHeaders(req, authMethods)
      .then(verifySecurityHeaders)
      .then(decodedUserData => {
        return executeAuthHandler(req, res, next, decodedUserData, auth)
      })
  }

  const Middleware = function (securityDefinitions, authorize, routePath, method) {
    const authMethods = getSecurityMethods(securityDefinitions, routePath, method)
    const auth = new Authorize(authorize)
    if (!authMethods.length) {
      return function (req, res, next) {
        req.user = anonymousData()
        next()
      }
    }
    return function (req, res, next) {
      authenticationIsDisabled(req)
        .then(disabled => {
          if (disabled) {
            if (disabledMethod) {
              return disabledMethod()
                .then(userData => {
                  req.user = userData
                  next()
                })
            }
            req.user = anonymousData()
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

  const Anonymous = function () {
    return function (req, res, next) {
      req.user = anonymousData()
      next()
    }
  }

  return {
    Middleware: Middleware,
    Anonymous: Anonymous
  }
}

module.exports = Security
