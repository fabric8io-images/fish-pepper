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

