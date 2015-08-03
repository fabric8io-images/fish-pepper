var imageNames = require('./image-names');
var tarCmd = "tar";
var child = require('child_process');
var stream = require('stream');


exports.build = function(root, docker, params, image, opts) {
  console.log(image.dir.magenta);
  doBuildImages(root, docker, imageNames.createImageNames(image, params),opts);
};

function doBuildImages(root, docker, buildJobs, opts) {
  if (buildJobs && buildJobs.length > 0) {
    var job = buildJobs.shift();
    console.log("    " + job.getLabel().green + " --> " + job.getImageNameWithVersion().cyan);
    var tar = child.spawn(tarCmd, ['-c', '.'], {cwd: job.getPath(root)});
    var fullName = job.getImageNameWithVersion();
    docker.buildImage(
      tar.stdout, {"t": fullName, "forcerm": true, "q": true, "nocache": (opts && opts.nocache) ? "true" : "false"},
      function (error, stream) {
        if (error) {
          throw error;
        }
        stream.pipe(getResponseStream(opts && opts.debug));
        stream.on('end', function () {
          job.getTags().forEach(function (tag) {
            docker.getImage(fullName).tag(
              {repo: job.getImageName(), tag: tag, force: 1},
              function (error, result) {
                console.log(result.gray);
                if (error) {
                  throw error;
                }
              });
          });
          console.log();
          // Chain it so that it runs sequentially
          doBuildImages(root, docker, buildJobs, opts);
        });
      });
  }
}

function getResponseStream(debug) {
  var buildResponseStream = new stream.Writable();
  buildResponseStream._write = function (chunk, encoding, done) {
    var answer = chunk.toString();
    var resp = JSON.parse(answer);

    if (debug) {
      process.stdout.write("|| >>> " + answer + "\n");
    }
    if (resp.stream) {
      process.stdout.write("    " + resp.stream.gray);
    }
    if (resp.errorDetail) {
      process.stderr.write("++++++++ ERROR +++++++++++\n".red);
      process.stderr.write(resp.errorDetail.message.red);
    }
    done();
  };
  return buildResponseStream;
}
