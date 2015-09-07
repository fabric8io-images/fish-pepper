## fish-pepper - Spicing<sup>[1](#user-content-f1)</sup> up the ocean

**fish-pepper is a multi-dimensional docker build generator** .  It
allows you to create many similar Docker builds with the help of
[templates](#templates) and building [blocks](#blocks). It allows for
*compositions* of building blocks in addition to the usual Docker
*inheritance* from base images.

Let's have a look at an example for a **Java base image**: Some users
might require Java 7, some want Java 8. For running Microservices a
JRE might be sufficient. In other use cases you need a full JDK. Theses
four variants are all quite similar with respect to documentation,
Dockerfiles and support files like startup scripts.  Copy-and-paste
might work but is not a good solution considering the image evolution
over time or introducing even more parameters.

With `fish-pepper` you can use flexible templates which are filled
with variations of the base image (like `'version' :
[ 'java7', 'java8']`, `'type': ['jdk', 'jre']`) and which will create
multiple, similar Dockerfile builds. The [example](example) below
dives into this in more details.

The generated build files can also be used directly to create the images
with `fish-pepper` against a running Docker daemon or they can be used
as automated Docker Hub builds when checked in into git.

### Synopsis

````
Usage: fish-pepper [OPTION] <command>

Multidimensional Docker Build Generator

  -i, --image=ARG+    Images to create (e.g. "tomcat")
  -p, --param=ARG     Params to use for the build. Must be a comma separated list
  -a, --all           Process all parameters images
  -c, --connect       Docker URL (default: $DOCKER_HOST)
  -d, --dir=ARG       Directory holding the image definitions
  -n, --nocache       Don't cache when building images
  -e, --experimental  Include images which are marked as experimental
  -h, --help          display this help

The argument is interpreted as the command to perform. The following commands are supported:
    
    make  -- Create Docker build files from templates (default)
    build -- Build Docker images from generated build files. Implies 'make'

The configuration is taken from the file "fish-pepper.json" or "fish-pepper.yml" from the 
current directory or from the directory provided with the option '-d'. Alternatively the 
first parent directory containing one of the configuration files is used.

Examples:

   # Find a 'fish-pepper.yml' in this or a parent directory and use
   # the images found there to create multiple Docker build directories.
   fish-pepper

   # Create all image families found in "example" directory
   fish-pepper -d example

   # Create only the image family "java" in "example" and build the images, too
   fish-pepper -d example -i java build
````

### Options

| Short         | Long      | Description  |
| --------------- |--------| ----- |
| `-i` <images>   | `--image`| A comma separated list of images to build. Images are specified as directory names, which must contain a `images.yml` configuration |
| `-p` <parameters> | `--param` | A comma separated list of parameters to specify which builds to create. The order must be according to the defined order in `images.yml` |
| `-a`            | `--all`  | Build all images with all parameters |
| `-c` <docker url> | `--connect` | Connect URL for the Docker host. By default `$DOCKER_HOST` is used |
| `-d` <dir> | `--dir` | Directory containing the top-level `fish-pepper.yml`. By default the current directory or one of the parent directories is used if it contains a `fish-pepper.yml` | 
| `-n` | `--nocache` | Don't use a cache when building images | 
| `-e` | `--experimental` | Enable also images marked as experimental in the configuration |

If no option is given, `fish-pepper` tries to detect its main
configuration file in the current directory and then up the diretory
tree. With the option `-d` it is possible to directly point to this
directory.

Every image below this *root* dir which contains a `images.yaml` is
considered to be an image build. The id of the image is the
directory name holding the `images.yaml`.

When `fish-pepper` is called from the *root directory* without any
option, every image with every configured parameter value combination
is processed. This can be restricted with the options `-i` for
selecting the images to process and/or `-p` for the parameter values
(parameters are explained in depth below).

If you are within an image directory and call `fish-pepper` without
any argument, then only this image is build except when `-a` is
given. Then all images are build nevertheless. If you within an
generated image directory then also the parameters to use for build
generation are inferred. 

Image parameters can be marked as experimental in the
configuration. By default they are omitted when `fish-pepper`
runs. Experimental images can be enabled with `-e`.

#### Examples

* Make all docker builds and create the images with the Docker daemon
  running at `$DOCKER_HOST`: 

        fish-pepper build

* Create the image family "java" which can be found in the directory
  `example`: 

        fish-pepper -d example -i java

* Create only the image `java-openjdk8-jre`:

        fish-pepper -d example -i java -p openjdk8,jre

* Asuming your current working directory is in
  `examples/java/images/openjdk7/jdk` and you call `fish-pepper`
  without arguments, only the Docker build for the image "java" with
  the parameter values "opendjk8" for the parameter "version", and
  "jre" for the parameter "type" is used ("version" and "type" are the
  parameter types as defined in `fish-pepper.yml`). This corresponds
  to

        fish-pepper -d example -i java -p openjdk7,jdk

* Assume the same directory as above, but when you call `fish-pepper
  -a` then all images with all parameters are build nevertheless. 

### How it works

`fish-pepper` expects a certain directory layout where it can find
configuration and templates. In the following the *root* directory is
the one where the central configuration file `fish-pepper.yml` (or
`fish-pepper.json`, that's your choice) is located. This top level
configuration file contains various global properties valid for all
images. It also has default values for image names and other
internally used parameters.

A sub-directory within the root directory is considered to be an
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

There are two kinds of configuration files:

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

The top-level configuration file is typically quite slim:

```yaml
# Variable influencing the behaviour of fish-pepper are given in an extra object 'fish-pepper'
fish-pepper:
  # Registry for building the name when building images with '-b'. Can be omitted
  # in which case no registry is used
  registry: "docker.io"
  # A user which is used as default when no image stem is given
  repoUser: "fabric8"

  # Custom global variables useful in templates
  maintainer: "rhuss@redhat.com"
```

As mentioned above, the section `fish-pepper` has a special
meaning. The following keys are used

* **registry** - A default registry to use when creating images with
  `fish-pepper -b`
* **repoUser** - A default repo user to use when creating images in
  build mode

These two parameters are used for calculating the base image name when
doing a Docker build in build-mode. See [below](#image-naming) for how
the name is calculated.

Any other key can be used by any image family. E.g. this is also
perfect for defining a maintainer or global  
labels. 

#### `images.yml`

For each image family found in a sub directory below the root
directory where `fish-pepper.yml` is stored a dedicated configuration
file `images.yml` is used. As the global config file, `fish-pepper:`
blocks defined configuration values with a special meaning.

* **params** defines the parameterization of the image family. See below.
* **name** the name stem to use when building images with `-b`. If not
  given, the name is calculated as described in an extra
  [section](#image-naming). 

*Parameters* are a central concept of fish-pepper. They are used to
fan-out a image family into multiple image builds. A parameter has a
type (like 'version') and one or more possible values. For each value,
a Docker build directory is created from the templates. The can be
multiple parameter types, each with a dedicated set of possible
values. The generated Docker build directories' hierarchy reflects the
parameterization space: On the first directory level sub-directories
are named like the values of the first parameter type, on the second
level the directories are named after the values of the second
parametere type and so on. See section [How it works](#how-it-works)
for an example layout. Note, that using multiple parameters can easily
result in a multitude of Docker builds. So the set of possible
parameters as well as their values should be chosen carefully.

`fish-pepper` will iterate over all parameter values and used
dedicated, parameter value specific configurations for creating the
template's context. This configuration is stored in a special
`config:` object which looks like:

```yaml
fish-pepper:
  params:
    - type1
    - type2
config:
  type1:
    value1.1:
       .....
    value1.2:
       .....   
  type2:
    value2.1:
       ....
    value2.2:
       ....
    value2.3:
    ....
```

So, for each parameter `type` there's a set of config `value`s. In the
abstract example above, 6 (2 * 3) Docker build directories would be
created, one for each permutation of parameter values. The `.....`
represent the specific configuration for this parameter values. The
configuration of all select parameter values for a specific
combination are merged into one single configuration which is used to
fill in the template.

An example:

```yaml
config:
  version:
    openjdk7:
      fish-pepper:
        version: "1.7"
        tags:
          - "7u79"
      java: "java:7u79"
      fullVersion: "OpenJDK 1.7.0_79 (7u79-2.5.5-1~deb8u)"
    openjdk8:
      fish-pepper:
        version: "1.8"
        tags:
        - "8u45"
      java: "java:8u45"
      fullVersion: "OpenJDK 1.8.0_45 (1.8.0_45-internal-b14)"
  type:
    jre:
      extension: "-jre"
    jdk:
      extension: "-jdk"
```

Here are two types with two values each, resulting in four Docker
builds. For the build with `version=openjdk7` and `type=jre` the
template gets a template context which holds this information:

```yaml
config:
  version:
    java: "java:7u79"
    fullVersion: "OpenJDK 1.7.0_79 (7u79-2.5.5-1~deb8u)"
  type:
    extension: "-jre"
param:
  version: "openjdk7"
  type: "jre"
```

As you can see, the parameter values are included, too. In the example
above you can also see, that each parameter value's configuration can
also contain a `fish-pepper:` section. As for the top-level
`fish-pepper:` the properties specified here influence the behaviour
of the build files generation.

The template context is described in detail in
[Template context](#template-context).

* **experimental** if set, this parameter value is considered to be
  experimental and the value will only be used when the command line
  option `--experimental` (or `-e`) is given.
* **version**
  A paramer value specific version number which is used to generate
  the image name when building images with `-b`. See
  [Image naming](#image-naming) for details. 
* **tags** 
  A list of tags which will be added to the created images in build
  mode. 

### Templates

Fish pepper templates are
[DoT.js](http://olado.github.io/doT/index.html) templates. It is a
fast template library which allows for the full expressiveness of
JavaScript. Its a bit similar to JSP or PHP. The template syntax is
described in detail [here] (section "Usage").

The most important directives are

* `{{= ... }}` will evaluate the JavaScript within the parentheses and
  evaluate it as string which then is inserted literally into the
  text.
* `{{ ... }}` will add the JavaScript code (which can be partially
  complete only) to the generated JavaScript rendering
  function. E.g.

        {{ images.forEach(function image) { }}
        * {{= image.name }}
        {{ } }}

  will iterate over `images` (which needs to be initialized
  beforehand) and create a bullet list of the image names.
* ``{{~ array :value:index}}`` can be used as shortcut for iteration
  over arrays. So, the example above can be written more elegantly
  with 

        {{~ images :image:index}}
        * {{= image.name }}
        {{~}}

* With `{{? if-condition} ... {{?? else-if-conition}} ... {??} (else)
... {{?}}` conditions can be build up easily:

        {{? images.length > 1 }}
          More than one image
        {{?? images.length == 1 }}
          Exactly one image 
        {{??}}
          No image
        {{?}}

#### Template context

All fish-pepper templates have access to the fish-pepper context
object. This accessible as variable **fp** from within the templates.

The **fp** context has the following properties:

* `param` is a map holding the current parameter values. As described
  in [Configuration](#images.yml) template are evaluated for every
  parameter values tuple. In each iteration the `param` property holds
  a map with the current parameter values. For the example above e.g
  when the current parameter values are `version == "openjdk7"` and
  `type == "jdk"` then `fp.param` is

        {
          version: "openjdk7"
          type: "jdk"
        }

* `config` is an object which holds the configuration for the
  selected parameter values for the current template
  evaluation. E.g. assuming the example configuration given
  [above](#images.yml), then when the template for the parameter
  values `version == 'openjdk8'` and `type == 'jre'` is used,
  then `fp.config.version.java` evaluated to `java:8u45` and
  `fp.config.type.extension` to `-jre`. The general scheme is
  `fp.config.`*parameter type* which references to the currently
  active parameter's configuration. 
* All other properties defined in `fish-pepper.yml` and `images.yml`
  are directly accesible as properties from `fp`, so you can easily
  define image global and global global properties. Properties with
  the same name in `images.yml` take precedence over the properties in
  `fish-pepper.yml`. 
* `block()` is a function to use [blocks](#blocks)

Examples of the context usage can be found in the
[templates](example/java/templates) used in the Java fish-pepper demo
included in this repository. 

### Blocks

One of the major features of fish-peppers are reusable
**blocks**. These are reusable components which can be parameterized
like any other template. A block itself can consist of two different
kinds:

* **template snippets** which will be inserted as a template fragment
  where referenced from within a template
* **files** which are copied over into the Docker build direct.

These blocks can be defined locally or referenced remotely and a
referenced by a unique ame. It is easy to share blocks across multiple
image deinitions. The following two sections explain how to use blocks
and how to create blocks.

#### Block usage

Defined Blocks can be referenced from within templates with a function
on the template context. 

```javascript
{{= fp.block('version-info') }}
```

will refer to a block named "version-info". This block is processed as
a template which receives the same context as the calling
template. The processed content is the insert in place where the
method is called.

Sub-snippets can be declared with an optional second argument:

```javascript
{{= fp.block('version-info','java') }}
```

An (optional) third argument specifies additional processing
instructions and additional arguments for the blocks as an JavaScript
object: 

```javascript
{{= fp.block('version-info','java',{ "no-files": true, "copy-dir" :
"/usr/local/sti" }) }}
```

Processing instructions all start with `fp-`. The followin
instructions are support:

* `fp-no-files` : Don't copy over any files into the build directory

#### Block definitions

Blocks are stored in dedicated `blocks/` directories. These will be
looked up in multiple locations:

* Top-level `blocks/` directory where you global `fish-pepper.yml` resides. The blocks
  defined here are available across all defined images.
* `blocks/` directory on the image level where `images.yml` is located.
* The location referenced in the `blocks:` sections in
  `fish-pepper.yml`. 

There are two kind of blocks.

##### Simple blocks

Simple blocks are files within the blocks directory. They can have an
arbitrary file extension which should match the content. The name
before the extension defines the block name. E.g. a file
`version-info.md` in on of the `blocks/` directories or in one of the
locations referenced in the configuration will defined a block named
"version-info" (and is probably written in markdown). This block can
easily be referenced from within a template with `{{=
fp.block('version-info') }}`. The text itself is a template, too and
is processed before inserted. 

The block itself can reference the `fp` context object as described in
[Templates](#templates). In addition is access to extra information
which is available only for this block. This information is available
as an object via the property `fp.blockContext` and has the following
properties:

* `name` : Name of the block
* `subname` : Sub-snippet name (which is empty for simple blocks)
* `opts` : Extra option given a third argument to the block call

##### Extended blocks

Extended blocks consist of multiple files which are stored within a
directory in the blocks location. The name of the directory is also
the block name. Any file within this directory defines a
sub-snippet. The base filename of the sub snippets are the name of
the sub-snippets, the extension can be anything. This directory can
also contain a directory `fp-files` which holds files which should be
copied over into a Docker build directory. This directory can hold
other directories, which are deeply copied.

For example consider the following setup:

```

blocks/
  |
  +-- run-sh/
       |  
       +-- run-commands.dck
       +-- readme.md
       +-- fp-files
               |
               +-- run.sh

```

This defines a block named `run-sh` with the template snippets
`run-commands.dck` and `readme.md`. The former holds the ADD command
to put into the Dockerfile via `{{=
fp.block('run-sh','commands.dck')}}`. This will also copy over all
files in `fp-files` directory, in this case `run.sh`. Alls files
copied are also processed as templates. The `readme.md` contains the usage
instructions which can be included in the README template with `{{=
fp.block('run-sh','readme.md',{ 'fp-no-files' : true }) }}`. The third
argument to this call indicates that no files should be copied in
this case. 

#### Remote Block definitions

Blocks can be also defined in a Git repository which must be
accessible with `https`. These external references are defined in the
main `fish-pepper.yml` configuration file in a dedicated `blocks`
section.

For example

```yml
blocks:
  - type: "git"
    url: "https://github.com/fabric8io/run-java-sh.git"
    path: "fish-pepper"
```

The `blocks` sections contains a list of external references. This
external reference has a type (currently only `git` is supported), an
access URL (`https` is mandatory for now). Optionally a `path` pointing
in this Git Repo is provided. This directory is then used as a blocks
directory as described above.

If `type` is omitted, the type is extracted from the `url` (i.e. if 
it ends with `.git` its of type "git"). If instead of an object a string
is provided as block, this string is interpreted as URL. If no `path` is given, 
the defaul path `fish-pepper` is assumed. The example above hence can 
be written also as

```yml
blocks:
  - "https://github.com/fabric8io/run-java-sh.git"
```

By default `master` is checked out, but this can be influenced either
with a `tag` or `branch` property in which case the specific
tag or branch is used. 

### Defaults

For each parameter configuration default can be configured. Assume the
following part of an `images.yml`:

```yaml
# ....
config:
  version:
    default:
      downloadUrl: "http://download.eclipse.org/jetty/${JETTY_VERSION}/dist/jetty-distribution-${JETTY_VERSION}.tar.gz"
      from:
        jre8: "fabric8/java-centos-openjdk8-jre"
        jdk7: "fabric8/java-centos-openjdk7-jdk"
        version: "1.0.0"
    9:
      version: "9.3.2.v20150730"
    8:
      version: "8.1.17.v20150415"
    7:
      version: "7.6.17.v20150415"
# ...    
```

When iterating over the versions `fp.config.version` will also hold
the properties `downloadUrl` and `from` which come from the default
section if not overriden by a specfic version. The advantage is the
you can avoid duplication of common parameter, the only drawback is
that you can't have a parameter value of `default`.

### File mappings

For more complex variations of Dockerfile which would lead into
complicated Templates with a lof of conditionals it is possible to
provide to use alternative templates based on parameter values.

This is best explained with an example: The project
[fabric8/base-images](https://github.com/fabric8io/base-images) use
fish pepper to generate a collection of base images, also for Jetty
down to version 4. However the download process of the Jetty archives
changes significantly when Jetty moved from Mortbay to Eclipse. So
base images provides two different Dockerfile templates: One for
[Jetty 7 to 9](https://github.com/fabric8io/base-images/blob/master/jetty/templates/Dockerfile)
and one for
[Jetty 4 to 6](https://github.com/fabric8io/base-images/blob/master/jetty/templates/__Dockerfile-456) 

The relevant part in `images.yml` looks then like

```yaml
# ...
config:
  version:
    9:
      version: "9.3.2.v20150730"
    8:
      version: "8.1.17.v20150415"
    7:
      version: "7.6.17.v20150415"
    6:
      version: "6.1.18"
      fish-pepper:
        mappings:
          __Dockerfile-456: "Dockerfile"
    # version 4 & 5 are similar
```

For Jetty version 6 there is a special section
`fish-pepper.mappings`. This section contains an object which maps
source files to its destination in the Docker build directory. In this
example the template `__Dockerfile-456` is copied over `Dockerfile`
after it has been processed as a template. That way it is quite easy
to create alternativs for certain template files.

### Image naming

When using the build mode with `-b`, image names are calculated from
various ways. The *base name* is taken from a `fish-pepper.name` when
given in `images.yml`. If not the base is calculated as
`registry/userRepo/image`, where `registry` and `userRepo` can be
globally defined in `fish-pepper.yml` and `image` is the diretory name
where `images.yml` is stored. `registry` and `userRepo` can be both
left out.

From this base name the full name is calculated by appending the
concrete parameter values with dashs (`-`). For example, when building
an image for the param values `version=openjdk7` and `type=jre` then
image name will be `java-openjdk7-jre`, assuming that `java` is the
*base name* as described above.

The image's tag is also calculated: Each param parameter value can have a
`version` parameter in its `fish-pepper` section. For all parameter
values this version are concatenaed with `-` to form an overall
version number. When there is a top-level `fish-pepper.buildVersion`
in the `images` file, then this will be appended, too. If no version
is found at all `latest` is used.

In addition to this major tag more tags can be provided by the
parameter values' configuration. Each tag creates an additional tag.

Sounds complicated ? Hopefully an example sheds some light on
this. Consider the following `images.yml` for a `java` image family:

```yaml
  # Two dimensional build: 1st dimension == version (7 or 8), 
  # 2nd dimension == type (jdk or jre)
  fish-pepper:
    params:
      - "version"
      - "type"
    # Name stem to use for the images to create with -b (param value will be appended with -)
    name: "jolokia/fish-pepper-java"
    # Internal build number. Should be increased for each change
    build: 2

  # .......

  # Parameter specific configuration. For each type there is entry which holds all
  # possible values. This values are used to create the directory hierarchy and
  # also used within the image names.
  config:
    version:
      openjdk7:
        # The version is used in the tag
        fish-pepper:
          version: "1.7"
          # Additional tags to add
          tags:
            - "7u79"
        # ....
      openjdk8:
        fish-pepper:
          version: "1.8"
          tags:
          - "8u45"
          - "latest"
        # ....
    type:
      jre:
        # ....
      jdk:
        # .... 
```

When using `fish-pepper build` with this image config you will get the
following images (user and registry omitted):

* java-openjdk7-jdk:1.7-jdk-2
* java-openjdk7-jre:1.7-jre-2
* java-openjdk8-jdk:1.8-jdk-2
* java-openjdk8-jre:1.8-jre-2

and the additional tagged images:

* java-openjdk7-jdk:7u79 
* java-openjdk7-jre:7u79
* java-openjdk8-jdk:8u45, java-openjdk8-jdk:latest
* java-openjdk8-jre:8u45, java-openjdk8-jre:latest

It is recommended to use and count up `fish-pepper.buildVersion` for
any change in you build files.

### Example

A full featured example showing most of fish-pepper's possibilities
can be found in the `example` directory which holds one configuration
for building a [agent-bond](https://github.com/fabric8io/agent-bond)
enabled Java image. The build it quite similar and we will build for
OpenJDK 7 and 8 with a JDK and JRE, respectively.

All the configuration files are documented, so please have a look a
them to see how the tepmplating works.

-----

<b id="f1">1</b>: *fish pepper* is an
[ancient chili pepper variety](http://www.motherearthnews.com/organic-gardening/fish-pepper-zmaz09amzraw.aspx)
coming from Baltimore and are famous for the ornamental
qualities. They are not too hot and are ideal to spice up everything, even Docker builds :)

