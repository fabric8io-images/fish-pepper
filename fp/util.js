
exports.foreachParamValue = function(params, callback) {
  // Function for doing a fan-out on param values, called recursively
  var collect = function (types, values) {
    if (types.length === 0) {
      callback(values);
    } else {
      var type = types.shift();
      var paramValues = Object.keys(params.config[type]).sort();
      paramValues.forEach(function (paramValue) {
        if (paramValue === "default") {
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