module.exports = function (image, types, paramValues) {

  this.getPath = function (root) {
    return root + "/" + image.dir + "/" + paramValues.join("/");
  };

  this.getLabel = function () {
    return paramValues.join(", ");
  };

  function getVersion() {
    var versionsFromType = [];
    forEachParamValueConfig(function (config) {
      if (config && config.version) {
        versionsFromType.push(config.version);
      }
    });

    var buildVersion = image.config.buildVersion;
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

  this.getImageName = function () {
    var registry = image.config.registry ? image.config.registry + "/" : "";
    return registry + image.name + "-" + paramValues.join("-");
  };

  this.getImageNameWithVersion = function () {
    return this.getImageName() + ":" + getVersion();
  };

  this.getTags = function () {
    var ret = [];
    forEachParamValueConfig(function (config) {
      if (config && config.tags) {
        Array.prototype.push.apply(ret, config.tags);
      }
    });
    return ret;
  }

}

