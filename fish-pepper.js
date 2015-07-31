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

// Set to true for extra debugging
var DEBUG = false;

(function() {
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

    var fragments = getFragments("fragments.txt");
    images.forEach(function (image) {
        console.log(image.name.magenta);
        var config = image.config;
        var params = extractParams(config,ctx.options.param);
        execWithTemplates(ctx.root + "/" + image.name, function (templates) {
            var types = params.types.slice(0);
            fanOutOnParams(ctx, types, new FanOutContext(image,templates,fragments));
        });
    });
}



function fanOutOnParams(ctx, paramTypes, args) {
    var type = paramTypes.shift();

    var paramValues = args.getParamValuesFor(type);
    paramValues.forEach(function(paramVal) {
            args.updateParamValue(type,paramVal);

            args.pushParamValue(paramVal);
            if (paramTypes.length > 0) {
                fanOutOnParams(ctx, paramTypes.slice(0), args);
            } else {
                fillTemplates(ctx, args)
            }
            args.popParamValue();
        }
    );
}

function fillTemplates(ctx,args) {
    console.log("    " + args.getParamLabel().green);
    ensureDir(args.getDirectoryPath(ctx.root));
    var changed = false;
    args.forEachTemplate(function (template) {
        var file = args.checkForMapping(template.file);
        if (!file) {
            // Skip any file flagged as being mapped but no mapping was found
            return;
        }
        var filledFragments = args.fillFragments();
        var templateHasChanged =
            fillTemplate(
                args.getDirectoryPath(ctx.root) + "/" + file,
                template.templ,
                args.getTemplateContext(filledFragments)
            );
        changed = changed || templateHasChanged;
    });
    if (!changed) {
        console.log("       UNCHANGED".yellow);
    } else {

    }
}

function getImageConfig(ctx,image) {
    return _.extend({},
            ctx.config,
            readConfig(ctx.root + "/" + image,"config"));
}

function getFragments(path) {
    var fragments = {};
    if (fs.existsSync(path)) {
        var text = fs.readFileSync(path, "utf8");
        var lines = text.split(/\r?\n/);
        var fragment = undefined;
        var buffer = "";
        lines.forEach(function (line) {
            var name = line.match(/^===*\s*([^\s]+)?/);
            if (name) {
                if (!name[1]) { // end-of-fragment
                    fragments[fragment] = buffer;
                    buffer = "";
                }
                fragment = name[1];
            } else {
                if (fragment) {
                    buffer += line + "\n";
                }
            }
        });
    }
    return fragments;
}

function createBuildJobs(image,params) {
    var jobs = [];

    var collect = function(types,values) {
        if (types.length === 0) {
            jobs.push(new ImageJob(image,params.types,values));
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

    collect(params.types.slice(0),[]);
    return jobs;
}




function buildImages(ctx, images) {
    console.log("\n\nBuilding Images\n".cyan);

    var docker = new Docker(getDockerConnectionsParams(ctx));

    images.forEach(function(image) {
        console.log(image.name.magenta);
        var params = extractParams(image.config,ctx.options.param);
        doBuildImages(ctx, docker, createBuildJobs(image,params), ctx.options.nocache);
    });
}

// ===================================================================================

function execWithTemplates(dir,templFunc) {
    var templ_dir = dir + "/templates";
    var templates = fs.readdirSync(templ_dir);
    var ret = [];
    templates.forEach(function (template) {
        ret.push({
            "templ" : dot.template(fs.readFileSync(templ_dir + "/" + template)),
            "file" : template
        });
    });
    templFunc(ret);
}

function fillTemplate(file,template,context) {
    var newContent = template(context).trim() + "\n";
    var label = file.replace(/.*\/([^\/]+)$/,"$1");
    if (!newContent.length) {
        console.log("       " + label + ": " + "SKIPPED".grey);
        return false;
    } else {
        var exists = fs.existsSync(file);
        var oldContent = exists ? fs.readFileSync(file, "utf8") : undefined;
        if (!oldContent || newContent.trim() !== oldContent.trim()) {
            console.log("       " + label + ": " + (exists ? "CHANGED".green : "NEW".yellow));
            fs.writeFileSync(file,newContent,{ "encoding" : "utf8"});
            return true;
        }
    }
    return false;
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        mkdirp.sync(dir,0755);
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
    var allImageNames =  _.filter(fs.readdirSync(ctx.root), function (f) {
        var p = ctx.root + "/" + f;
        return fs.statSync(p).isDirectory() && existsConfig(p,"config");
    });

    if (ctx.options.image) {
        imageNames = _.filter(allImageNames, function(image) {
            return _.contains(ctx.options.image,image);
        });
    } else {
        imageNames = allImageNames;
    }
    return _.map(imageNames, function (name) {
        return { "name": name, "config": getImageConfig(ctx,name)};
    })
}

// Return all params in the right order and the individual configuration per param
function extractParams(config,paramFromOpts) {
    // TODO: Filter out params if requested from the commandline with paramFromOpts
    return {
        // Copy objects
        types: config.params.slice(0),
        config: _.extend({},config.config)
    };
}

function doBuildImages(ctx, docker, buildJobs, nocache) {
    if (buildJobs.length > 0) {
        var job = buildJobs.shift();
        console.log("    " + job.getLabel().green);
        var tar = child.spawn(tarCmd, ['-c', '.'], { cwd: job.getPath(ctx.root) });
        var fullName = job.getImageNameWithVersion();
        docker.buildImage(
            tar.stdout, { "t": fullName, "forcerm": true, "q": true, "nocache": nocache ? "true" : "false" },
            function (error, stream) {
                if (error) {
                    throw error;
                }
                stream.pipe(getResponseStream());
                stream.on('end', function () {
                    job.getTags().forEach(function(tag) {
                        docker.getImage(fullName).tag({repo: job.getImageName(), tag : tag, force: 1}, function (error, result) {
                            console.log(result);
                            if (error) { throw error; }
                        });
                    });
                    doBuildImages(ctx, docker, buildJobs, nocache);
                });
            });
    }
}

function ImageJob(image,types,paramValues) {

    this.getPath = function(root) {
        return root + "/" + image.name + "/" + paramValues.join("/");
    };

    this.getLabel = function() {
        return paramValues.join(", ");
    };

    function getVersion() {
        var versionsFromType = [];
        forEachParamValueConfig(function(config) {
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

    this.getImageName = function() {
        var repoUser = image.config.repoUser ? image.config.repoUser + "/" : "";
        return repoUser + image.name + "-" + paramValues.join("-");
    };

    this.getImageNameWithVersion = function() {
        return this.getImageName() + ":" + getVersion();
    };

    this.getTags = function() {
        var ret = [];
        forEachParamValueConfig(function(config) {
            if (config && config.tags) {
                Array.prototype.push.apply(ret, config.tags);
            }
        });
        return ret;
    }

}


function getResponseStream() {
    var buildResponseStream = new stream.Writable();
    buildResponseStream._write = function (chunk, encoding, done) {
        var answer = chunk.toString();
        var resp = JSON.parse(answer);

        debug("|| >>> " + answer);
        if (resp.stream) {
            process.stdout.write(resp.stream);
        }
        if (resp.errorDetail) {
            process.stderr.write("++++++++ ERROR +++++++++++\n");
            process.stderr.write(resp.errorDetail.message);
        }
        done();
    };
    return buildResponseStream;
}

function addSslIfNeeded(param,ctx) {
    var port = param.port;
    if (port === "2376") {
        // Its SSL
        var options = ctx.options;
        var certPath = options.certPath || process.env.DOCKER_CERT_PATH || process.env.HOME + ".docker";
        return _.extend(param,{
            protocol: "https",
            ca: fs.readFileSync(certPath + '/ca.pem'),
            cert: fs.readFileSync(certPath + '/cert.pem'),
            key: fs.readFileSync(certPath + '/key.pem')
        });
    } else {
        return _.extend(param,{
            protocol: "http"
        });
    }
}

function getDockerConnectionsParams(ctx) {
    if (ctx.options.host) {
        return addSslIfNeeded({
            "host": ctx.options.host,
            "port": ctx.options.port || 2375
        },ctx);
    } else if (process.env.DOCKER_HOST) {
        var parts = process.env.DOCKER_HOST.match(/^tcp:\/\/(.+?)\:?(\d+)?$/i);
        if (parts !== null) {
            return addSslIfNeeded({
                "host" : parts[1],
                "port" : parts[2] || 2375
            },ctx);
        } else {
            return {
                "socketPath" : process.env.DOCKER_HOST
            };
        }
    } else {
        return {
            "protocol" : "http",
            "host" : "localhost",
            "port" : 2375
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
        ['i' , 'image=ARG+', 'Images to create (e.g. "tomcat")'],
        ['p' , 'param=ARG+', 'Params to use for the build. Should be a comma separate list, starting from top'],
        ['b' , 'build', 'Build image(s)'],
        ['d' , 'host', 'Docker hostname (default: localhost)'],
        ['p' , 'port', 'Docker port (default: 2375)'],
        ['n' , 'nocache', 'Don\'t cache when building images'],
        ['h' , 'help', 'display this help']
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
        return findConfig(fpDir,"fish-pepper");
    } else {
        if (!existsConfig(givenDir,"fish-pepper")) {
            throw new Error("Cannot find fish-pepper config" + (givenDir ? " in directory " + givenDir : ""));
        }
        return givenDir;
    }
}

function existsConfig(dir,file) {
    return _.some(["json", "yml", "yaml"],function(ext) {
        return fs.existsSync(dir + "/" + file + "." + ext)
    });
}

function readConfig(dir,file) {
    var base = dir + "/" + file;
    var ret;
    if (fs.existsSync(base + ".json")) {
        ret = JSON.parse(fs.readFileSync(base + ".json", "utf8"));
    }
    _.each(["yml", "yaml"],function(ext) {
        if (fs.existsSync(base + "." + ext)) {
            ret = yaml.safeLoad(fs.readFileSync(base + "." + ext, "utf8"));
        }
    });
    if (!ret) {
        throw new Error("No " + file + ".json, " + file + ".yaml or " + file + ".yml found in " + dir);
    }
    return ret;
}

function findConfig(dir,file) {
    if (dir === "/") {
        return undefined;
    } else if (existsConfig(dir,file)) {
        return dir;
    } else {
        return findConfig(path.normalize(dir + "/.."),file);
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
            help += "   " + image.name + ": " + config.versions.join(", ") + "\n";
        });
    } else {
        help += "\nNo images found\n";
    }
    return help;
}

// ===========================================================
// Context Object when creating all the docker files
function FanOutContext(image,templates,fragments) {

    var paramConfig = {};
    var path = [];
    var params = {};

    this.pushParamValue = function(el) {
        path.push(el);
    };

    this.popParamValue = function() {
        path.pop();
    };

    this.updateParamValue = function(type,val) {
        params[type] = val;
        paramConfig[type] = _.extend({},this.getParamConfigFor(type,val));
    };

    this.getParamValuesFor = function(type) {
        var config = image.config.config[type] || {};
        return _.keys(config).sort();
    };

    this.getParamConfigFor = function(type,val) {
        var c = image.config.config[type] || {};
        return c[val] || {};
    };

    this.getParamLabel = function() {
        return path.join(", ");
    };

    this.getDirectoryPath = function(root) {
        return root + "/" + image.name + "/" + path.join("/");
    };

    this.forEachTemplate = function(fn) {
        templates.forEach(fn);
    };

    this.fillFragments = function() {
        var ret = { };
        for (var key in fragments) {
            if (fragments.hasOwnProperty(key)) {
                var template = dot.template(fragments[key]);
                ret[key] = template(image.config);
            }
        }
        return ret;
    };

    this.checkForMapping = function(file) {
        if (/^__.*$/.test(file)) {
            var mapping = undefined;
            params.keys().forEach(function(param) {
                var mappings = this.getParamConfigFor(param)["mappings"];
                if (!mappings) {
                    mappings = image.config.config["default"].mappings;
                }
                if (mappings) {
                    mapping = mappings[file];
                }
            },this);
            return mapping;
        } else {
            return file;
        }
    };

    this.getTemplateContext = function(fragments) {
        return _.extend(
            {},
            image.config,
            {
                "param": params,
                "fragments": fragments,
                "config": _.extend({}, image.config.config['default'], paramConfig)
            });
    }
}



