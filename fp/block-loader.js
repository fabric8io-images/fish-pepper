var fs = require('fs');
var _ = require('underscore');
var yaml = require('js-yaml');

exports.load = function() {
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
