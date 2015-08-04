var imageNames = require('./image-names');
var tarCmd = "tar";
var child = require('child_process');
var stream = require('stream');


exports.build = function(root, docker, params, image, opts) {
  console.log(image.dir.magenta);
  doBuildImages(root, docker, imageNames.createImageNames(image, params),opts);
};

function doBuildImages(root, docker, imageNames, opts) {
  if (imageNames && imageNames.length > 0) {
    var imageName = imageNames.shift();
    console.log("    " + imageName.getLabel().green + " --> " + imageName.getImageNameWithVersion().cyan);
    var tar = child.spawn(tarCmd, ['-c', '.'], {cwd: imageName.getPath(root)});
    var fullName = imageName.getImageNameWithVersion();
    docker.buildImage(
      tar.stdout, {"t": fullName, "forcerm": true, "q": true, "nocache": (opts && opts.nocache) ? "true" : "false"},
      function (error, stream) {
        if (error) {
          throw error;
        }
        stream.pipe(getResponseStream(opts && opts.debug));
        stream.on('end', function () {
          imageName.getTags().forEach(function (tag) {
            docker.getImage(fullName).tag(
              {repo: imageName.getImageName(), tag: tag, force: 1},
              function (error, result) {
                console.log(result.gray);
                if (error) {
                  throw error;
                }
              });
          });
          console.log();
          // Chain it so that it runs sequentially
          doBuildImages(root, docker, imageNames, opts);
        });
      });
  }
}

function getResponseStream(debug) {
  var buildResponseStream = new stream.Writable();
  var rest = "";
  buildResponseStream._write = function (chunk, encoding, done) {
    var answer = chunk.toString();

    if (debug) {
      process.stdout.write("|| >>> " + answer + "\n");
    }

    try {
      var resp = JSON.parse(rest + answer);

      if (resp.stream) {
        process.stdout.write("    " + resp.stream.gray);
      }
      if (resp.errorDetail) {
        process.stderr.write("++++++++ ERROR +++++++++++\n".red);
        process.stderr.write(resp.errorDetail.message.red);
      }
      rest = "";
    } catch (e) {
      rest += answer;
    }
    done();
  };
  return buildResponseStream;
}
