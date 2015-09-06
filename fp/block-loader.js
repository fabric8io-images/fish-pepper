var fs = require('fs');
var _ = require('underscore');
var yaml = require('js-yaml');
var gitLoader = require('./block-git-loader-nodegit');

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
        _.extend(ret,gitLoader.load(root,def,readBlockDir));
      }
    });
  return ret;
};

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
