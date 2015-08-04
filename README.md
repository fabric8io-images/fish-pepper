## fish-pepper - Spicing up your ocean life

`fish-pepper` allows you to create many similar Dockerfiles based on
templates. The problem when authoring Dockerfiles for various
situations is that you only can use *inheritance* within Dockerfiles
easily and there is no direct support for  *compositions* when
building Docker images. 

This is especially hurtful when you want you create some *base images*
for other images. Consider a **Java base image**: Some users might
require Java 7, some want Java 8. For running Miroservices a JRE might
be sufficient in other use cases you will need a full JDK. Theses four
variants are all quite similar with respect to the documentation, 
Dockerfiles and support files. Copy-and-paste is not a good
solution when you consider that these images evolve over time or when
you have even more parameters.

With `fish-pepper` you can use flexible templates which are filled with
variations of the base image (`'version' : [ 'java7', 'java8'],
'type': ['jdk', 'jre']`) and which will create multiple, similar
Dockerfile setups.

The generated directories can be used to create the images directly
with `fish-pepper` against a running Docker daemon or they can be used
as automated Dockerhub builds when checked in into git.

### Synopsis

````
Usage: fish-pepper [OPTION] <dir>

Generator for Dockerfiles from templates

  -i, --image=ARG+    Images to create (e.g. "tomcat")
  -p, --param=ARG+    Params to use for the build. Should be a comma separate list, starting from top
  -b, --build         Build image(s)
  -d, --host          Docker hostname (default: localhost)
  -p, --port          Docker port (default: 2375)
  -n, --nocache       Don't cache when building images
  -e, --experimental  Include images which are marked as experimental
  -h, --help          display this help

Examples:

  # Find a 'fish-pepper.yml' in this or a parent directory and examine and use
  # the images found there to create Dockerfiles from templates
  fish-pepper

  # Create all images found in "example" directory
  fish-pepper example

  # Create only the image family "java" in "example" and build the images
  fish-pepper example -i java -b
````

### How it works

`fish-pepper` expects a certain directory layout where it can find
configuration and templates. In the following the *root* directory is
the one where the central configuration file `fish-pepper.yml` (or
`fish-pepper.json`, that's your choice) is located. This top level
configuration file contains various global properties valid for all
images. It also has default values for image names and other
internally used parameters.

A Sub-directory within the root directory is considered to be an
**image family**. A image family shares the same templates and has a
configuration file `images.yml` (or `.json`) which declares which
parameters the image family has and the individual configuration
values for each parameter variation. This file is described in detail
below, but the most important part is the list of parameters
(`params`) which determines the parametrization space. Each parameter
can have multiple possible values, so that the total number of all
images is the product of the parameter value number per
parameter. E.g. for a image family called `java` consider two params:
`version` and `type` where `version` can have the values
`[ "openjdk7", "openjdk8"]`, `type` has the values
`["jre","jdk"]`. The result will be docker builds for four images:
`java-openjdk7-jre`,`java-openjdk7-jdk`, `java-openjdk8-jre` and
`java-openjdk8-jdk`.

Beside the configuration `images.yml` there is a directory
`templates/` which holds templates for the Dockerfile and supporting
scripts. fish-pepper uses
[doT.js](http://olado.github.io/doT/index.html) for templating. The
most important placeholders are described below. Beside this there can
be files specifyin so called **blocks** for compositing images out of
reusable components. This can be a directory
`blocks/` holding individual block definitions as files or `block.yml`
which holds multiple block definitions. Blocks are explained
[below](#blocks). 

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


When you call now `fish-pepper` from somehwere within this directory the following happens:

* fish-pepper will check for a `fish-pepper.yml` (or `.json`) in the
  current or a parent directory. If it finds one, it takes it as root
  directory. If not, it bails out.
* For each image family found, check which parameters are contained
  and fan out into `images/` with all combinations of parameter
  values.
* The templates are taken from `templates/` processed with the
  configuration provided in `images.yml` (and the top-level
  `fish-pepper.yml`) and the final files are created.

If fish-pepper is used with the option `-b` (or `--build`) and a
Docker host is configured either via command line options or via the
environment variable `DOCKER_HOST` then in a second pass the docker
images are created, too.

You can restrict which image family (`--image`) and which param value
combination (`--param`) is processed.

### Configuration

There are two kinds of configuration file:

* A global configuration `fish-pepper.yml` global, image independent
  configuration, like a default Docker user name or the maintainer to
  use within the Dockerfile.
* A per image family configuration `images.yml` which declares the
  parameterization of the images and image specific configuration.

The configuration can be given either in [YAML](http://yaml.org/)
syntax (with the file extensions `.yml` or `.yaml`) or in plain JSON
(with extension `.json`).

Configuration within a `fish-pepper` section section in those files
influence the behaviour of the image generation and the property names
have a special meaning. All other configurations are mostly relevant
for the templating.

#### `fish-pepper.yml`




#### Templates

#### Blocks
...

### Example

A full featured example showing most of fish-pepper's possibilities
can be found in the `example` directory which holds one configuration
for building a [Jolokia](http://www.jolokia.org) enabled Java
image. The build it quite similar and we will build for OpenJDK 7 and
8 with a JDK and JRE, respectively.

All the configuration files are documented, so please have a look how 
the tepmplating works.

The top-level `fish-pepper.yml` holds definitions which can are global
for all images used.
 
Each sub-directory is checked for a `fp-config.yml` and if this exists, 
this directory is supposed to specify a fish-pepper build where the image 
is by default named like the directory.
