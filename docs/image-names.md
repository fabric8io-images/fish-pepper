### Image naming

When using the build mode with `-b`, image names are calculated from
various ways. The *base name* is taken from a `fish-pepper.name` when
given in `images.yml`. If not the base is calculated as
`registry/userRepo/image`, where `registry` and `userRepo` can be
globally defined in `fish-pepper.yml` and `image` is the directory name
where `images.yml` is stored, relative to the root directory (which holds `fish-pepper.yml`). 
`registry` and `userRepo` can be both left out.

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

