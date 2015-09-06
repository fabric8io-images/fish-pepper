var Git = require('nodegit');
var Future = require('fibers/future');
var util = require('./util');
var fs = require('fs');

exports.load = function (root, def, blockReadFunc) {

  // We need a future here because nodegit is inherently async working with promises,
  // whereas the rest of the code is sync.
  var future = new Future();
  readBlocksFromGit(root, def).then(function (blocks) {
    future.return(blocks)
  }).catch(function (err) {
    future.throw(err);
  });
  return future.wait();

  // ===============================================================

  function readBlocksFromGit(root, def) {
    var name = (def.url.match(/.*\/([^/]+?)(?:\..*)?$/))[1];
    var base = root + "/.fp-git-blocks";
    util.ensureDir(base);
    var path = base + "/" + name;

    var gitCloneOrPull;
    if (fs.existsSync(path)) {
      // Open and pull
      gitCloneOrPull =
        Git.Repository.open(path)
          .then(function (repo) {
            return pull(repo, def.branch)
          });
    } else {
      // Clone
      gitCloneOrPull =
        Git.Clone(def.url, path, {remoteCallbacks: getRemoteCallbacks()});
    }

    return gitCloneOrPull
      .then(function (repo) {
        return switchToBranchOrTag(repo, def)
      })
      .then(function () {
        return blockReadFunc(getBlocksPath(path,def));
      });
  }

  function getBlocksPath(path,def) {
    return path + "/" + (def.path ? def.path : "fish-pepper");
  }

  function switchToBranchOrTag(repo, def) {
    // Check for tag or branch and switch to tag or branch
    if (def.branch) {
      return checkOutBranch(repo, def.branch);
    } else if (def.tag) {
      return checkOutTag(repo, def.tag);
    }
  }

  function getRemoteCallbacks() {
    return {
      certificateCheck: function () {
        return 1;
      }
    };
  }

  function pull(repo, branch) {
    // Optimization: Do a pull only if no tag is given or the tag given differs from the currently checked out tag
    return repo.fetch("origin", getRemoteCallbacks())
      .then(function () {
        branch = branch || "master";
        repo.mergeBranches(branch, "origin/" + branch);
        return repo;
      })
      .then(function () {
        return repo;
      })
  }

  function checkOutBranch(repo, branch) {
    return Git.Branch.lookup(repo, "origin/" + branch, Git.Branch.BRANCH.REMOTE)
      .then(function (reference) {
        return checkOutRef(repo, reference);
      });
  }

  function checkOutTag(repo, tag) {
    return Git.Tag.list(repo)
      .then(function (repoTags) {
        return getCommitForTag(repo, tag, repoTags);
      })
      .then(function (tagRef) {
        return checkOutCommit(repo, tagRef);
      });
  }

  function getCommitForTag(repo, tag, repoTags) {
    for (var i = 0; i < repoTags.length; i++) {
      var repoTag = repoTags[i];
      if (tag === repoTag) {
        return repo.getReferenceCommit(repoTag);
      }
    }
    ;
    throw new Error("No tag " + tag + " found. Known tags: " + repoTags);
  }

  function checkOutCommit(repo, commit) {
    var signature = Git.Signature.default(repo);
    repo.setHeadDetached(commit.id(), signature, "Checkout: HEAD " + commit.id());
    return Git.Checkout.head(repo, {
      checkoutStrategy: Git.Checkout.STRATEGY.FORCE
    });
  }

  function checkOutRef(repo, branchRef) {
    var signature = Git.Signature.default(repo);
    repo.setHead(branchRef.name(), signature, "Set head to " + branchRef.target())
      .then(function () {
        return Git.Checkout.head(repo, {
          checkoutStrategy: Git.Checkout.STRATEGY.FORCE
        });
      });
  }
};

