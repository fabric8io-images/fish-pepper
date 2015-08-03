// ===========================================================
// Context Object when creating all the docker files

var _ = require('underscore');
var dot = require('dot');
dot.templateSettings.strip = false;
var fs = require('fs');
var util = require("./util");

exports.forEachTemplate = function(ctx, image, params, blocks, templFunc) {
  var dir = ctx.root + "/" + image.dir;

  var templateContext = createContext(ctx.root, image, params, parseTemplates(dir), blocks);
  util.foreachParamValue(params, function(paramValues) {
    templFunc(templateContext, paramValues);
  });
};

function parseTemplates(dir) {
  var templ_dir = dir + "/templates";
  var templates = fs.readdirSync(templ_dir);

  var parsedTemplates = [];
  templates.forEach(function (template) {
    parsedTemplates.push({
      "templ": dot.template(fs.readFileSync(templ_dir + "/" + template)),
      "file":  template
    });
  });
  return parsedTemplates;
}

function createContext(root, image, params, templates, blocks) {

  return {

    getParamConfigFor: getParamConfigFor,

    getPath: function (values, file) {
      return root + "/" + image.dir + "/" + values.join("/") + (file ? "/" + file : "");
    },

    forEachTemplate: function (fn) {
      templates.forEach(fn);
    },

    fillTemplate: function (paramValues, file, template) {
      var context = getTemplateContext(paramValues, fillBlocks(paramValues));
      var newContent = template(context).trim() + "\n";
      if (!newContent.length) {
        return "SKIPPED".grey;
      } else {
        var exists = fs.existsSync(file);
        var oldContent = exists ? fs.readFileSync(file, "utf8") : undefined;
        if (!oldContent || newContent.trim() !== oldContent.trim()) {
          fs.writeFileSync(file, newContent, {"encoding": "utf8"});
          return exists ? "CHANGED".green : "NEW".yellow;
        }
      }
      return undefined;
    },

    checkForMapping: function (file) {
      if (/^__.*$/.test(file)) {
        var mapping = undefined;
        params.types.forEach(function (param) {
          var mappings = getParamConfigFor(param)["mappings"];
          if (!mappings) {
            mappings = image.config.config["default"].mappings;
          }
          if (mappings) {
            mapping = mappings[file];
          }
        });
        return mapping;
      } else {
        return file;
      }
    }
  };

  // ===========================================================================================
  // Private methods

  function getParamConfigFor(type, val) {
      var c = image.config.config[type] || {};
      return c[val] || {};
  }

  function getTemplateContext(paramValues,blocks) {
    var paramConfig = {};
    var paramValMap = {};
    for (var i = 0; i < params.types.length; i++) {
      var type = params.types[i];
      var val = paramValues[i];
      paramConfig[type] = params.config[type][val];
      paramValMap[type] = val;
    }

    return _.extend(
      {},
      image.config,
      blocks ? {"blocks": blocks} : {},
      {
        "param":  paramValMap,
        "config": _.extend({}, image.config.config['default'], paramConfig)
      });
  }

  function fillBlocks(paramValues) {
    var ret = {};
    for (var key in blocks) {
      if (blocks.hasOwnProperty(key)) {
        var template = dot.template(blocks[key]);
        ret[key] = template(getTemplateContext(paramValues));
      }
    }
    return ret;
  }

};





