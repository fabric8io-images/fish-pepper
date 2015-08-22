// ===========================================================
// Context Object when creating all the docker files

var _ = require('underscore');
var dot = require('dot');
dot.templateSettings.strip = false;
dot.templateSettings.varname = "fp";

var fs = require('fs');
var util = require("./util");
var mkdirp = require('mkdirp');
var path = require('path');

exports.forEachTemplate = function(ctx, image, params, blocks, templFunc) {
  var dir = ctx.root + "/" + image.dir;

  var templateContext = createContext(ctx.root, image, params, parseTemplates(dir), blocks);
  util.foreachParamValue(params, function(paramValues) {
    templFunc(templateContext, paramValues);
  });
};

function parseTemplates(dir) {
  var templ_dir = dir + "/templates";
  var parsedTemplates = [];

  (function recurseRead(sub) {
    var files = fs.readdirSync(templ_dir + (sub ? "/" + sub : ""));
    files.forEach(function (file) {
      var path = sub ? sub + "/" + file : file;
      if (fs.statSync(templ_dir + "/" + path).isDirectory()) {
        recurseRead(path);
      } else {
        parsedTemplates.push({
          "templ": dot.template(fs.readFileSync(templ_dir + "/" + path)),
          "file":  path,
          "dir": sub
        });
      }
    });
  })();

  return parsedTemplates;
}


function createContext(root, image, params, templates, blocks) {

  return {

    getParamConfigFor: getParamConfigFor,

    forEachTemplate: function (fn) {
      templates.forEach(fn);
    },

    fillTemplate: function (paramValues, templateFile, template, dir) {
      var path = getPath(paramValues);
      ensureDir(path);
      if (dir) {
        ensureDir(path + "/" + dir);
      }
      file = path + "/" + templateFile;
      var context = getTemplateContext(paramValues);
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

  function getPath(values, file) {
      return root + "/" + image.dir + "/images/" + values.join("/") + (file ? "/" + file : "");
  }

  function getTemplateContext(paramValues) {
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
      {
        "block":  createBlockFunction(paramValues),
        "param":  paramValMap,
        "config": _.extend({}, image.config.config['default'], paramConfig)
      });
  }

  function createBlockFunction(paramValues) {
    return function (key) {
      if (!blocks[key]) {
        return undefined;
      }

      var templateContext = getTemplateContext(paramValues);
      // Add arguments variables to context: 0: name of the block | 1,2,3,... extra arguments used)
      templateContext.blockArgs = arguments;

      // Copy over files attached to block if changed
      copyBlockFiles(key, templateContext, paramValues);
      return blocks[key].text ?
        (dot.template(blocks[key].text))(templateContext) :
        undefined;
    }
  }

  function copyBlockFiles(key, templateContext, paramValues) {
    var files = blocks[key].files || [];
    files.forEach(function (file) {
      var base = path.parse(file).base;
      var toCopy = fs.readFileSync(file);
      var newContent = (dot.template(toCopy))(templateContext);
      var targetFile = getPath(paramValues, base);
      var oldContent = fs.existsSync(targetFile) ? fs.readFileSync(targetFile) : undefined;
      if (!oldContent || oldContent != newContent) {
        fs.writeFileSync(targetFile, newContent);
        console.log("       " + key + "." + file.replace(/.*\/([^\/]+)$/, "$1") + ": " +
                    (oldContent ? "NEW".yellow : "CHANGED".green));
      }
    });
  }

  function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      mkdirp.sync(dir, 0755);
    }
    if (!fs.statSync(dir).isDirectory()) {
      throw new Error(dir + " is not a directory");
    }
  }
}





