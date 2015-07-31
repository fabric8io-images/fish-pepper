#!/usr/local/bin/node

var dot = require('dot');
dot.templateSettings.strip = false;

var fs = require('fs');
var path = require('path');
require('colors');
var _ = require('underscore');
var Docker = require('dockerode');
var tarCmd = "tar";
var child = require('child_process');
var stream = require('stream');
var yaml = require('js-yaml');
var mkdirp = require('mkdirp');

var CreateContext = require('./fp-create-context.js');
var ImageJob = require('./fp-image-job.js');

// Set to true for extra debugging
var DEBUG = false;

(function () {
  var ctx = setupContext();

  // All supported servers which must be present as a sub-directory
  var images = getImages(ctx);
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

function createDockerFileDirs(ctx, images) {
  console.log("Creating Docker Builds\n".cyan);

  images.forEach(function (image) {
    console.log(image.dir.magenta);
    var blocks = getBlocks(ctx.root + "/blocks", ctx.root + "/" + image.dir + "/blocks");
    var config = image.config;
    var params = extractParams(config, ctx.options.param);
    execWithTemplates(ctx.root + "/" + image.dir, function (templates) {
      fanOutOnParams(ctx, params.types.slice(0), new CreateContext(image, templates, blocks));
    });
  });
}


function fanOutOnParams(ctx, paramTypes, createContext) {
  var type = paramTypes.shift();

  var paramValues = createContext.getParamValuesFor(type);
  paramValues.forEach(function (paramVal) {
      createContext.updateParamValue(type, paramVal);

      createContext.pushParamValue(paramVal);
      if (paramTypes.length > 0) {
        fanOutOnParams(ctx, paramTypes.slice(0), createContext);
      } else {
        fillTemplates(ctx, createContext)
      }
      createContext.popParamValue();
    }
  );
}

function fillTemplates(ctx, createContext) {
  console.log("    " + createContext.getParamLabel().green);
  ensureDir(createContext.getDirectoryPath(ctx.root));
  var changed = false;
  createContext.forEachTemplate(function (template) {
    var file = createContext.checkForMapping(template.file);
    if (!file) {
      // Skip any file flagged as being mapped but no mapping was found
      return;
    }
    var templateStatus =
      createContext.fillTemplate(createContext.getDirectoryPath(ctx.root) + "/" + file, template.templ);
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

function getImageConfig(ctx, image) {
  return _.extend({},
    ctx.config,
    readConfig(ctx.root + "/" + image, "config"));
}

function getBlocks() {
  var blocks = {};
  Array.prototype.slice.call(arguments).forEach(function(path) {
    [".txt",".yml",".yaml"].forEach(function(ext) {
      if (fs.existsSync(path + ext)) {
        if (ext === ".txt") {
          blocks = _.extend(blocks, readBlockAsText(path + ext));
        } else if (ext === ".yml" || ext === ".yaml") {
          blocks = _.extend(blocks, readBlockAsYaml(path + ext));
        }
      }
    });
  });
  return blocks;
}

function readBlockAsText(path) {
  var blocks = {};
  var text = fs.readFileSync(path, "utf8");
  var lines = text.split(/\r?\n/);
  var block = undefined;
  var buffer = "";
  lines.forEach(function (line) {
    var name = line.match(/^===*\s*([^\s]+)?/);
    if (name) {
      if (!name[1]) { // end-of-fragment
        blocks[block] = buffer;
        buffer = "";
      }
      block = name[1];
    } else {
      if (block) {
        buffer += line + "\n";
      }
    }
  });
  return blocks;
}

function readBlockAsYaml(path) {
  return yaml.safeLoad(fs.readFileSync(path, "utf8"))
}

function createBuildJobs(image, params) {
  var jobs = [];

  var collect = function (types, values) {
    if (types.length === 0) {
      jobs.push(new ImageJob(image, params.types, values));
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
}


function buildImages(ctx, images) {
  console.log("\n\nBuilding Images\n".cyan);

  var docker = new Docker(getDockerConnectionsParams(ctx));

  images.forEach(function (image) {
    console.log(image.dir.magenta);
    var params = extractParams(image.config, ctx.options.param);
    doBuildImages(ctx, docker, createBuildJobs(image, params), ctx.options.nocache);
  });
}

// ===================================================================================

function execWithTemplates(dir, templFunc) {
  var templ_dir = dir + "/templates";
  var templates = fs.readdirSync(templ_dir);
  var ret = [];
  templates.forEach(function (template) {
    ret.push({
      "templ": dot.template(fs.readFileSync(templ_dir + "/" + template)),
      "file":  template
    });
  });
  templFunc(ret);
}


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
    var repoUser = ctx.config.repoUser ? ctx.config.repoUser = "/" : "";
    return {
      "dir": name,
      "name": config.name ? config.name : repoUser + name,
      "config": getImageConfig(ctx, name)};
  })
}

// Return all params in the right order and the individual configuration per param
function extractParams(config, paramFromOpts) {
  // TODO: Filter out params if requested from the commandline with paramFromOpts
  return {
    // Copy objects
    types:  config.params.slice(0),
    config: _.extend({}, config.config)
  };
}

function doBuildImages(ctx, docker, buildJobs, nocache) {
  if (buildJobs.length > 0) {
    var job = buildJobs.shift();
    console.log("    " + job.getLabel().green + " --> " + job.getImageNameWithVersion().cyan);
    var tar = child.spawn(tarCmd, ['-c', '.'], {cwd: job.getPath(ctx.root)});
    var fullName = job.getImageNameWithVersion();
    docker.buildImage(
      tar.stdout, {"t": fullName, "forcerm": true, "q": true, "nocache": nocache ? "true" : "false"},
      function (error, stream) {
        if (error) {
          throw error;
        }
        stream.pipe(getResponseStream());
        stream.on('end', function () {
          job.getTags().forEach(function (tag) {
            docker.getImage(fullName).tag({repo: job.getImageName(), tag: tag, force: 1}, function (error, result) {
              console.log(result.gray);
              if (error) {
                throw error;
              }
            });
          });
          console.log();
          doBuildImages(ctx, docker, buildJobs, nocache);
        });
      });
  }
}

function getResponseStream() {
  var buildResponseStream = new stream.Writable();
  buildResponseStream._write = function (chunk, encoding, done) {
    var answer = chunk.toString();
    var resp = JSON.parse(answer);

    debug("|| >>> " + answer);
    if (resp.stream) {
      process.stdout.write("    " + resp.stream.gray);
    }
    if (resp.errorDetail) {
      process.stderr.write("++++++++ ERROR +++++++++++\n".red);
      process.stderr.write(resp.errorDetail.message.red);
    }
    done();
  };
  return buildResponseStream;
}

function addSslIfNeeded(param, ctx) {
  var port = param.port;
  if (port === "2376") {
    // Its SSL
    var options = ctx.options;
    var certPath = options.certPath || process.env.DOCKER_CERT_PATH || process.env.HOME + ".docker";
    return _.extend(param, {
      protocol: "https",
      ca:       fs.readFileSync(certPath + '/ca.pem'),
      cert:     fs.readFileSync(certPath + '/cert.pem'),
      key:      fs.readFileSync(certPath + '/key.pem')
    });
  } else {
    return _.extend(param, {
      protocol: "http"
    });
  }
}

function getDockerConnectionsParams(ctx) {
  if (ctx.options.host) {
    return addSslIfNeeded({
      "host": ctx.options.host,
      "port": ctx.options.port || 2375
    }, ctx);
  } else if (process.env.DOCKER_HOST) {
    var parts = process.env.DOCKER_HOST.match(/^tcp:\/\/(.+?)\:?(\d+)?$/i);
    if (parts !== null) {
      return addSslIfNeeded({
        "host": parts[1],
        "port": parts[2] || 2375
      }, ctx);
    } else {
      return {
        "socketPath": process.env.DOCKER_HOST
      };
    }
  } else {
    return {
      "protocol": "http",
      "host":     "localhost",
      "port":     2375
    };
  }
}

function debug(msg) {
  if (DEBUG) {
    process.stdout.write(msg + "\n");
  }
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
      help += "   " + image.dir + ": " + config.versions.join(", ") + "\n";
    });
  } else {
    help += "\nNo images found\n";
  }
  return help;
}
