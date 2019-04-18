var imageNames = require('./image-names');
var child = require('child_process');
var stream = require('stream');
const fs = require('fs');
var readline = require('readline');

exports.build = function(root, docker, types, allParamValues, image, opts) {
  doBuildManifests(root, docker, imageNames.createImageNames(image, types, allParamValues),opts);
};

function doBuildManifests(root, docker, imageNames, opts) {
  //for now we only support amd64 and arm64v8
  var arch = ['arm64v8'];
  var anno = [' --os linux --arch arm64 --variant armv8'];
  if (imageNames && imageNames.length > 0) {
    
    var imageName = imageNames.shift();
    var shortName = imageName.getShortName();
    console.log("    " + imageName.getLabel().green + " --> " + imageName.getImageNameWithVersion().cyan);

    var manifest = 'docker manifest create ' + imageName.getImageNameWithVersion();
    var archImageNames = findImagesInFile(shortName);
    for (var i in archImageNames) {
      manifest = manifest + ' ' + archImageNames[i];
    }
    manifest = manifest + '\n';    
    
    for (var i in arch) {
      for (var j in archImageNames) {
        if (archImageNames[j].includes(arch[i])) {
          var annotation = 'docker manifest annotate ' + imageName.getImageNameWithVersion();
          annotation = annotation + ' ' + archImageNames[j] + anno[i];
          manifest = manifest + annotation + '\n';
        }
      }
    }
    manifest = manifest + 'docker manifest push ' + imageName.getImageNameWithVersion() + '\n\n';
    writeStream = fs.createWriteStream('manifest.log', {flags: 'a'});
    writeStream.write(manifest);
    writeStream.end();

    doBuildManifests(root, docker, imageNames, opts);
  }

}

function findImagesInFile(arch) {
  var lines = fs.readFileSync('push-images.log', 'utf-8')
    .split('\n')
    .filter(function (line) {
      return line.includes(arch);
    });
  var names = [];
  for (var i in lines) {
    names.push(lines[i].substring(12));
  }
  return names;
}