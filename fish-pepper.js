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

// Set to true for extra debugging
var DEBUG = false;

(function() {
    var ctx = setupContext();

    // All supported servers which must be present as a sub-directory
    var images = getImages(ctx);
    processImages(ctx, images)
})();

// ===============================================================================

function processImages(ctx, servers) {
    // Create build files
    createDockerFileDirs(ctx, servers);

    // If desired create Docker images
    if (ctx.options.build) {
        buildImages(ctx, servers);
    }
}

function createDockerFileDirs(ctx, images) {
    console.log("Creating Docker Builds\n".cyan);

    var fragments = getFragments("fragments.txt");
    images.forEach(function (image) {
        console.log(image.name.magenta);
        var config = image.config;
        var versions = extractVersions(config,ctx.options.version);
        execWithTemplates(ctx.root + "/" + image.name, function (templates) {
            versions.forEach(function (version) {
                console.log("    " + version.green);
                ensureDir(ctx.root + "/" + image.name + "/" + version);
                var changed = false;
                templates.forEach(function (template) {
                    var file = checkForMapping(config, version, template.file);
                    if (!file) {
                        // Skip any file flagged as being mapped but no mapping was found
                        return;
                    }
                    var filledFragments = fillFragments(fragments,config);
                    var templateHasChanged =
                        fillTemplate(
                                ctx.root + "/" + image.name + "/" + version + "/" + file,
                            template.templ,
                            _.extend(
                                {},
                                config,
                                {
                                    "version": version,
                                    "fragments": filledFragments,
                                    "config": _.extend({}, config.config['default'], config.config[version])
                                }
                            ));
                    changed = changed || templateHasChanged;
                });
                if (!changed) {
                    console.log("       UNCHANGED".yellow);
                } else {

                }
            });
        });
    });
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

function fillFragments(fragments,config) {
    var ret = { };
    for (var key in fragments) {
        if (fragments.hasOwnProperty(key)) {
            var template = dot.template(fragments[key]);
            ret[key] = template(config);
        }
    }
    return ret;
}

function buildImages(ctx, servers) {
    console.log("\n\nBuilding Images\n".cyan);

    var docker = new Docker(getDockerConnectionsParams(ctx));

    servers.forEach(function(server) {
        console.log(server.name.magenta);
        var versions = extractVersions(server.config,ctx.options.version);
        doBuildImages(ctx, docker,server,versions,ctx.options.nocache);
    });
}

// ===================================================================================

function checkForMapping(config,version,file) {
    if (/^__.*$/.test(file)) {
        var mappings = config.config[version].mappings;
        if (!mappings) {
            mappings = config.config["default"].mappings;
        }
        if (!mappings) {
            return null;
        }
        return mappings[file];
    } else {
        return file;
    }
}

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

function fillTemplate(file,template,config) {
    var newContent = template(config).trim() + "\n";
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
        fs.mkdirSync(dir,0755);
    }
    var stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
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

function extractVersions(config,versionsFromOpts) {
    if (versionsFromOpts) {
        return _.filter(config.versions, function (version) {
            return _.contains(versionsFromOpts,version);
        });
    } else {
        return config.versions;
    }
}

function getFullVersion(config,version) {
    var buildVersion = config.buildVersion;
    return config.config[version].version + (buildVersion ? "-" + buildVersion : "");
}

function doBuildImages(ctx,docker,server,versions,nocache) {
    if (versions.length > 0) {
        var version = versions.shift();
        console.log("    " + version.green);
        var tar = child.spawn(tarCmd, ['-c', '.'], { cwd: ctx.root + "/" + server.name + "/" + version });
        var repoUser = server.config.repoUser + "/" || "";
        var name = repoUser + server.name + (version !== "0" ? "-" + version : "");
        var fullName = name + ":" + getFullVersion(server.config,version);
        docker.buildImage(
            tar.stdout, { "t": fullName, "forcerm": true, "q": true, "nocache": nocache ? "true" : "false" },
            function (error, stream) {
                if (error) {
                    throw error;
                }
                stream.pipe(getResponseStream());
                stream.on('end', function () {
                    docker.getImage(fullName).tag({repo: name, force: 1}, function (error, result) {
                        console.log(result);
                        if (error) { throw error; }
                    });
                    doBuildImages(ctx, docker,server,versions,nocache);
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
        ['v' , 'version=ARG+', 'Versions of a given server to create (e.g. "7.0" for tomcat)'],
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
    ctx.config = ctx.root ? getConfig(ctx.root) : {};

    if (ctx.options.help) {
        getopt.setHelp(createHelp(ctx));
        getopt.showHelp();
        return process.exit(0);
    }

    return ctx;
}

function getConfig(root) {
    return readConfig(root,"fish-pepper");
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




