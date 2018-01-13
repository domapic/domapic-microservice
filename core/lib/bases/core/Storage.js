'use strict'

const _ = require('lodash')
const Promise = require('bluebird')

const Storage = function (fileName, paths, errors) {
  let getDataPromise
  let data

  if (!fileName) {
    throw new errors.BadData('No file name provided')
  }

  const fullClone = function (data) {
    if (_.isObject(data)) {
      return JSON.parse(JSON.stringify(data))
    }
    return data
  }

  const loadFile = function () {
    return paths.ensureJSON(fileName)
        .then(paths.readJSON)
  }

  const saveData = function () {
    return paths.writeJSON(fileName, data)
  }

  const getData = function () {
    if (!getDataPromise) {
      getDataPromise = loadFile()
        .then((fileData) => {
          data = fileData
          return Promise.resolve(data)
        })
    }
    return getDataPromise
  }

  const get = function (key) {
    return getData()
      .then(() => {
        if (key) {
          return !_.isUndefined(data[key]) ? Promise.resolve(fullClone(data[key])) : Promise.reject(new errors.BadData('Invalid storage key: ' + key))
        }
        return Promise.resolve(fullClone(data))
      })
  }

  const set = function (key, value) {
    value = fullClone(value)
    key = fullClone(key)
    if (_.isUndefined(value)) {
      value = key
      key = null
    }
    if (key !== null && !_.isUndefined(key) && !_.isString(key)) {
      return Promise.reject(new errors.BadData('Key to be set must be an string'))
    }
    if (!value) {
      return Promise.reject(new errors.BadData('No data provided to be set'))
    }
    return getData()
      .then(() => {
        if (key) {
          data[key] = value
        } else {
          data = value
        }
        saveData()
        return Promise.resolve(fullClone(key ? data[key] : data))
      })
  }

  const remove = function (key) {
    if (!key) {
      return Promise.reject(new errors.BadData('No key provided to be removed'))
    }
    return getData()
      .then(() => {
        delete data[key]
        saveData()
        return Promise.resolve(fullClone(data))
      })
  }

  return {
    get: get,
    remove: remove,
    set: set
  }
}

module.exports = Storage