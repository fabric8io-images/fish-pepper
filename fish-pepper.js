#!/bin/sh
':' //; exec "`command -v node || command -v nodejs`" "$0" "$@"

var fs = require('fs');
var path = require('path');
require('colors');
var _ = require('lodash');
var yaml = require('js-yaml');
var pjson = require('./package.json');

// Own modules:
var templateEngine = require('./fp/template-engine');
var dockerBackend = require('./fp/docker-backend');
var blockLoader = require('./fp/block-loader');
var imageBuilder = require('./fp/image-builder');
var manifestBuilder = require('./fp/manifest-builder');

var util = require('./fp/util');

// Set to true for extra debugging
var DEBUG = false;

(function () {

  var ctx;
  try {
    ctx = setupContext();

    // All supported servers which must be present as a sub-directory
    var images = getImages(ctx);
    if (!images) {
      console.log("No images found.".yellow);
      process.exit(0);
    }
    processImages(ctx, images)
  } catch (e) {
    console.log(e.message.red);
    if (!ctx || ctx.options.verbose) {
      console.log(e.stack.grey);
    }
  }
}).future()();

// ===============================================================================

function processImages(ctx, images) {
  // Create build files
  createDockerFileDirs(ctx, images);

  // If desired create Docker images
  if (ctx.commands.build) {
    buildImages(ctx, images);
  }

  // If desired create Docker manifests
  if (ctx.commands.manifest) {
    buildManifests(ctx, images);
  }
}

// == COMMMANDS ===========================================================================

// "make"
function createDockerFileDirs(ctx, images) {
  console.log("\n* " + "Creating Docker Builds".cyan);

  images.forEach(function (image) {
    console.log("  " + image.dir.magenta);
    var blocks = blockLoader.loadLocal(ctx.root + "/" + image.dir + "/blocks");
    var params = extractParams(image, ctx);

    templateEngine.fillTemplates(ctx, image, params, _.extend(blocks,ctx.blocks), createParamIgnoreMap(image));
  });
}

// "build"
function buildImages(ctx, images) {
  console.log("\n* " + "Building Images".cyan);

  var docker = dockerBackend.create(ctx.options);

  fs.open('push-images.log', 'w', function(err, fd) { 
    fs.close(fd, function() {
      console.log('truncated \'push-images.log\' successfully');
    });
  });
  
  images.forEach(function(image) {
    console.log("  " + image.dir.magenta);
    var params = extractParams(image, ctx);
    var valuesExpanded = [];
    util.foreachParamValue(params,function(values) {
      valuesExpanded.push(values);
    },createParamIgnoreMap(image));
    imageBuilder.build(ctx.root, docker, params.types, valuesExpanded, image, { nocache: ctx.options.nocache, debug: DEBUG });
  });
  
}

// "manifest"
function buildManifests(ctx, images) {
  console.log("\n* " + "Building Manifests".cyan);

  var docker = dockerBackend.create(ctx.options);

  fs.open('manifest.log', 'w', function(err, fd) { 
    fs.close(fd, function() {
      console.log('\'manifest.log\' written');
    });
  });
  
  images.forEach(function(image) {
    console.log("  " + image.dir.magenta);
    var params = extractParams(image, ctx, 'arch');
    var valuesExpanded = [];
    util.foreachParamValue(params,function(values) {
      valuesExpanded.push(values);
    },createParamIgnoreMap(image));
    manifestBuilder.build(ctx.root, docker, params.types, valuesExpanded, image, { nocache: ctx.options.nocache, debug: DEBUG });
  });
  
}

// ===================================================================================

