#!/usr/local/bin/node

var dot = require('dot');
dot.templateSettings.strip = false;

var fs = require('fs');
require('colors');
var _ = require('underscore');
var Docker = require('dockerode');
var tarCmd = "tar";
var child = require('child_process');
var stream = require('stream');

// Set to true for extra debugging
var DEBUG = false;

JSON.minify = JSON.minify || require("node-json-minify");

var globalConfig = getConfig("config.json");

function processServers(servers, opts) {
// Create build files
    createAutomatedBuilds(servers, opts);

    // If desired create Docker images
    if (opts.options.build) {
        buildImages(servers, opts);
    }
}
(function() {
    var opts = parseOpts();

    // All supported servers which must be present as a sub-directory
    var servers = getServers(opts);
    processServers(servers, opts)
})();

// ===============================================================================

function createAutomatedBuilds(servers, opts) {
    console.log("Creating Automated Builds\n".cyan);

    var fragments = getFragments("fragments.txt");

    servers.forEach(function (server) {
        console.log(server.name.magenta);
        var config = server.config;
        var versions = extractVersions(config,opts.options.version);
        execWithTemplates(server.name, function (templates) {
            versions.forEach(function (version) {
                console.log("    " + version.green);
                ensureDir(__dirname + "/" + server.name + "/" + version);
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
                                server.name + "/" + version + "/" + file,
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

function getConfig(path) {
    var config = {};
    if (fs.existsSync(path)) {
        config = JSON.parse(JSON.minify(fs.readFileSync(path, "utf8")));
    }
    return config;
}

function getServerConfig(name) {
    return _.extend({},
            globalConfig,
            JSON.parse(JSON.minify(fs.readFileSync(__dirname + "/" + name + "/config.json", "utf8"))));
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

function buildImages(servers,opts) {
    console.log("\n\nBuilding Images\n".cyan);

    var docker = new Docker(getDockerConnectionsParams(opts));

    servers.forEach(function(server) {
        console.log(server.name.magenta);
        var versions = extractVersions(server.config,opts.options.version);
        doBuildImages(docker,server,versions,opts.options.nocache);
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


function getServers(opts) {
    var serverNames;

    var allServerNames =  _.filter(fs.readdirSync(__dirname), function (f) {
        return fs.existsSync(f + "/config.json");
    });

    if (opts && opts.options && opts.options.server) {
        serverNames = _.filter(allServerNames, function(server) {
            return _.contains(opts.options.server,server);
        });
    } else {
        serverNames = allServerNames;
    }
    return _.map(serverNames, function (name) {
        return { "name": name, "config": getServerConfig(name)};
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

function doBuildImages(docker,server,versions,nocache) {
    if (versions.length > 0) {
        var version = versions.shift();
        console.log("    " + version.green);
        var tar = child.spawn(tarCmd, ['-c', '.'], { cwd: __dirname + "/" + server.name + "/" + version });
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
                    doBuildImages(docker,server,versions,nocache);
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

function addSslIfNeeded(param,opts) {
    var port = param.port;
    if (port === "2376") {
        // Its SSL
        var options = opts.options;
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

function getDockerConnectionsParams(opts) {
    if (opts.options.host) {
        return addSslIfNeeded({
            "host": opts.options.host,
            "port": opts.options.port || 2375
        },opts);
    } else if (process.env.DOCKER_HOST) {
        var parts = process.env.DOCKER_HOST.match(/^tcp:\/\/(.+?)\:?(\d+)?$/i);
        if (parts !== null) {
            return addSslIfNeeded({
                "host" : parts[1],
                "port" : parts[2] || 2375
            },opts);
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


function parseOpts() {
    var Getopt = require('node-getopt');
    var getopt = new Getopt([
        ['s' , 'server=ARG+', 'Servers for which to create container images (e.g. "tomcat")'],
        ['v' , 'version=ARG+', 'Versions of a given server to create (e.g. "7.0" for tomcat)'],
        ['b' , 'build', 'Build image(s)'],
        ['d' , 'host', 'Docker hostname (default: localhost)'],
        ['p' , 'port', 'Docker port (default: 2375)'],
        ['n' , 'nocache', 'Don\'t cache when building images'],
        ['h' , 'help', 'display this help']
    ]);

    var help =
        "Usage: fish-pepper [OPTION]\n" +
        "Generator for Dockerfiles from templates\n" +
        "\n" +
        "[[OPTIONS]]\n" +
        "\n" +
        "This script creates Dockerfiles out of templates\n\n" +
        "Templates are used for generating multiple, parameterized builds:\n\n" +
        "Supported builds:\n\n";
    var servers = getServers();
    servers.forEach(function (server) {
        var config = server.config;
        help += "   " + server.name  + ": " + config.versions.join(", ") + "\n";
    });

    return getopt.bindHelp(help).parseSystem();
}


