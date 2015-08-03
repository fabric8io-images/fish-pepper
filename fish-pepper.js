#!/usr/local/bin/node

var fs = require('fs');
var path = require('path');
require('colors');
var _ = require('underscore');
var yaml = require('js-yaml');
var mkdirp = require('mkdirp');
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
  var ctx = setupContext();

  // All supported servers which must be present as a sub-directory
  var images = getImages(ctx);
  if (!images) {
    console.log("No images found.".yellow);
    process.exit(0);
  }
  processImages(ctx, images)
})();

// ===============================================================================

function processImages(ctx, images) {
  // Create build files
  createDockerFileDirs(ctx, images);

  // If desired create Docker images
  if (ctx.options.build) {
    buildImages(ctx, images);
  }
}

// ===============================================================================

function createDockerFileDirs(ctx, images) {
  console.log("Creating Docker Builds\n".cyan);

  images.forEach(function (image) {
    console.log(image.dir.magenta);
    var blocks = blockLoader.load(ctx.root + "/blocks", ctx.root + "/" + image.dir + "/blocks");
    var config = image.config;
    var params = extractParams(config, ctx.options.param);

    templateEngine.forEachTemplate(ctx, image, params, blocks, function(templateCtx, paramValues) {
      fillTemplates(templateCtx, paramValues);
    });
  });
}

function fillTemplates(templateCtx, paramValues) {
  console.log("    " + paramValues.join(", ").green);
  var path = templateCtx.getPath(paramValues);

  ensureDir(path);
  var changed = false;
  templateCtx.forEachTemplate(function (template) {
    var file = templateCtx.checkForMapping(template.file);
    if (!file) {
      // Skip any file flagged as being mapped but no mapping was found
      return;
    }
    var templateStatus =
      templateCtx.fillTemplate(paramValues, templateCtx.getPath(paramValues,file), template.templ);
    if (templateStatus) {
      var label = file.replace(/.*\/([^\/]+)$/, "$1");
      console.log("       " + label + ": " + templateStatus);
    }
    changed = changed || templateStatus;
  });
  if (!changed) {
    console.log("       UNCHANGED".yellow);
  } else {

  }
}

// =======================================================================================

function buildImages(ctx, images) {
  console.log("\n\nBuilding Images\n".cyan);

  var docker = dockerBackend.create(ctx.options);

  images.forEach(function(image) {
    var params = extractParams(image.config, ctx.options.param);
    imageBuilder.build(ctx.root, docker, params, image, { nocache: ctx.options.nocache, debug: DEBUG });
  });
}

// ===================================================================================


function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    mkdirp.sync(dir, 0755);
  }
  if (!fs.statSync(dir).isDirectory()) {
    throw new Error(dir + " is not a directory");
  }
}

function getImages(ctx) {
  var imageNames;

  if (!ctx.root) {
    return undefined;
  }
  var allImageNames = _.filter(fs.readdirSync(ctx.root), function (f) {
    var p = ctx.root + "/" + f;
    return fs.statSync(p).isDirectory() && existsConfig(p, "config");
  });

  if (ctx.options.image) {
    imageNames = _.filter(allImageNames, function (image) {
      return _.contains(ctx.options.image, image);
    });
  } else {
    imageNames = allImageNames;
  }
  return _.map(imageNames, function (name) {
    var config = getImageConfig(ctx, name);
    var repoUser = ctx.config['fp.repoUser'] ? ctx.config['fp.repoUser'] + "/" : "";
    return {
      "dir": name,
      "name": config['fp.name'] ? config['fp.name'] : repoUser + name,
      "config": getImageConfig(ctx, name)};
  })
}

function getImageConfig(ctx, image) {
  return _.extend({},
    ctx.config,
    readConfig(ctx.root + "/" + image, "config"));
}

// Return all params in the right order and the individual configuration per param
function extractParams(config, paramFromOpts) {
  // TODO: Filter out params if requested from the commandline with paramFromOpts
  return {
    // Copy objects
    types:  config['fp.params'].slice(0),
    config: _.extend({}, config.config)
  };
}


function setupContext() {
  var Getopt = require('node-getopt');
  var getopt = new Getopt([
    ['i', 'image=ARG+', 'Images to create (e.g. "tomcat")'],
    ['p', 'param=ARG+', 'Params to use for the build. Should be a comma separate list, starting from top'],
    ['b', 'build', 'Build image(s)'],
    ['d', 'host', 'Docker hostname (default: localhost)'],
    ['p', 'port', 'Docker port (default: 2375)'],
    ['n', 'nocache', 'Don\'t cache when building images'],
    ['h', 'help', 'display this help']
  ]);

  var opts = getopt.parseSystem();

  var ctx = {};
  ctx.options = opts.options || {};
  ctx.root = getRootDir(opts.argv[0]);
  ctx.config = ctx.root ? readConfig(ctx.root, "fish-pepper") : {};
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
    "Usage: fish-pepper [OPTION] \<dir\>\n" +
    "Generator for Dockerfiles from templates\n" +
    "\n" +
    "[[OPTIONS]]\n" +
    "\n" +
    "An extra argument is interpreted as directory which contains the top-level\n" +
    "\"fish-pepper.json\" or \"fish-pepper.yml\" config. If not given the current or the first parent directory\n" +
    "containing the configuration is used\n" +
    "\n" +
    "This script creates Dockerfiles out of templates with a set of given parameters\n" +
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
      util.foreachParamValue(extractParams(config),function(values) {
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