function getImages(ctx) {
  var imageNames;

  if (!ctx.root) {
    return undefined;
  }
  var allImageNames = extractImages(ctx.root);
  if (ctx.options.image) {
    imageNames = _.filter(allImageNames, function (image) {
      return _.contains(ctx.options.image, image);
    });
  } else if (ctx.options.all) {
    imageNames = allImageNames;
  } else {
    // Determine image name from the current working directory
    // which is somewhere below
    var currentDir = process.cwd();
    var imageMatch =
      currentDir.match("^" + ctx.root + "/(.+)(/images/?.*)") ||
      currentDir.match("^" + ctx.root + "/(.+)");
    if (imageMatch && !imageMatch[1].startsWith("images")) {
      // Include multiple images if we are 'in between' the root dir
      // and the image directory
      imageNames = _.filter(allImageNames,function(name) {
        return name.match("^" + imageMatch[1]);
      });
    } else {
      imageNames = allImageNames;
    }
  }
  return _.map(imageNames, function (name) {
    var config = getImageConfig(ctx, name);
    var repoUser = config.fpConfig('repoUser');
    repoUser =  repoUser ? repoUser + "/" : "";
    var fullImageName = config.fpConfig('name') || repoUser + name.replace(/\//g,'-'); // replace dir seps with '-' for deeper image defs
    return {
      "dir": name,
      "name": fullImageName,
      "config": config};
  })
}

function extractImages(root) {
  var ret = [];

  function _findConfigs(dir) {
    if (existsConfig(dir,"images")) {
      ret.push(dir.replace(new RegExp("^" + root + "/?"),""));
    } else {
      fs.readdirSync(dir).forEach(function (f) {
        var full = dir + "/" + f;
        if (fs.statSync(full).isDirectory()) {
          _findConfigs(full);
        }
      });
    }
  }

  _findConfigs(root);
  return ret;
}

function getImageConfig(ctx, image) {
  var ret =
    _.merge(
      {},
      ctx.config,
      readConfig(ctx.root + "/" + image, "images"));

  ret.fpConfig = function(key) {
    return ret['fish-pepper'] ? ret['fish-pepper'][key] : undefined;
  };
  return ret;
}

// Return all params in the right order and the individual configuration per param
function extractParams(image, ctx, reduceValue) {
  var config = image.config;
  var types = config.fpConfig('params').slice(0);
  var paramValues = undefined;
  var paramConfigs = config.config;
  if (ctx) {
    var opts = ctx.options ? ctx.options : {all: true};
    paramValues = extractFixedParamValues(opts, ctx.root + "/" + image.dir);
    paramConfigs = opts.experimental || paramValues ? config.config : removeExperimentalConfigs(config.config);
  }
  
  if (reduceValue) {
    types.pop();
  }

  // Filter out configuration which are not selected by the user
  var reducedParamConfig = reduceConfig(types,paramConfigs,paramValues);
  return {
    // Copy objects
    types:  types,
    config: reducedParamConfig
  };
}

function reduceConfig(types,config,paramValues) {
  var ret = _.extend({},config);
  if (paramValues) {
    for (var i = 0; i < paramValues.length; i++) {
      var type = types[i];
      var param = paramValues[i];
      if (!config[type][param]) {
        throw new Error("No parameter value '" + param + "' defined for type " + type);
      }
      _.keys(config[type]).forEach(function(key) {
        if (key != param && key != "default") {
          delete ret[type][key];
        }
      });
    }
  }
  return ret;
}

// Return a set of parameter values (in the right order) if the user
// select parameters either explicitly or implicitly. Or undefined if no
// parameter restriction applies.
function extractFixedParamValues(opts,topDir) {
  // Include all for sure
  if (opts.all) {
    return undefined;
  }
  // Specified on command line
  if (opts.param) {
    return opts.param.split(/\s*,\s*/);
  }
  // Implicit determined by current working dir
  var currentDir = process.cwd();
  var paramRest = currentDir.match(new RegExp("^" + topDir + "/?images/([^/]+)/?.*$"));
  if (paramRest) {
    return paramRest[1].split(/\//);
  } else {
    return undefined;
  }
}

// The param-ignore-map contains the information which prio parameter value combination triggers
// to ignore a certain parameter for building an image
function createParamIgnoreMap(image) {
  var config = image.config.config;
  var ret = {};
  forEachImageFishPepperConfig(config,function(type,paramValue,fpConfig) {
    if (fpConfig['ignore-for']) {
      ret[type] = ret[type] || {};
      ret[type][paramValue] = fpConfig['ignore-for'].slice(0);
    }
  });
  return Object.keys(ret).length > 0 ? ret : undefined;
}

function removeExperimentalConfigs(config) {
  var ret = _.extend({},config);
  forEachImageFishPepperConfig(config,function(type,paramValue,fpConfig) {
    if (fpConfig.experimental) {
        delete ret[type][paramValue];
    }
  });
  return ret;
}

function forEachImageFishPepperConfig(config,callback) {
  _.keys(config).forEach(function(type) {
    _.keys(config[type]).forEach(function(paramValue) {
      var typeConfig = config[type][paramValue];
      if (typeConfig['fish-pepper']) {
        callback(type,paramValue,typeConfig['fish-pepper']);
      }
    });
  });
}

function setupContext() {
  var Getopt = require('node-getopt');
  var getopt = new Getopt([
    ['i', 'image=ARG+', 'Images to create (e.g. "tomcat")'],
    ['p', 'param=ARG', 'Params to use for the build. Should be a comma separate list, starting from top'],
    ['a', 'all', 'Process all parameters images'],
    ['c', 'connect', 'Docker URL (default: $DOCKER_HOST)'],
    ['d', 'dir=ARG', 'Directory holding the image definitions'],
    ['n', 'nocache', 'Don\'t cache when building images'],
    ['e', 'experimental', 'Include images which are marked as experimental'],
    ['v', 'verbose', 'Print out more information'],
    ['h', 'help', 'display this help']
  ]);

  var opts = getopt.parseSystem();

  // Get commands ...
  var commands = {};
  opts.argv.forEach(function(cmd) {
    commands[cmd] = 1;
  });

  var ctx = {};
  ctx.options = opts.options || {};
  ctx.commands = commands;
  ctx.root = getRootDir(ctx.options.dir);
  if (ctx.root) {
    ctx.config = readConfig(ctx.root, "fish-pepper");
    ctx.blocks = _.extend(
      blockLoader.loadRemote(ctx.root,ctx.config.blocks),
      blockLoader.loadLocal(ctx.root + "/blocks"));
  } else {
    ctx.config = {};
    ctx.blocks = {};
  }
  if (ctx.options.help) {
    getopt.setHelp(createHelp(ctx));
    getopt.showHelp();
    return process.exit(0);
  }
  return ctx;
}

function getRootDir(givenDir) {
  if (!givenDir) {
    var fpDir = process.cwd();
    return findConfig(fpDir, "fish-pepper");
  } else {
    if (!existsConfig(givenDir, "fish-pepper")) {
      throw new Error("Cannot find fish-pepper config" + (givenDir ? " in directory " + givenDir : ""));
    }
    return givenDir;
  }
}

function existsConfig(dir, file) {
  return _.some(["json", "yml", "yaml"], function (ext) {
    return fs.existsSync(dir + "/" + file + "." + ext)
  });
}

function readConfig(dir, file) {
  var base = dir + "/" + file;
  var ret;
  if (fs.existsSync(base + ".json")) {
    ret = JSON.parse(fs.readFileSync(base + ".json", "utf8"));
  }
  _.each(["yml", "yaml"], function (ext) {
    if (fs.existsSync(base + "." + ext)) {
      ret = yaml.safeLoad(fs.readFileSync(base + "." + ext, "utf8"));
    }
  });
  if (!ret) {
    throw new Error("No " + file + ".json, " + file + ".yaml or " + file + ".yml found in " + dir);
  }
  return ret;
}

function findConfig(dir, file) {
  if (dir === "/") {
    return undefined;
  } else if (existsConfig(dir, file)) {
    return dir;
  } else {
    return findConfig(path.normalize(dir + "/.."), file);
  }
}

function createHelp(ctx) {
  var help =
    "Usage: fish-pepper [OPTION] \<command\>\n" +
    "\n" +
    "Multidimensional Docker Build Generator\n" +
    "\n" +
    "[[OPTIONS]]\n" +
    "\n" +
    "The argument is interpreted as the command to perform. The following commands are supported:\n" +
    "    make  -- Create Docker build files from templates\n" +
    "    build -- Build Docker images from generated build files. Implies 'make'\n" +
    "\n" +
    "The configuration is taken from the file \"fish-pepper.json\" or \"fish-pepper.yml\" from the current directory\n" +
    "or from the directory provided with the option '-d'. Alternatively the first parent directory\n" +
    "containing one of the configuration files is used.\n" +
    "\n" +
    "Examples:\n" +
    "\n" +
    "   # Find a 'fish-pepper.yml' in this or a parent directory and use\n" +
    "   # the images found there to create multiple Docker build directories.\n" +
    "   fish-pepper\n" +
    "\n" +
    "   # Create all image families found in \"example\" directory\n" +
    "   fish-pepper -d example\n" +
    "\n" +
    "   # Create only the image family \"java\" in \"example\" and build the images, too\n" +
    "   fish-pepper -d example -i java build\n" +
    "\n" +
    "Please refer to https://github.com/rhuss/fish-pepper for further documentation.\n" +
    "\n";
  var images = getImages(ctx);
  if (images) {
    help +=
      "\n" +
      "Images:\n\n";
    images.forEach(function (image) {
      var indent = "                                                   ".substring(0,image.dir.length + 5);
      var prefix = "   " + image.dir + ": ";
      util.foreachParamValue(extractParams(image),function(values) {
        help += prefix + values.join(", ") + "\n";
        prefix = indent;
      });
    });
  } else {
    help += "\nNo images found\n";
  }
  help +="\n-----\nfish-pepper " + pjson.version;

  return help;
}
