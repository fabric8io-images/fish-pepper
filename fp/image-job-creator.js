exports.createJobs = function(image,params) {

  var jobs = [];

  // Function for doing a fan-out on param values, called recursively
  var collect = function (types, values) {
    if (types.length === 0) {
      jobs.push(createJob(image, params.types, values));
    } else {
      var type = types.shift();
      var paramValues = Object.keys(params.config[type]).sort();
      paramValues.forEach(function (paramValue) {
        var valuesClone = values.slice(0);
        valuesClone.push(paramValue);
        collect(types.slice(0), valuesClone);
      });
    }
  };

  collect(params.types.slice(0), []);
  return jobs;
};

// ====================================================================

function createJob(image, types, paramValues) {
  return {
      getPath: function (root) {
        return root + "/" + image.dir + "/" + paramValues.join("/");
      },

      getLabel: function () {
        return paramValues.join(", ");
      },

      getImageName: getImageName,

      getImageNameWithVersion: function () {
        return getImageName() + ":" + getVersion();
      },

      getTags: function () {
        var ret = [];
        forEachParamValueConfig(function (config) {
          if (config && config['fp.tags']) {
            Array.prototype.push.apply(ret, config['fp.tags']);
          }
        });
        return ret;
      }
    };

  // ==========================================================================================

  function getImageName()
  {
    var registry = image.config['fp.registry'] ? image.config['fp.registry'] + "/" : "";
    return registry + image.name + "-" + paramValues.join("-");
  }

  function getVersion() {
    var versionsFromType = [];
    forEachParamValueConfig(function (config) {
      if (config && config['fp.version']) {
        versionsFromType.push(config['fp.version']);
      }
    });

    var buildVersion = image.config['fp.build'];
    if (buildVersion) {
      versionsFromType.push(buildVersion);
    }
    if (versionsFromType.length > 0) {
      return versionsFromType.join("-");
    } else {
      return "latest";
    }
  }

  function forEachParamValueConfig(callback) {
    for (var i = 0; i < types.length; i++) {
      var c = image.config.config[types[i]][paramValues[i]];
      callback(c);
    }
  }
}
