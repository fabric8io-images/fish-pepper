var imageNames = require('./image-names');
var tarCmd = "tar";
var child = require('child_process');
var stream = require('stream');
const fs = require('fs');

exports.build = function(root, docker, types, allParamValues, image, opts) {
  doBuildImages(root, docker, imageNames.createImageNames(image, types, allParamValues),opts);
};

function doBuildImages(root, docker, imageNames, opts) {
  if (imageNames && imageNames.length > 0) {
    
    var imageName = imageNames.shift();
    console.log("    " + imageName.getLabel().green + " --> " + imageName.getImageNameWithVersion().cyan);
    
    var fullName = imageName.getImageNameWithVersion();
    var image = docker.getImage(fullName);
    image.inspect(function (error, data) {
      if (!error) {
        var oldImageId = data.Id;
      }
      if (!error || error.statusCode == 404) {
        var tar = child.spawn(tarCmd, ['-c', '.'], {cwd: imageName.getPath(root)});
        docker.buildImage(
          tar.stdout, {"t": fullName, "forcerm": false, "q": true, "nocache": (opts && opts.nocache) ? "true" : "false"},
          function (error, stream) {
            if (error) {
              throw error;
            }
            stream.pipe(getResponseStream(docker, opts && opts.debug));
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
              if (oldImageId) {
                docker.getImage(data.id).remove({force: 1}, function (error) {
                  if (error && error.statusCode != 404) {
                    throw error;
                  }
                  doBuildImages(root, docker, imageNames, opts);
                });
              } else {
                doBuildImages(root, docker, imageNames, opts);
              }
            });
          });
      } else {
        throw error;
      }
    });
    let writeStream = fs.createWriteStream('push-images.log', {flags: 'a'});
    writeStream.write('docker push ' + imageName.getImageNameWithVersion() + '\n');
    writeStream.end();
  }
}

function getResponseStream(docker,debug) {
  var buildResponseStream = new stream.Writable();
  var rest = "";
  var lastContainerId;
  buildResponseStream._write = function (chunk, encoding, done) {
    var answer = chunk.toString();

    if (debug) {
      process.stdout.write("|| >>> " + answer + "\n");
    }

    try {
      (rest + answer).split(/\n/).forEach(
        function(line) {
          var resp = JSON.parse(line);

          if (resp.stream) {
            process.stdout.write("    " + resp.stream.gray);
            var matcher = resp.stream.match(/\s([^\s]{12})\n?$/);
            if (matcher) {
              lastContainerId = matcher[1];
            }
          }
          if (resp.errorDetail) {
            process.stderr.write("++++++++ ERROR +++++++++++\n".red);
            process.stderr.write(resp.errorDetail.message.red);
            if (lastContainerId) {
              printLogs(docker, lastContainerId);
            }
          }
          rest = "";
        });
    } catch (e) {
      rest += answer;
    }
    done();
  };
  return buildResponseStream;
}

function printLogs(docker,id) {
  var container = docker.getContainer(id);
  var logs_opts = {
    stdout: true,
    stderr: true,
    timestamps: false
  };

  container.logs(logs_opts, function(err,stream) {
    if (stream) {
      container.modem.demuxStream(stream,process.stdout, process.stderr);
    }
  });

}