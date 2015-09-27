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

