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
* **ignore-for**
  This can be a list of pattern-lists. If one of the patterns matches to 
  the current values of the current (other) params values, this param value 
  is ignored. This is bet explained with an example:
    
        config:
          version:
            openjdk7: ....
            openjdk8: ....
          type:
            jre: ....
              fish-pepper:
                ignore-for:
                   - [ "openjdk7" ]    
            jdk: ....

   Here, the `ignore-for` entry will prevent from creating an openjdk7 version image 
   as 'jre' variant, so the valid parameter combindations are *(openjdk7,jdk)*, *(openjdk8,jre)*
   and *(openjdk8,jdk)*. The elements in the `ignore-for` array parameter values in the 
   order defined, up to and excluding the parameter for which this configuration is set. An entry
   of "*" can be used to match every value. Multiple different patterns can be given.

