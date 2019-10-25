var util = require("./util");

exports.createImageNames = function(image,paramTypes, allParamValues) {
  var imageNames = [];
  allParamValues.forEach(function(paramValues) {
    imageNames.push(createImageName(image,paramTypes,paramValues));
  });
  return imageNames;
};

// ====================================================================

function createImageName(image, types, paramValues) {
  return {
      getPath: function (root) {
        return root + "/" + image.dir + "/images/" + paramValues.join("/");
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
          var tags = fpConfig(config,'tags');
          if (tags) {
            Array.prototype.push.apply(ret, tags);
          }
        });
        return ret;
      }
    };

  // ==========================================================================================

  function getImageName()
  {
    var params = normalizedParams();

    var registry = image.config.fpConfig('registry') ? image.config.fpConfig('registry') + "/" : "";
    return registry + image.name + "-" + params.join("-"); 
  }

  function getVersion() {
    var versionsFromType = [];
    forEachParamValueConfig(function (config) {
      var version = fpConfig(config,'version');
      if (version) {
        versionsFromType.push(version);
      }
    });

    var buildVersion = image.config.fpConfig('build');
    if (buildVersion) {
      versionsFromType.push(buildVersion);
    }
    if (versionsFromType.length > 0) {
      return versionsFromType.join("-");
    } else {
      return "latest";
    }
  }

  function normalizedParams(key) {
    var params = [];
    var index = 0;
    forEachParamValueConfig(function(config) {
      var name = fpConfig(config, 'name');

      params.push(name || paramValues[index]);
      index++;
    });
    return params;
  }

  function fpConfig(config, key) {
    return config && config['fish-pepper'] ? config['fish-pepper'][key] : undefined;
  }

  function forEachParamValueConfig(callback) {
    for (var i = 0; i < types.length; i++) {
      var c = image.config.config[types[i]][paramValues[i]];
      callback(c);
    }
  }
}
