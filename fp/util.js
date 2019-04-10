var fs = require('fs');
var mkdirp = require('mkdirp');

exports.foreachParamValue = function(params, callback, ignoreMap) {
  // Function for doing a fan-out on param values, called recursively
  // ignoreMap: Map (param-type -> param-value -> list of value combinations to ignore for this param-value)
  var collect = function (types, values) {
    if (types.length === 0) {
      callback(values);
    } else {
      var type = types.shift();
      var paramValues = Object.keys(params.config[type]).sort();
      paramValues.forEach(function (paramValue) {
        if (paramValue === "default") {
          return;
        } else if (ignoreMap && ignoreMap[type] && ignoreMap[type][paramValue] &&
                   ignoreForParams(ignoreMap[type][paramValue], values)) {
          // Ignore the given paramValue for the combination of previous given params
          return;
        }
        var valuesClone = values.slice(0);
        valuesClone.push(paramValue);
        collect(types.slice(0), valuesClone);
      });
    }
  };

  collect(params.types.slice(0), []);
};

function ignoreForParams(ignorePatterns, values) {
  var ret = false;
  ignorePatterns.forEach(function(parts) {
    var match = true;
    for (var i = 0; i < parts.length && i < values.length; i++) {
      if (parts[i] != values[i] && parts[i] != "*") {
        match = false;
        break;
      }
    }
    ret |= match;
  });
  return ret;
}

exports.ensureDir = function(dir) {
  if (!fs.existsSync(dir)) {
    mkdirp.sync(dir, 0755);
  }
  if (!fs.statSync(dir).isDirectory()) {
    throw new Error(dir + " is not a directory");
  }
};
