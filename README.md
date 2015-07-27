# fish-pepper - Spice up your ocean life

`fish-pepper` allows you to create many similar Dockerfiles based on
templates. The problem when authoring Dockerfiles for various
situations is that you only can use *inheritance* within Dockerfiles
easily and there is no direct support for  *compositions* when
building Docker images. 

This is especially hurtful when you want you create some *base images*
for other images. Consider a **Java base image**: Some users might
require Java 7, some want Java 8. For running Miroservices a JRE might
be sufficient in other use case you will need a full JDK. Theses four
variants are all quite similar with respect to the documentation, 
Dockerfiles and support files. Copy-and-paste is not a good
solution when you consider that these images evolve over time or when
you have even more parameters.

With `fish-pepper` you can use flexible templates which are filled with
variations of the base image (`'version' : [ 'java7', 'java8'],
'type': ['jdk', 'jre']`) and which will create multiple, similar
Dockerfile setups.

The generated directories can be used to create the images directly
with `fish-pepper` or they can be used as automate Dockerhub builds
when checked in into git.

# How it works

...

# Configuration

...
