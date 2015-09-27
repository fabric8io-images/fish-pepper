### Setup

`fish-pepper` expects a certain directory layout where it can find
configuration and templates. In the following the *root* directory is
the one where the central configuration file `fish-pepper.yml` (or
`fish-pepper.json`, that's your choice) is located. This top level
configuration file contains various global properties valid for all
images. It also has default values for image names and other
internally used parameters.

A sub-directory within the root directory is considered to be an
**image family**. This sub-directory can more than one level below 
the root directory, but image families might not be nested. A image family shares 
the same templates and has a configuration file `images.yml` (or `.json`) which 
declares which parameters the image family has and contains the individual
configuration values for each parameter variation. This file is
described in detail [below](#images.yml), but the most important part
is the list of parameters (`params`) which determines the
parametrization space. Each parameter can have multiple possible
values, so that the total number of all images is the product of the
parameter value count per parameter. E.g. for an image family called
`java` consider two params: `version` and `type` where `version` can
have the values `[ "openjdk7", "openjdk8"]`, `type` has the values
`["jre","jdk"]`. The result will be docker builds for four images:
`java-openjdk7-jre`,`java-openjdk7-jdk`, `java-openjdk8-jre` and
`java-openjdk8-jdk`.

Beside the configuration `images.yml` there is a directory
`templates/` which holds templates for the Dockerfile and supporting
scripts. fish-pepper uses
[doT.js](http://olado.github.io/doT/index.html) for templating. The
most important placeholders are described in the section
[Templates](#templates). Beside this there can be files specifyin so
called **blocks** for compositing images out of reusable
components. This can be a directory `blocks/` holding individual block
definitions as files or `block.yml` which holds multiple block
definitions. Blocks are explained [below](#blocks).

Finally there is the `images/` directory which will contain the
generated build files.

A typical directory layout looks like

     |
     +- fish-pepper.yml
     |
     +- java/
     |    |      
     |    +- images.yml
     |    |
     |    +- templates/
     |    |      |
     |    |      + Dockerfile
     |    |      + ....
     |    |
     |    +- blocks/
     |    |
     |    +- images/
     |          |
     |          + openjdk7/
     |                + jre/{Dockerfile,....}
     |                + jdk/{Dockerfile,....}
     |          + openjdk8/
     |                + jre/{Dockerfile,....}
     |                + jdk/{Dockerfile,....}
     |
     + tomcat/
         |
         .....


When you call now `fish-pepper` from somehwere within this directory
the following happens:

* fish-pepper will check for a `fish-pepper.yml` (or `.json`) in the
  current or a parent directory. If it finds one, it takes it as root
  directory. If not, it bails out.
* For each image family found, check which parameters are contained
  and fan out into `images/` with all combinations of parameter
  values.
* The templates are taken from `templates/` processed with the
  configuration provided in `images.yml` (and the top-level
  `fish-pepper.yml`) and the final files are created.

If fish-pepper is used with the command `build` and a Docker host is
configured either via command line options or via the environment
variable `DOCKER_HOST` then in a second pass the docker images are
created, too.

You can restrict which image family (`--image`) and which param value
combination (`--param`) is processed.