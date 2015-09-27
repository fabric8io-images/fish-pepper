## fish-pepper - Spicing<sup>[1](#user-content-f1)</sup> up the ocean

**fish-pepper is a multi-dimensional docker build generator** .  It
allows you to create many similar Docker builds with the help of
[templates](#templates) and building [blocks](#blocks). It allows for
*compositions* of building blocks in addition to the usual Docker
*inheritance* from base images.

For example consider a **Java base image**: Some users
might require Java 7, some want Java 8. For running Microservices a
JRE might be sufficient. In other use cases you need a full JDK. These
four variants are all quite similar with respect to documentation,
Dockerfiles and support files like startup scripts.  Copy-and-paste
might work but is not a good solution considering the image evolution
over time or when introducing even more parameters.

With `fish-pepper` you can use flexible templates which are filled
with variations of the base image (like `'version' :
[ 'java7', 'java8']`, `'type': ['jdk', 'jre']`) and which will create
multiple, similar Dockerfile builds. The [example](example) below
dives into this in more details.

The generated build files can also be used directly to create the
images with `fish-pepper` against a running Docker daemon or they can
be used as the content for automated Docker Hub builds when checked in
into Github.

-----

<b id="f1">1</b>: *fish pepper* is an
[ancient chili pepper variety](http://www.motherearthnews.com/organic-gardening/fish-pepper-zmaz09amzraw.aspx)
coming from Baltimore and are famous for the ornamental
qualities. They are not too hot and are ideal to spice up everything, even Docker builds :)
