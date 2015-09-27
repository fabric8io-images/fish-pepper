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

### Examples

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


