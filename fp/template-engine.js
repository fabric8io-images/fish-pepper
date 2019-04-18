// ===========================================================
// Context Object when creating all the docker files

var _ = require('lodash');
var dot = require('dot');
dot.templateSettings.strip = false;
dot.templateSettings.varname = "fp";

var fs = require('fs');
var util = require("./util");
var path = require('path');

exports.fillTemplates = function (ctx, image, params, blocks, paramIgnoreMap) {
  var dir = ctx.root + "/" + image.dir;

  var fillFunc = createFillFunction(parseTemplates(dir));
  util.foreachParamValue(params, function (paramValues) {
    fillFunc(paramValues);
  },paramIgnoreMap);

  // ===========================================================================================
  // Private methods

  function parseTemplates(dir) {
    var templ_dir = dir + "/templates";
    var parsedTemplates = [];
    var mappedFileTemplates = [];
    (function recurseRead(sub) {
      var files = fs.readdirSync(templ_dir + (sub ? "/" + sub : ""));
      files.forEach(function (file) {
        var path = sub ? sub + "/" + file : file;
        if (fs.statSync(templ_dir + "/" + path).isDirectory()) {
          recurseRead(path);
        } else {
          var template = {
            "templ": dot.template(fs.readFileSync(templ_dir + "/" + path)),
            "file":  path,
            "dir":   sub
          };
          isMappedFile(file) ? mappedFileTemplates.push(template) : parsedTemplates.push(template);
        }
      });
    })();

    // Mapped files at the end so that the can overwrite plain files which act as default
    return _.flatten([parsedTemplates, mappedFileTemplates]);
  }


  function createFillFunction(templates) {
    return function (paramValues) {
      console.log("    " + paramValues.join(", ").green);
      templates.forEach(function (template) {
        var file = checkForMapping(paramValues,template.file);
        if (!file) {
          // Skip any file flagged as being mapped but no mapping was found
          return;
        }
        fillTemplate(paramValues, file, template.templ, template.dir);
      });
    }
  }

  function getPath(values, file) {
    return ctx.root + "/" + image.dir + "/images/" + values.join("/") + (file ? "/" + file : "");
  }

  function getTemplateContext(paramValues) {
    var paramConfig = {};
    var paramValMap = {};
    for (var i = 0; i < params.types.length; i++) {
      var type = params.types[i];
      var val = paramValues[i];
      paramConfig[type] = _.extend({},params.config[type].default,params.config[type][val]);
      paramValMap[type] = val;
    }

    return _.extend(
      {},
      image.config,
      {
        "block":  createBlockFunction(paramValues),
        "param":  paramValMap,
        "config": _.extend({}, image.config.config.default, paramConfig)
      });
  }

  function fillTemplate(paramValues, templateFile, template, dir) {
    var path = getPath(paramValues);
    util.ensureDir(path);
    if (dir) {
      util.ensureDir(path + "/" + dir);
    }
    var file = path + "/" + templateFile;
    var context = getTemplateContext(paramValues);
    var newContent = template(context).trim() + "\n";
    if (!newContent.length) {
      logFile(templateFile, "SKIPPED".grey);
    } else {
      var exists = fs.existsSync(file);
      var oldContent = exists ? fs.readFileSync(file, "utf8") : undefined;
      if (!oldContent || newContent.trim() !== oldContent.trim()) {
        fs.writeFileSync(file, newContent, {"encoding": "utf8"});
        logFile(templateFile, exists ? "CHANGED".green : "NEW".yellow);
      }
    }
  }

  // Check for mappings on various level, along the parameter order
  function checkForMapping(paramValues,file) {
    if (isMappedFile(file)) {
      for (var i = 0; i < params.types.length; i++) {
        var paramConfig = image.config.config[params.types[i]];
        var key = paramValues[i];
        if (paramConfig[key]) {
          var fpConfig = paramConfig[key]["fish-pepper"];
          if (fpConfig) {
            var mappings = fpConfig.mappings;
            if (mappings && mappings[file]) {
              return mappings[file];
            }
          }
        }
      }
      return undefined;
    } else {
      return file;
    }
  }

  function isMappedFile(file) {
    return /^__.*$/.test(file);
  }

  function createBlockFunction(paramValues) {
    return function (key) {
      if (!blocks[key]) {
        return undefined;
      }

      var templateContext = getTemplateContext(paramValues);
      // Add arguments variables to context: 0: name of the block | 1,2,3,... extra arguments used)
      var subSnippet, optsIdx;
      if (arguments[1] && typeof arguments[1] == "string") {
        subSnippet = arguments[1];
        optsIdx = 2;
      } else {
        subSnippet = "default";
        optsIdx = 1;
      }
      var opts = arguments[optsIdx] && typeof arguments[optsIdx] == "object" ? arguments[optsIdx] : {};
      templateContext.blockOpts = opts;

      // Copy over files attached to block if changed
      if (!opts["fp-no-files"]) {
        if (opts["fp-bin-files"]) {
          copyBlockBinaryFiles(key, paramValues);
        } else {
          copyBlockFiles(key, templateContext, paramValues);
        }
      }
      return blocks[key]["text"] && blocks[key]["text"][subSnippet] ?
        (dot.template(blocks[key]["text"][subSnippet]))(templateContext) :
        undefined;
    }
  }

  function copyBlockBinaryFiles(key, paramValues) {
    var files = blocks[key].files || [];
    files.forEach(function (file) {
      var base = path.parse(file).base;
      var targetFile = getPath(paramValues, base);
      var existingFile = fs.existsSync(targetFile);
      var newSize = fs.statSync(file).size;
      var oldSize = existingFile ? fs.statSync(targetFile).size : 0;
      if (! existingFile || newSize != oldSize) {
        fs.copyFileSync(file, targetFile);
        logFile(file, !existingFile ? "NEW".yellow : "CHANGED".green, key);
      }
    });
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
        logFile(file, oldContent ? "NEW".yellow : "CHANGED".green, key);
      }
    });
  }

  function logFile(file, txt, prefix) {
    console.log("       " + (prefix ? prefix + "." : "") +
                file.replace(/.*\/([^\/]+)$/, "$1") + ": " + txt);
  }
};


