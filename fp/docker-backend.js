var Docker = require('dockerode');
var _ = require('lodash');
var fs = require('fs');

exports.create = function(options) {
  return new Docker(getDockerConnectionsParams(options));
};

function getDockerConnectionsParams(options) {
  var dockerUrl = options.connect || process.env.DOCKER_HOST;
  if (!dockerUrl) {
    return {
      "socketPath": "/var/run/docker.sock"
    };
  }
  var parts = dockerUrl.match(/^([^:]+):\/\/(.+?):?(\d+)?$/i);
  if (parts[1] == "unix") {
      return { "socketPath": dockerUrl };
  } else {
    return addSslIfNeeded({"host": parts[2], "port": parts[3] || 2375}, options);
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

