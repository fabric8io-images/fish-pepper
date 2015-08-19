var fs = require('fs');
var _ = require('underscore');
var yaml = require('js-yaml');

exports.load = function() {
  var blocks = {};

  // Check files
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

    // Check directory, filename (without extension) is used as block name
    if (fs.existsSync(path) && fs.statSync(path).isDirectory()) {
      var files = fs.readdirSync(path);
      files.forEach(function (file) {
        var stat = fs.statSync(path + "/" + file);
        var name = file.replace(/\..*$/, "");
        if (stat.isFile()) {
          blocks[name] = { text: fs.readFileSync(path + "/" + file, "utf8") };
        } else if (stat.isDirectory()) {
          // Within a directory we are looking for a file block.<ext> which is the textual block
          // All other files will be copied over into the build directory (with template substitution)
          var files = fs.readdirSync(path + "/" + file);
          var block = {
            files : []
          };
          files.forEach(function(subFile) {
            var subPath = path + "/" + file + "/" + subFile;
            if (subFile.match(/^block\./)) {
              block["text"] = fs.readFileSync(subPath, "utf8");
            } else {
              block["files"].push(subPath);
            }
          });
          blocks[name] = block;
        }
      });
    }
  });

  return blocks;
};

// =========================================================================================

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
        blocks[block] = { text: buffer };
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
  return _.mapObject(yaml.safeLoad(fs.readFileSync(path, "utf8")),function(val) {
    return { text: val };
  });
}
