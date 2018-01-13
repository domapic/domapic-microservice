'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const hbs = require('hbs')

const openApiBase = require('./openapi.json')

const OpenApi = function (core) {
  const templates = core.utils.templates.compiled
  let addBasePromise
  let openapi = JSON.parse(JSON.stringify(openApiBase))

  const stringTemplate = function (source, data) {
    return hbs.compile(source)(_.isObject(data) ? data : {data: data})
  }

  const addInfo = function (configuration) {
    openapi.info.version = stringTemplate(openapi.info.version, '1.0.0')
    openapi.info.title = stringTemplate(openapi.info.title, configuration.name)
    openapi.info.description = stringTemplate(openapi.info.description, 'Domapic service') // TODO From options
    // TODO, read from package.json
    // TODO, add contact and license from package.json
    // ID storage
    /* "contact": {
      "name": "Swagger API Team",
      "email": "foo@example.com",
      "url": "http://domapic.com"
    },
    "license": {
      "name": "MIT",
      "url": "http://github.com/gruntjs/grunt/blob/master/LICENSE-MIT"
    } */
    openapi.servers[0].url = stringTemplate(openapi.servers[0].url, {
      protocol: configuration.sslKey ? 'https' : 'http',
      host: 'localhost',
      port: configuration.port
    })
  }

  const addBase = function () {
    if (!addBasePromise) {
      addBasePromise = core.config.get()
        .then((configuration) => {
          return addInfo(configuration)
        })
    }
    return addBasePromise
  }

  const addTag = function (tag) {
    const similarTag = _.filter(openapi.tags, (existantTag) => {
      return existantTag.name === tag.name
    })
    if (similarTag.length) {
      return Promise.reject(new core.errors.Conflict(templates.server.apiAlreadyExistsError({
        item: 'tag',
        name: tag.name
      })))
    }
    openapi.tags.push(tag)
    return Promise.resolve(tag)
  }

  const addTags = function (tagsToAdd) {
    return Promise.map(tagsToAdd, addTag)
  }

  const extendComponents = function (components) {
    let errors = []
    _.each(components, (properties, type) => {
      openapi.components[type] = openapi.components[type] || {}
      _.each(properties, (component, componentName) => {
        if (openapi.components[type][componentName]) {
          errors.push(type + ' - ' + componentName)
        } else {
          openapi.components[type][componentName] = component
        }
      })
    })

    if (errors.length) {
      return Promise.reject(new core.errors.Conflict(templates.server.apiAlreadyExistsError({
        item: 'component',
        name: errors.join(',')
      })))
    }
    return Promise.resolve(components)
  }

  const mustHaveBadDataResponse = function (methodObject) {
    return !!methodObject.parameters || !!methodObject.requestBody
  }

  const ensureResponse500 = function (methodObject) {
    methodObject.responses = methodObject.responses || {}
    if (!methodObject.responses['500']) {
      methodObject.responses['500'] = {
        '$ref': '#/components/responses/UnexpectedError'
      }
    }
  }

  const ensureResponse422 = function (methodObject) {
    if (mustHaveBadDataResponse(methodObject)) {
      if (!methodObject.responses['422']) {
        methodObject.responses['422'] = {
          '$ref': '#/components/responses/BadDataError'
        }
      }
    }
  }

  const parameterAlreadyExists = function (parameter, parameters) {
    return _.filter(parameters, (storedParameter) => {
      return storedParameter.in === parameter.in && storedParameter.name === parameter.name
    }).length > 0
  }

  const getPathParameters = function (pathObject) {
    let parameters = []
    _.each(pathObject, (pathProperties) => {
      _.each(pathProperties.parameters, (parameter) => {
        if (parameter.in === 'path' && !parameterAlreadyExists(parameter, parameters)) {
          parameters.push(_.clone(parameter))
        }
      })
    })
    return parameters
  }

  const getOptionsMethod = function (pathObject) {
    const tags = _.uniq(_.flatten(_.map(pathObject, (pathProperties) => {
      return pathProperties.tags
    })))
    const pathParameters = getPathParameters(pathObject)

    let options = {
      security: [],
      tags: tags,
      summary: templates.openapi.optionsSummary(),
      description: templates.openapi.optionsDescription(),
      responses: {
        '200': {
          '$ref': '#/components/responses/OptionsSuccess'
        },
        '500': {
          '$ref': '#/components/responses/UnexpectedError'
        }
      }
    }

    if (pathParameters.length) {
      options.parameters = pathParameters
    }

    return options
  }

  const extendPaths = function (paths) {
    let errors = []
    _.each(paths, (pathMethods, routePath) => {
      _.each(pathMethods, (methodProperties, methodName) => {
        openapi.paths[routePath] = openapi.paths[routePath] || {}
        if (openapi.paths[routePath][methodName]) {
          errors.push(routePath + ' - ' + methodName)
        } else {
          ensureResponse500(methodProperties)
          ensureResponse422(methodProperties)
          openapi.paths[routePath][methodName] = methodProperties
        }
      })
      openapi.paths[routePath].options = getOptionsMethod(pathMethods, routePath)
    })
    if (errors.length) {
      return Promise.reject(new core.errors.Conflict(templates.server.apiAlreadyExistsError({
        item: 'path',
        name: errors.join(',')
      })))
    }
    return Promise.resolve(paths)
  }

  const extend = function (partialOpenApi) {
    return addBase()
      .then(() => {
        return extendComponents(partialOpenApi.components || {})
      })
      .then(() => {
        return addTags(partialOpenApi.tags || [])
      })
      .then(() => {
        return extendPaths(partialOpenApi.paths || {})
      })
  }

  const get = function () {
    return Promise.resolve(openapi)
  }

  return {
    get: get,
    extend: extend
  }
}

module.exports = OpenApi
