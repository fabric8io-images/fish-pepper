var fs = require('fs');
var _ = require('underscore');
var yaml = require('js-yaml');
var Git = require('nodegit');
var Future = require("fibers/future");
var util = require('./util');

exports.loadLocal = function() {
  var ret = {};
  Array.prototype.slice.call(arguments).forEach(function (path) {
    if (fs.existsSync(path) && fs.statSync(path).isDirectory()) {
      ret = _.extend(ret, readBlockDir(path));
    }
  });
  return ret;
};

exports.loadRemote = function(root,blockDefs) {
  var ret = {};
    blockDefs.forEach(function (def) {
      if (def.type == "git") {
        var future = new Future();
        readBlocksFromGit(root, def).then(function(blocks) {
          future.return(blocks)
        },function(err) {
          future.throw(err);
        });
        _.extend(ret,future.wait());
      }
    });
  return ret;
};

function readBlocksFromGit(root,def) {
  var name = (def.url.match(/.*\/([^/]+?)(?:\..*)?$/))[1];
  var base = root + "/.fp-git-blocks";
  util.ensureDir(base);
  var path = base + "/" + name;
  var repo;
  var opts = {
    remoteCallbacks: {
      certificateCheck: function() { return 1; }
    }
  };
  if (!fs.existsSync(path)) {
    return Git.Clone(def.url, path, opts).then(function(repo) {
      // Check for tag or branch and switch to tag or branch
      return readBlockDir(path + (def.path ? "/" + def.path : ""));
    },function(err) {
      throw new Error(err);
    });
  } else {
    return Git.Repository.open(path).then(
      function(repo) {
        // Do an update if no tag or branch is given

        // Check for tag or branch and switch to tag or branch
        return readBlockDir(path + (def.path ? "/" + def.path : ""));
      }
    );
  }
}

// =========================================================================================

function readBlockDir(path) {
  var blocks = {};

  var files = fs.readdirSync(path);
  files.forEach(function (entry) {
    var stat = fs.statSync(path + "/" + entry);
    var name = extractBasename(entry);
    if (stat.isFile()) {
      // "Simple Blocks"
      // * Plain template fragment
      // * No sub-snippet
      // * No files
      blocks[name] = {
        text: {
          default: fs.readFileSync(path + "/" + entry, "utf8")
        }
      };
    } else if (stat.isDirectory()) {
      // "Extended Blocks":
      // * A "block.<ext>" which is the default textual block used as fragment if no subtype is given.
      //   There can be only one.
      // * Any other files are sub snippets which can be referenced by their basename (ext doesn't matter)
      // * A directory "files/" hold all files which should copied over into the build directory
      //   (with template substitution)
      // * Any other directory is ignored
      var subEntries = fs.readdirSync(path + "/" + entry);
      var block = {
        text:  {},
        files: []
      };
      subEntries.forEach(function (subEntry) {
        var subPath = path + "/" + entry + "/" + subEntry;
        var subStat = fs.statSync(subPath);
        if (subStat.isFile()) {
          var text = fs.readFileSync(subPath, "utf8");
          if (subEntry.match(/^block\./)) {
            if (block.text.default) {
              throw Error("Only one default block entry starting with 'block.' is allowed in " + path + "/" + entry);
            }
            block.text.default = text
          } else {
            block.text[extractBasename(subEntry)] = text;
          }
        } else if (subStat.isDirectory() && subEntry == "files") {
          fs.readdirSync(subPath).forEach(function (f) {
            block.files.push(subPath + "/" + f);
          });
        }
      });
      blocks[name] = block;
    }
  });
  return blocks;
}

// Check files
function extractBasename(file) {
  return file.replace(/\..*?$/, "");
}
