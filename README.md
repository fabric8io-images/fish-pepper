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

### How it works

...

### Configuration

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
