var Docker = require('dockerode');
var _ = require('underscore');
var fs = require('fs');

exports.create = function(options) {
  return new Docker(getDockerConnectionsParams(options));
};

function getDockerConnectionsParams(options) {
  if (options.host) {
    return addSslIfNeeded({
      "host": options.host,
      "port": options.port || 2375
    }, options);
  } else if (process.env.DOCKER_HOST) {
    var parts = process.env.DOCKER_HOST.match(/^tcp:\/\/(.+?)\:?(\d+)?$/i);
    if (parts !== null) {
      return addSslIfNeeded({
        "host": parts[1],
        "port": parts[2] || 2375
      }, options);
    } else {
      return {
        "socketPath": process.env.DOCKER_HOST
      };
    }
  } else {
    return {
        "socketPath": "/var/run/docker.sock"
    };
  }
}

function addSslIfNeeded(param, options) {
  var port = param.port;
  if (port === "2376") {
    // Its SSL
    var certPath = options.certPath || process.env.DOCKER_CERT_PATH || process.env.HOME + ".docker";
    return _.extend(param, {
      protocol: "https",
      ca:       fs.readFileSync(certPath + '/ca.pem'),
      cert:     fs.readFileSync(certPath + '/cert.pem'),
      key:      fs.readFileSync(certPath + '/key.pem')
    });
  } else {
    return _.extend(param, {
      protocol: "http"
    });
  }
}

