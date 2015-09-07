#!/bin/sh
':' //; exec "`command -v node || command -v nodejs`" "$0" "$@"

var fs = require('fs');
var path = require('path');
require('colors');
var _ = require('underscore');
var yaml = require('js-yaml');
var pjson = require('./package.json');

// Own modules:
var templateEngine = require('./fp/template-engine');
var dockerBackend = require('./fp/docker-backend');
var blockLoader = require('./fp/block-loader');
var imageBuilder = require('./fp/image-builder');

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
}

// == COMMMANDS ===========================================================================

// "make"
function createDockerFileDirs(ctx, images) {
  console.log("\n* " + "Creating Docker Builds".cyan);

  images.forEach(function (image) {
    console.log("  " + image.dir.magenta);
    var blocks = blockLoader.loadLocal(ctx.root + "/" + image.dir + "/blocks");
    var params = extractParams(image, ctx);

    templateEngine.fillTemplates(ctx, image, params, _.extend(blocks,ctx.blocks));
  });
}

// "build"
function buildImages(ctx, images) {
  console.log("\n* " + "Building Images".cyan);

  var docker = dockerBackend.create(ctx.options);

  images.forEach(function(image) {
    console.log("  " + image.dir.magenta);
    var params = extractParams(image, ctx);
    imageBuilder.build(ctx.root, docker, params, image, { nocache: ctx.options.nocache, debug: DEBUG });
  });
}
// ===================================================================================

function getImages(ctx) {
  var imageNames;

  if (!ctx.root) {
    return undefined;
  }
  var allImageNames = _.filter(fs.readdirSync(ctx.root), function (f) {
    var p = ctx.root + "/" + f;
    return fs.statSync(p).isDirectory() && existsConfig(p, "images");
  });

  if (ctx.options.image) {
    imageNames = _.filter(allImageNames, function (image) {
      return _.contains(ctx.options.image, image);
    });
  } else if (ctx.options.all) {
    imageNames = allImageNames;
  } else {
    var currentDir = process.cwd();
    var imageMatch = currentDir.match("^" + ctx.root + "/([^/]+)");
    if (imageMatch) {
      imageNames = [ imageMatch[1] ]
    } else {
      imageNames = allImageNames;
    }
  }
  return _.map(imageNames, function (name) {
    var config = getImageConfig(ctx, name);
    var repoUser = config.fpConfig('repoUser');
    repoUser =  repoUser ? repoUser + "/" : "";
    var fullImageName = config.fpConfig('name') || repoUser + name;
    return {
      "dir": name,
      "name": fullImageName,
      "config": config};
  })
}

function getImageConfig(ctx, image) {
  var ret =
    _.extend(
      {},
      ctx.config,
      readConfig(ctx.root + "/" + image, "images"));

  ret.fpConfig = function(key) {
    return ret['fish-pepper'] ? ret['fish-pepper'][key] : undefined;
  };
  return ret;
}

// Return all params in the right order and the individual configuration per param
function extractParams(image, ctx) {
  var config = image.config;
  var types = config.fpConfig('params').slice(0);
  var paramValues = undefined;
  var paramConfigs = config.config;
  if (ctx) {
    var opts = ctx.options ? ctx.options : {all: true};
    paramValues = extractFixedParamValues(opts, ctx.root + "/" + image.dir);
    paramConfigs = opts.experimental || paramValues ? config.config : removeExperimentalConfigs(config.config);
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
  var paramRest = currentDir.match(new RegExp("^" + topDir + "/images/(.*?)/*$"));
  if (paramRest) {
    return paramRest[1].split(/\//);
  } else {
    return undefined;
  }
}

function removeExperimentalConfigs(config) {
  var ret = _.extend({},config);
  _.keys(config).forEach(function(type) {
    _.keys(config[type]).forEach(function(key) {
      var typeConfig = config[type][key];
      if (typeConfig['fish-pepper'] && typeConfig['fish-pepper'].experimental) {
        delete ret[type][key];
      }
    });
  });
  return ret;
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
      var config = image.config;
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
