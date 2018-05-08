
const path = require('path')

const PORT = '3000'

const serviceUrl = function () {
  return `http://${process.env.host_name}:${PORT}`
}

module.exports = {
  service: {
    host: process.env.host_name,
    port: PORT,
    url: serviceUrl
  },
  paths: {
    domapicConfig: path.resolve(__dirname, '..', '..', process.env.app_path, '.domapic', 'service')
  },
  explicitServiceOptions: {
    path: process.env.app_path,
    hostName: process.env.host_name
  }
}
